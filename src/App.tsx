import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  BandPlan,
  findBandPlanForFrequency,
  MASTER_BAND_PLANS,
  ModulationModeExtended,
} from './radio/bandPlans';
import {
  CB_CHANNELS,
  HIGHWAY_CORRIDORS,
  ModulationMode,
} from './radio/cbChannels';
import { CtcssDetectionResult } from './radio/ctcssTones';
import { RdsStationData } from './radio/demodulators';
import {
  computeIaruSMeter,
  HeshRadioDspEngine,
  RogerBeepType,
  SMeterReading,
} from './radio/dspEngine';
import { RigController, RigStatus } from './radio/rigController';
import { RtlSdrHardwareBridge, RtlSdrStatus } from './radio/rtlSdrBridge';
import { SMeterDisplay } from './components/SMeterDisplay';
import { WaterfallDisplay } from './components/WaterfallDisplay';
import { MultiBandVfoDeck } from './components/MultiBandVfoDeck';
import { MobileTacticalCockpit } from './components/MobileTacticalCockpit';
import { FmRadioPlayerDeck } from './components/FmRadioPlayerDeck';
import { AdifLogger, bandForFrequency } from './radio/adifLogger';
import { ScanEngine, MemoryChannel } from './radio/scanEngine';
import { BlackBoxRecorder } from './radio/blackBoxRecorder';
import { TacticalHeader } from './components/layout/TacticalHeader';
import { CategoryTabBar, ViewTab } from './components/layout/CategoryTabBar';
import { AnalogControlKnobs } from './components/layout/AnalogControlKnobs';
import { HighwayDispatchDeck, TrafficLogEntry } from './components/layout/HighwayDispatchDeck';

// Lazy-loaded heavy sub-decks with React Suspense
const DigitalModesDeck = lazy(() =>
  import('./components/DigitalModesDeck').then((m) => ({ default: m.DigitalModesDeck }))
);
const SolarPropagationDeck = lazy(() =>
  import('./components/SolarPropagationDeck').then((m) => ({ default: m.SolarPropagationDeck }))
);
const AdifQsoLogDeck = lazy(() =>
  import('./components/AdifQsoLogDeck').then((m) => ({ default: m.AdifQsoLogDeck }))
);
const TacticalScannerDeck = lazy(() =>
  import('./components/TacticalScannerDeck').then((m) => ({ default: m.TacticalScannerDeck }))
);
const NoaaEmergencyDeck = lazy(() =>
  import('./components/NoaaEmergencyDeck').then((m) => ({ default: m.NoaaEmergencyDeck }))
);
const LaboratorySignalDeck = lazy(() =>
  import('./components/LaboratorySignalDeck').then((m) => ({ default: m.LaboratorySignalDeck }))
);
const BlackBoxRecorderDeck = lazy(() =>
  import('./components/BlackBoxRecorderDeck').then((m) => ({ default: m.BlackBoxRecorderDeck }))
);
const RtlSdrControlPanel = lazy(() =>
  import('./components/RtlSdrControlPanel').then((m) => ({ default: m.RtlSdrControlPanel }))
);
const RigControllerPanel = lazy(() =>
  import('./components/RigControllerPanel').then((m) => ({ default: m.RigControllerPanel }))
);

const DeckLoadingFallback: React.FC = () => (
  <div className="p-8 text-center text-zinc-400 font-mono text-xs bg-black/40 rounded-xl border border-zinc-800 space-y-2">
    <div className="animate-pulse text-amber-400 font-bold">TUNING DECK ENGINE...</div>
    <div className="text-zinc-500">Loading module telemetry and digital processors</div>
  </div>
);

/**
 * Deep link `#/fm/<station-id>` — HCloud's "HeshRadio FM" station cards open this app already
 * tuned to a station. Mirrors how HCloud links into HeshGit at `#/repo/<name>`.
 */
const readFmStationIdFromHash = (): string | null => {
  const match = /^#\/fm\/([^/?#]+)/.exec(window.location.hash || '');
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
};

export const App: React.FC = () => {
  // Navigation / View Tabs (a #/fm/<id> deep link opens straight onto the FM deck)
  const [fmStationId, setFmStationId] = useState<string | null>(() => readFmStationIdFromHash());
  const [activeTab, setActiveTab] = useState<ViewTab>(() => (readFmStationIdFromHash() ? 'FM_RADIO' : 'VFO_SDR'));

  useEffect(() => {
    const applyStationRoute = () => {
      const id = readFmStationIdFromHash();
      if (!id) return;
      setFmStationId(id);
      setActiveTab('FM_RADIO');
    };
    window.addEventListener('hashchange', applyStationRoute);
    return () => window.removeEventListener('hashchange', applyStationRoute);
  }, []);

  // Multi-Band VFO & Band Plan State (100 kHz - 1.75 GHz)
  const [currentBand, setCurrentBand] = useState<BandPlan>(() => MASTER_BAND_PLANS[0]);
  const [frequencyMhz, setFrequencyMhz] = useState<number>(27.185);
  const [vfoAFreqMhz, setVfoAFreqMhz] = useState<number>(27.185);
  const [vfoBFreqMhz, setVfoBFreqMhz] = useState<number>(27.185);
  const [activeVfo, setActiveVfo] = useState<'VFO_A' | 'VFO_B'>('VFO_A');
  const [mode, setMode] = useState<ModulationModeExtended>('AM');
  const [stepHz, setStepHz] = useState<number>(10000);

  // Repeater Shift & Split VFO State
  const [repeaterOffsetMode, setRepeaterOffsetMode] = useState<'SIMPLEX' | 'PLUS_OFFSET' | 'MINUS_OFFSET' | 'SPLIT'>('SIMPLEX');
  const [repeaterOffsetMhz, setRepeaterOffsetMhz] = useState<number>(0.0);

  // CTCSS Sub-Audible Tone State
  const [ctcssToneHz, setCtcssToneHz] = useState<number | null>(null);
  const [ctcssSquelchEnabled, setCtcssSquelchEnabled] = useState<boolean>(false);
  const [ctcssResult, setCtcssResult] = useState<CtcssDetectionResult>(() => ({
    detectedToneHz: null,
    detectedToneConfidence: 0,
    tonePowers: new Float32Array(50),
    squelchMatches: true,
  }));

  // CW BFO Pitch & WFM RDS State
  const [cwBfoPitchHz, setCwBfoPitchHz] = useState<number>(700);
  const [rdsData, setRdsData] = useState<RdsStationData>(() => ({
    piCode: '0x1A42',
    programService: 'HESH-FM',
    radioText: 'HIGHWAY TRUCKER ROCK & ROLL // 98.7 FM LIVE',
    programType: 'Classic Rock',
    stereoDetected: true,
  }));

  // Operator Identification
  const [channel, setChannel] = useState<number>(19);
  const corridorId = 'I-80';
  const [operatorHandle, setOperatorHandle] = useState<string>('HESHRADIO-19');
  const [myGridSquare, setMyGridSquare] = useState<string>('CN87uq');

  // Front-Panel Analog Controls
  const [masterVolume, setMasterVolume] = useState<number>(0.80);
  const [squelchDbm, setSquelchDbm] = useState<number>(-98);
  const [rfGainPct, setRfGainPct] = useState<number>(100);
  const [dynamikePct, setDynamikePct] = useState<number>(85);

  // DSP Toggles
  const [anlEnabled, setAnlEnabled] = useState<boolean>(true);
  const rogerBeep: RogerBeepType = 'CLASSIC_2475';
  const [talkbackEnabled, setTalkbackEnabled] = useState<boolean>(false);
  const [autoDuckEnabled, setAutoDuckEnabled] = useState<boolean>(true);

  // PTT & Hardware TOT Watchdog State
  const [pttActive, setPttActive] = useState<boolean>(false);
  const [totRemainingSec, setTotRemainingSec] = useState<number>(180);

  // Live DSP Telemetry
  const [sMeter, setSMeter] = useState<SMeterReading>(() => computeIaruSMeter(-114, 0, 1.15, 27.185));
  const [squelchOpen, setSquelchOpen] = useState<boolean>(false);
  const [duckGain, setDuckGain] = useState<number>(1.0);
  const [activeRxHandle, setActiveRxHandle] = useState<string | null>(null);

  // Network / LAN Clock
  const [utcClock, setUtcClock] = useState<string>('');
  const [quickMessage, setQuickMessage] = useState<string>('');

  // Hardware SDR & Rig Controller Instances
  const dspRef = useRef<HeshRadioDspEngine | null>(null);
  if (!dspRef.current) dspRef.current = new HeshRadioDspEngine();

  const sdrBridgeRef = useRef<RtlSdrHardwareBridge | null>(null);
  if (!sdrBridgeRef.current) sdrBridgeRef.current = new RtlSdrHardwareBridge();
  const [sdrStatus, setSdrStatus] = useState<RtlSdrStatus>(() => sdrBridgeRef.current!.getStatus());

  const rigControllerRef = useRef<RigController | null>(null);
  if (!rigControllerRef.current) rigControllerRef.current = new RigController();
  const [rigStatus, setRigStatus] = useState<RigStatus>(() => rigControllerRef.current!.getStatus());

  const wsRef = useRef<WebSocket | null>(null);
  const wsSettingsRef = useRef({ masterVolume, anlEnabled, rogerBeep });
  const pttStartTimestampRef = useRef<number>(0);

  // Tactical Scanner & Cockpit Black Box Recorder Instances
  const [scanEngine] = useState(() => new ScanEngine());
  const blackBoxRef = useRef<BlackBoxRecorder>(new BlackBoxRecorder(48000, 30));

  const [trafficLog, setTrafficLog] = useState<TrafficLogEntry[]>(() => [
    {
      id: 'init-1',
      utcTime: new Date().toISOString().slice(11, 19) + 'Z',
      handle: 'Iron Horse 402',
      corridor: 'I-80 TRANSCON',
      channelLabel: 'CH 19',
      freqMhz: '27.185',
      mode: 'AM',
      rstOrSignal: 'S9+6dB',
      message: 'Breaker 1-9, watch your foot westbound at the 142 yardstick, full-grown bear in median shooting laser.',
    },
    {
      id: 'init-2',
      utcTime: new Date().toISOString().slice(11, 19) + 'Z',
      handle: 'Diesel Doctor',
      corridor: 'I-80 TRANSCON',
      channelLabel: 'CH 19',
      freqMhz: '27.185',
      mode: 'AM',
      rstOrSignal: 'S8',
      message: 'Eastbound is clean and green all the way to exit 118 Flying J.',
    },
  ]);

  // UTC Clock
  useEffect(() => {
    const updateClock = () => setUtcClock(new Date().toISOString().slice(11, 19) + ' UTC');
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, []);

  // RigController Status Listener
  useEffect(() => {
    if (rigControllerRef.current) {
      rigControllerRef.current.onStatusUpdate((status) => {
        setRigStatus(status);
        if (status.vfoAFreqHz > 0 && Math.abs(status.vfoAFreqHz / 1e6 - frequencyMhz) > 0.001) {
          const newMhz = parseFloat((status.vfoAFreqHz / 1e6).toFixed(6));
          setFrequencyMhz(newMhz);
          setVfoAFreqMhz(newMhz);
        }
      });
    }
  }, [frequencyMhz]);

  // Keep the latest RX settings for the WebSocket relay handler so the socket
  // is not torn down and reconnected on every volume/ANL change.
  useEffect(() => {
    wsSettingsRef.current = { masterVolume, anlEnabled, rogerBeep };
  }, [masterVolume, anlEnabled, rogerBeep]);

  // Connect to LAN / Embedded Vite WebSocket CB Relay (Local Dev or Configured Relay Only)
  useEffect(() => {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.endsWith('.local'));

    const customRelayUrl = (import.meta as any).env?.VITE_WS_CB_URL;

    // Do not attempt to connect to static web servers that do not host a WebSocket daemon
    if (!customRelayUrl && !isLocalhost) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = customRelayUrl || `${proto}//${window.location.host}/ws-cb`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onerror = () => {
        // Silent graceful fallback if local Vite relay daemon is inactive
      };

      ws.onmessage = async (event) => {
        try {
          const textData =
            typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
          const msg = JSON.parse(textData);

          if (msg.type === 'CB_TRANSMISSION') {
            const entry: TrafficLogEntry = {
              id: 'ws-' + Date.now(),
              utcTime: new Date().toISOString().slice(11, 19) + 'Z',
              handle: msg.handle || 'LAN Rig',
              corridor: msg.corridor || 'LOCAL LAN',
              channelLabel: msg.channel ? `CH ${String(msg.channel).padStart(2, '0')}` : 'VFO SPOT',
              freqMhz: msg.freqMhz || (CB_CHANNELS[(msg.channel || 19) - 1]?.frequencyMhz || 27.185).toFixed(3),
              mode: msg.mode || 'AM',
              rstOrSignal: 'S9+20dB',
              message: msg.text,
            };
            setTrafficLog((prev) => [entry, ...prev.slice(0, 39)]);

            if (dspRef.current) {
              await dspRef.current.initAudioContext();
              setActiveRxHandle(entry.handle);
              const rxSettings = wsSettingsRef.current;
              dspRef.current.triggerIncomingTransmission(
                parseFloat(entry.freqMhz),
                -53,
                msg.text,
                108,
                rxSettings.masterVolume,
                rxSettings.anlEnabled,
                rxSettings.rogerBeep,
                null,
                () => setActiveRxHandle(null)
              );
            }
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (ws) {
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
      }
    };
  }, []);

  // 60-120Hz Real-Time DSP Step Loop
  useEffect(() => {
    let animId = 0;
    const tick = () => {
      if (dspRef.current) {
        const res = dspRef.current.stepDspFrame({
          currentFreqMhz: frequencyMhz,
          spanMhz: currentBand.frequencyMaxMhz - currentBand.frequencyMinMhz,
          mode,
          pttActive,
          squelchThresholdDbm: squelchDbm,
          rfGainPct,
          dynamikePct,
          anlEnabled,
          masterVolume,
          autoDuckEnabled,
          ctcssToneHz,
          ctcssSquelchEnabled,
          cwBfoPitchHz,
        });
        setSMeter(res.sMeter);
        setSquelchOpen(res.squelchOpen);
        setDuckGain(res.duckGain);
        setRdsData(res.rdsData);
        setCtcssResult(res.ctcssResult);

        // Real-Time Scanner & Black Box Recorder Squelch Sync
        scanEngine.notifySquelchState(res.squelchOpen);
        blackBoxRef.current.notifySquelch(
          res.squelchOpen,
          frequencyMhz,
          `${frequencyMhz.toFixed(3)} MHz`,
          mode,
          res.sMeter.powerDbm
        );
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [
    frequencyMhz,
    currentBand,
    mode,
    pttActive,
    squelchDbm,
    rfGainPct,
    dynamikePct,
    anlEnabled,
    masterVolume,
    autoDuckEnabled,
    ctcssToneHz,
    ctcssSquelchEnabled,
    cwBfoPitchHz,
    scanEngine,
  ]);

  // Frequency Tuning Handler
  const handleFrequencyChange = useCallback(
    (newFreqMhz: number) => {
      setFrequencyMhz(newFreqMhz);
      if (activeVfo === 'VFO_A') {
        setVfoAFreqMhz(newFreqMhz);
      } else {
        setVfoBFreqMhz(newFreqMhz);
      }

      // Check if frequency matches any CB channel (1-40)
      const matchedCb = CB_CHANNELS.find(
        (ch) => Math.abs(ch.frequencyMhz - newFreqMhz) < 0.002
      );
      if (matchedCb) {
        setChannel(matchedCb.channel);
      }

      // Sync hardware SDR and Rig CAT
      if (sdrBridgeRef.current) {
        sdrBridgeRef.current.setFrequency(Math.round(newFreqMhz * 1e6));
      }
      if (rigControllerRef.current) {
        rigControllerRef.current.setFrequency(Math.round(newFreqMhz * 1e6), activeVfo);
      }

      // Auto update current band if tuned frequency crosses band boundaries
      const matchedBand = findBandPlanForFrequency(newFreqMhz);
      if (matchedBand && matchedBand.id !== currentBand.id) {
        setCurrentBand(matchedBand);
      }
    },
    [activeVfo, currentBand]
  );

  // Band Selection Handler
  const handleSelectBand = useCallback((band: BandPlan) => {
    setCurrentBand(band);
    setFrequencyMhz(band.centerFrequencyMhz);
    if (activeVfo === 'VFO_A') {
      setVfoAFreqMhz(band.centerFrequencyMhz);
    } else {
      setVfoBFreqMhz(band.centerFrequencyMhz);
    }
    setMode(band.defaultMode);
    setStepHz(band.defaultStepHz);
    setRepeaterOffsetMhz(band.standardRepeaterOffsetMhz);
    setRepeaterOffsetMode(band.standardRepeaterOffsetMhz !== 0 ? 'PLUS_OFFSET' : 'SIMPLEX');

    if (sdrBridgeRef.current) {
      sdrBridgeRef.current.setFrequency(Math.round(band.centerFrequencyMhz * 1e6));
    }
    if (rigControllerRef.current) {
      rigControllerRef.current.setFrequency(Math.round(band.centerFrequencyMhz * 1e6));
      rigControllerRef.current.setMode(band.defaultMode);
    }
  }, [activeVfo]);

  // Mode Selection Handler
  const handleModeChange = useCallback((newMode: ModulationModeExtended) => {
    setMode(newMode);
    if (rigControllerRef.current) {
      rigControllerRef.current.setMode(newMode);
    }
  }, []);

  // VFO Switcher Handler
  const handleVfoSwitch = useCallback(() => {
    const nextVfo = activeVfo === 'VFO_A' ? 'VFO_B' : 'VFO_A';
    setActiveVfo(nextVfo);
    const targetFreq = nextVfo === 'VFO_A' ? vfoAFreqMhz : vfoBFreqMhz;
    setFrequencyMhz(targetFreq);
    if (rigControllerRef.current) {
      rigControllerRef.current.switchActiveVfo();
    }
  }, [activeVfo, vfoAFreqMhz, vfoBFreqMhz]);

  // VFO Copy Handler (A->B or B->A)
  const handleVfoCopy = useCallback(() => {
    if (activeVfo === 'VFO_A') {
      setVfoBFreqMhz(vfoAFreqMhz);
    } else {
      setVfoAFreqMhz(vfoBFreqMhz);
    }
    if (rigControllerRef.current) {
      rigControllerRef.current.copyVfoAtoB();
    }
  }, [activeVfo, vfoAFreqMhz, vfoBFreqMhz]);

  // Direct Tune from FM Directory (or AM station header) to VFO
  const handleTuneFmToVfo = useCallback((targetFreqMhz: number) => {
    const matchedBand = findBandPlanForFrequency(targetFreqMhz);
    const targetBand =
      matchedBand ||
      MASTER_BAND_PLANS.find((b) => b.id === 'fm-broadcast') ||
      MASTER_BAND_PLANS[0];
    // Follow the matched plan's default mode (AM for 535-1705 kHz MW,
    // WFM for FM broadcast, ...) instead of forcing WFM everywhere.
    const targetMode: ModulationModeExtended = matchedBand ? matchedBand.defaultMode : 'WFM';
    setCurrentBand(targetBand);
    setFrequencyMhz(targetFreqMhz);
    setVfoAFreqMhz(targetFreqMhz);
    setMode(targetMode);
    setActiveTab('VFO_SDR');
    if (sdrBridgeRef.current) {
      sdrBridgeRef.current.setFrequency(Math.round(targetFreqMhz * 1e6));
    }
    if (rigControllerRef.current) {
      rigControllerRef.current.setFrequency(Math.round(targetFreqMhz * 1e6));
      rigControllerRef.current.setMode(targetMode);
    }
  }, []);

  // Fail-Safe PTT Start & Stop with Hardware TOT Watchdog
  const startPtt = useCallback(async () => {
    if (pttActive || !dspRef.current) return;
    scanEngine.stopScan();
    dspRef.current.stopIncomingTransmission();
    setActiveRxHandle(null);

    await dspRef.current.initAudioContext();
    await dspRef.current.enableMicrophone(talkbackEnabled);
    dspRef.current.setTalkbackVolume(talkbackEnabled, true);
    dspRef.current.playMicClick();

    if (mode === 'CW') {
      dspRef.current.setCwSidetone(true, cwBfoPitchHz);
    }

    // Key Physical Rig via Serial RTS/DTR, CM108 GPIO, or CAT Command
    if (rigControllerRef.current) {
      await rigControllerRef.current.setTransmit(true);
    }

    pttStartTimestampRef.current = performance.now();
    setTotRemainingSec(180);
    setPttActive(true);
  }, [pttActive, talkbackEnabled, mode, cwBfoPitchHz, scanEngine]);

  const stopPtt = useCallback(
    (spokenOverride?: string) => {
      if (!pttActive || !dspRef.current) return;
      setPttActive(false);
      setTotRemainingSec(180);
      dspRef.current.setTalkbackVolume(talkbackEnabled, false);
      if (mode === 'CW') {
        dspRef.current.setCwSidetone(false);
      }
      dspRef.current.playRogerBeepAndSquelchTail(rogerBeep, masterVolume);

      // Unkey Physical Rig via Hardware Interface
      if (rigControllerRef.current) {
        rigControllerRef.current.setTransmit(false);
      }

      const heldMs = performance.now() - pttStartTimestampRef.current;
      if (heldMs > 350 || spokenOverride) {
        const msgText =
          spokenOverride ||
          quickMessage.trim() ||
          `Breaker on ${frequencyMhz.toFixed(3)} MHz ${mode}, this is ${operatorHandle} requesting a signal check!`;

        const selfEntry: TrafficLogEntry = {
          id: 'tx-' + Date.now(),
          utcTime: new Date().toISOString().slice(11, 19) + 'Z',
          handle: operatorHandle,
          corridor: HIGHWAY_CORRIDORS.find((c) => c.id === corridorId)?.code || 'I-80 TRANSCON',
          channelLabel: currentBand.category === 'CB' ? `CH ${String(channel).padStart(2, '0')}` : `${currentBand.name.split(' ')[0]} VFO`,
          freqMhz: frequencyMhz.toFixed(3),
          mode,
          rstOrSignal: 'TX 4.0W',
          message: msgText,
          isSelf: true,
        };
        setTrafficLog((prev) => [selfEntry, ...prev.slice(0, 39)]);
        if (!spokenOverride) setQuickMessage('');

        // Broadcast over LAN WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'CB_TRANSMISSION',
              handle: operatorHandle,
              corridor: selfEntry.corridor,
              channel,
              freqMhz: frequencyMhz.toFixed(3),
              mode,
              text: msgText,
            })
          );
        }
      }
    },
    [
      pttActive,
      talkbackEnabled,
      mode,
      rogerBeep,
      masterVolume,
      quickMessage,
      frequencyMhz,
      operatorHandle,
      corridorId,
      currentBand,
      channel,
    ]
  );

  // Mandatory Safety Rule: Hardware Panic-Unkey Watchdog
  const triggerPanicUnkey = useCallback(() => {
    console.warn('[Safety] Emergency Panic-Unkey Triggered!');
    if (rigControllerRef.current) {
      rigControllerRef.current.setTransmit(false, 'Emergency Panic Unkey');
    }
    stopPtt('[PANIC UNKEY ARMED]');
  }, [stopPtt]);

  // TOT (Time-Out-Timer) Watchdog Loop
  useEffect(() => {
    if (!pttActive) return;
    const interval = window.setInterval(() => {
      const elapsedSec = Math.floor((performance.now() - pttStartTimestampRef.current) / 1000);
      const remaining = Math.max(0, 180 - elapsedSec);
      setTotRemainingSec(remaining);
      if (remaining === 0) {
        console.warn('[TOT Watchdog] 180s Time-Out Exceeded! Fail-safe unkey.');
        stopPtt('[TOT 180s TIMEOUT]');
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [pttActive, stopPtt]);

  // Digital Mode Modem Audio Transmit & Hardware CAT PTT Automation
  const handleTransmitDigitalAudio = useCallback(async (samples: Float32Array) => {
    if (!dspRef.current) return;
    try {
      await dspRef.current.initAudioContext();
      if (rigControllerRef.current) {
        rigControllerRef.current.setTransmit(true, 'Digital Mode Modem');
      }
      // Reset the hardware TOT watchdog clock so a stale voice-PTT timestamp
      // (or page uptime) does not instantly unkey the digital transmission.
      pttStartTimestampRef.current = performance.now();
      setTotRemainingSec(180);
      setPttActive(true);

      dspRef.current.playPcmBuffer(samples, 48000, 0.85);

      const durationMs = (samples.length / 48000) * 1000;
      setTimeout(() => {
        if (rigControllerRef.current) {
          rigControllerRef.current.setTransmit(false, 'Digital Audio Complete');
        }
        setPttActive(false);
      }, durationMs + 80);
    } catch (err) {
      console.error('[Digital TX Error]', err);
      if (rigControllerRef.current) {
        rigControllerRef.current.setTransmit(false, 'Digital TX Error');
      }
      setPttActive(false);
    }
  }, []);

  // Automatic ADIF 3.1.4 Logging
  const handleLogDigitalQso = useCallback((contact: { call: string; band: string; freq: string; mode: string; rst: string; grid: string }) => {
    const logger = new AdifLogger();
    const now = new Date();
    const qsoDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeOn = now.toISOString().slice(11, 19).replace(/:/g, '');
    logger.addRecord({
      call: contact.call,
      qsoDate,
      timeOn,
      band: contact.band,
      freqMhz: contact.freq,
      mode: contact.mode,
      rstSent: contact.rst,
      rstRcvd: contact.rst,
      gridSquare: contact.grid,
      myGridSquare,
      operator: operatorHandle,
      comment: 'Logged from HeshRadio Tactical Suite',
    });
  }, [myGridSquare, operatorHandle]);

  // One-click Promote Highway Dispatch Spot to ADIF
  const handlePromoteSpotToAdif = useCallback((spot: TrafficLogEntry) => {
    // Derive the band from the spot's own frequency, not the current VFO,
    // so a spot logged while tuned elsewhere gets a consistent BAND/FREQ pair.
    const spotFreqMhz = parseFloat(spot.freqMhz) || frequencyMhz;
    const band = bandForFrequency(spotFreqMhz);
    handleLogDigitalQso({
      call: spot.handle,
      band,
      freq: spot.freqMhz,
      mode: spot.mode,
      rst: spot.rstOrSignal.includes('S') ? '59' : '599',
      grid: myGridSquare,
    });
    alert(`Logged spot from "${spot.handle}" at ${spot.freqMhz} MHz to ADIF Logbook!`);
  }, [frequencyMhz, handleLogDigitalQso, myGridSquare]);

  // Memory Channel Quick Tuning
  const handleTuneMemoryChannel = useCallback((ch: MemoryChannel) => {
    handleFrequencyChange(ch.frequencyMhz);
    setMode(ch.mode);
    if (ch.ctcssToneHz) {
      setCtcssToneHz(ch.ctcssToneHz);
      setCtcssSquelchEnabled(true);
    } else {
      setCtcssToneHz(null);
      setCtcssSquelchEnabled(false);
    }
    if (ch.repeaterOffsetMhz !== 0) {
      setRepeaterOffsetMhz(Math.abs(ch.repeaterOffsetMhz));
      setRepeaterOffsetMode(ch.repeaterOffsetMhz > 0 ? 'PLUS_OFFSET' : 'MINUS_OFFSET');
    } else {
      setRepeaterOffsetMode('SIMPLEX');
    }
  }, [handleFrequencyChange]);

  // Audio Buffer Playback Handler
  const handlePlayBufferAudio = useCallback(async (samples: Float32Array) => {
    if (!dspRef.current) return;
    try {
      await dspRef.current.initAudioContext();
      dspRef.current.playPcmBuffer(samples, 48000, masterVolume);
    } catch (err) {
      console.error('[Audio Buffer Playback Error]', err);
    }
  }, [masterVolume]);

  // Panic Unkey on Window Blur
  useEffect(() => {
    const handleBlur = () => {
      if (pttActive) {
        console.warn('[Safety] Window blur detected! Triggering panic unkey.');
        triggerPanicUnkey();
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [pttActive, triggerPanicUnkey]);

  // Spacebar Push-To-Talk
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        startPtt();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        stopPtt();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startPtt, stopPtt]);

  // Quick Dispatch Spot Submission
  const handleSendQuickSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessage.trim()) return;
    const textToSend = quickMessage.trim();
    setQuickMessage('');
    if (dspRef.current) {
      await dspRef.current.initAudioContext();
      dspRef.current.playRogerBeepAndSquelchTail(rogerBeep, masterVolume);
    }
    const entry: TrafficLogEntry = {
      id: 'msg-' + Date.now(),
      utcTime: new Date().toISOString().slice(11, 19) + 'Z',
      handle: operatorHandle,
      corridor: HIGHWAY_CORRIDORS.find((c) => c.id === corridorId)?.code || 'I-80 TRANSCON',
      channelLabel: `${frequencyMhz.toFixed(3)} MHz`,
      freqMhz: frequencyMhz.toFixed(3),
      mode,
      rstOrSignal: 'TX 4.0W',
      message: textToSend,
      isSelf: true,
    };
    setTrafficLog((prev) => [entry, ...prev.slice(0, 39)]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'CB_TRANSMISSION',
          handle: operatorHandle,
          corridor: entry.corridor,
          channel,
          freqMhz: frequencyMhz.toFixed(3),
          mode,
          text: textToSend,
        })
      );
    }
  };

  return (
    <div className="heshradio-shell">
      {/* 1. TOP TACTICAL TELEMETRY HEADER */}
      <TacticalHeader
        pttActive={pttActive}
        squelchOpen={squelchOpen}
        activeRxHandle={activeRxHandle}
        operatorHandle={operatorHandle}
        onOperatorHandleChange={setOperatorHandle}
        sdrStatus={sdrStatus}
        rigStatus={rigStatus}
        utcClock={utcClock}
        onPanicUnkey={triggerPanicUnkey}
      />

      {/* 2. MODERN 2-TIER WORKSPACE NAVIGATION */}
      <CategoryTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        frequencyMhz={frequencyMhz}
        mode={mode}
        currentBandName={currentBand.name}
        trafficSpotsCount={trafficLog.length}
      />

      {/* 3. MAIN WORKSPACE CONTENT */}
      <main className="flex flex-col gap-4">
        {/* TAB 1: MULTI-BAND VFO & SDR RECEIVER */}
        {activeTab === 'VFO_SDR' && (
          <div className="flex flex-col gap-4">
            <MultiBandVfoDeck
              currentBand={currentBand}
              frequencyMhz={frequencyMhz}
              vfoAFreqMhz={vfoAFreqMhz}
              vfoBFreqMhz={vfoBFreqMhz}
              activeVfo={activeVfo}
              mode={mode}
              stepHz={stepHz}
              repeaterOffsetMode={repeaterOffsetMode}
              repeaterOffsetMhz={repeaterOffsetMhz}
              ctcssToneHz={ctcssToneHz}
              ctcssSquelchEnabled={ctcssSquelchEnabled}
              ctcssResult={ctcssResult}
              cwBfoPitchHz={cwBfoPitchHz}
              rdsData={rdsData}
              onSelectBand={handleSelectBand}
              onFrequencyChange={handleFrequencyChange}
              onModeChange={handleModeChange}
              onStepChange={setStepHz}
              onVfoSwitch={handleVfoSwitch}
              onVfoCopy={handleVfoCopy}
              onRepeaterOffsetModeChange={setRepeaterOffsetMode}
              onRepeaterOffsetMhzChange={setRepeaterOffsetMhz}
              onCtcssToneChange={setCtcssToneHz}
              onCtcssSquelchToggle={setCtcssSquelchEnabled}
              onCwBfoPitchChange={setCwBfoPitchHz}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8">
                <WaterfallDisplay
                  spectrumDb={dspRef.current.spectrumDb}
                  peakHoldDb={dspRef.current.peakHoldDb}
                  currentChannel={channel}
                  frequencyMhz={frequencyMhz}
                  spanMhz={currentBand.frequencyMaxMhz - currentBand.frequencyMinMhz}
                  band={currentBand}
                  mode={mode}
                  pttActive={pttActive}
                  squelchThresholdDbm={squelchDbm}
                  onFrequencyClick={handleFrequencyChange}
                  onSelectChannel={(ch) => {
                    const info = CB_CHANNELS[ch - 1];
                    if (info) handleFrequencyChange(info.frequencyMhz);
                  }}
                />
              </div>

              <div className="lg:col-span-4 flex flex-col gap-4">
                <section className="panel smeter-panel flex flex-col justify-between" aria-label="IARU S-Meter and Signal Telemetry">
                  <div className="panel-header">
                    <div className="panel-title-group">
                      <span className="status-led led-amber" />
                      <h2 className="panel-title">IARU S-METER &amp; RF TELEMETRY</h2>
                    </div>
                    <span className="badge-mono">{frequencyMhz > 30 ? '-93 dBm S9' : '-73 dBm S9'}</span>
                  </div>
                  <SMeterDisplay
                    reading={sMeter}
                    pttActive={pttActive}
                    squelchOpen={squelchOpen}
                    mode={mode as ModulationMode}
                  />
                </section>

                {/* Tactical PTT Action Deck */}
                <section className="panel ptt-panel space-y-4" aria-label="Tactical PTT Action Deck">
                  <div className="panel-header">
                    <div className="panel-title-group">
                      <span className={`status-led ${pttActive ? 'led-red' : 'led-emerald'}`} />
                      <h2 className="panel-title">TRANSMIT &amp; PTT ENGINE</h2>
                    </div>
                    <span className="badge-mono">TOT: {totRemainingSec}s</span>
                  </div>

                  <button
                    type="button"
                    className={`w-full py-4 px-4 rounded-xl font-mono font-bold text-sm border-2 transition-all flex flex-col items-center justify-center gap-1.5 shadow-lg cursor-pointer ${
                      pttActive
                        ? 'bg-red-600 border-red-400 text-white shadow-red-600/40 animate-pulse'
                        : 'bg-gradient-to-b from-zinc-800 to-zinc-900 hover:from-amber-500/20 hover:to-zinc-800 text-amber-300 border-zinc-700 hover:border-amber-400'
                    }`}
                    onMouseDown={startPtt}
                    onMouseUp={() => stopPtt()}
                    onMouseLeave={() => { if (pttActive) stopPtt(); }}
                    onTouchStart={(e) => { e.preventDefault(); startPtt(); }}
                    onTouchEnd={(e) => { e.preventDefault(); stopPtt(); }}
                  >
                    <span>{pttActive ? '● TRANSMITTING (RELEASE TO UNKEY)' : 'HOLD TO TALK (SPACEBAR)'}</span>
                    <span className="text-[11px] font-normal opacity-80">
                      {pttActive
                        ? `TX on ${(rigControllerRef.current?.getEffectiveTransmitFrequencyHz() || frequencyMhz * 1e6) / 1e6} MHz`
                        : `Tuned: ${frequencyMhz.toFixed(4)} MHz ${mode}`}
                    </span>
                  </button>

                  {/* Clean Visual Space & Uniform Grid After PTT Action Button */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setTalkbackEnabled((v) => !v)}
                      className={`py-2.5 px-3.5 rounded-lg border text-center font-bold cursor-pointer transition-colors ${
                        talkbackEnabled
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      TALKBACK: {talkbackEnabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnlEnabled((v) => !v)}
                      className={`py-2.5 px-3.5 rounded-lg border text-center font-bold cursor-pointer transition-colors ${
                        anlEnabled
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      ANL LIMITER: {anlEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* TAB: FM & ONLINE RADIO PLAYER */}
        {activeTab === 'FM_RADIO' && (
          <FmRadioPlayerDeck
            duckGain={duckGain}
            autoDuckEnabled={autoDuckEnabled}
            onToggleAutoDuck={() => setAutoDuckEnabled((v) => !v)}
            onTuneTransceiverVfo={handleTuneFmToVfo}
            initialStationId={fmStationId}
          />
        )}

        {/* TAB: TACTICAL HIGH-SPEED SCANNER & MEMORY BANKS */}
        {activeTab === 'SCANNER' && (
          <Suspense fallback={<DeckLoadingFallback />}>
            <TacticalScannerDeck
              scanEngine={scanEngine}
              currentFreqMhz={frequencyMhz}
              onTuneChannel={handleTuneMemoryChannel}
            />
          </Suspense>
        )}

        {/* TAB: NOAA WEATHER ALL-HAZARDS & EAS SAME DECODER */}
        {activeTab === 'NOAA_EAS' && (
          <Suspense fallback={<DeckLoadingFallback />}>
            <NoaaEmergencyDeck
              onTransmitAudio={handlePlayBufferAudio}
              onTuneNoaaChannel={(freq) => handleFrequencyChange(freq)}
            />
          </Suspense>
        )}

        {/* TAB: COCKPIT BLACK BOX RECORDER & INSTANT REPLAY */}
        {activeTab === 'BLACK_BOX' && (
          <Suspense fallback={<DeckLoadingFallback />}>
            <BlackBoxRecorderDeck
              recorder={blackBoxRef.current}
              onPlayBuffer={handlePlayBufferAudio}
            />
          </Suspense>
        )}

        {/* TAB: RF & AUDIO LABORATORY CALIBRATION SUITE */}
        {activeTab === 'LAB_SUITE' && (
          <Suspense fallback={<DeckLoadingFallback />}>
            <LaboratorySignalDeck
              onPlayBuffer={handlePlayBufferAudio}
            />
          </Suspense>
        )}

        {/* TAB: DIGITAL MODES (APRS / FT8 / SSTV) */}
        {activeTab === 'DIGITAL_MODES' && (
          <Suspense fallback={<DeckLoadingFallback />}>
            <DigitalModesDeck
              myCallsign={operatorHandle}
              myGridSquare={myGridSquare}
              currentFreqMhz={frequencyMhz}
              onTransmitAudio={handleTransmitDigitalAudio}
              onLogQso={handleLogDigitalQso}
            />
          </Suspense>
        )}

        {/* TAB: SPACE WEATHER & IONOSPHERIC PROPAGATION */}
        {activeTab === 'PROPAGATION' && (
          <Suspense fallback={<DeckLoadingFallback />}>
            <SolarPropagationDeck
              myGridSquare={myGridSquare}
              onMyGridChange={setMyGridSquare}
            />
          </Suspense>
        )}

        {/* TAB: ADIF 3.1.4 ELECTRONIC QSO LOGBOOK */}
        {activeTab === 'ADIF_LOG' && (
          <Suspense fallback={<DeckLoadingFallback />}>
            <AdifQsoLogDeck
              currentFreqMhz={frequencyMhz}
              currentMode={mode}
              myGridSquare={myGridSquare}
              operatorHandle={operatorHandle}
            />
          </Suspense>
        )}

        {/* TAB: HARDWARE RTL-SDR & RIG CONTROLLER */}
        {activeTab === 'HARDWARE_RIG' && (
          <div className="flex flex-col gap-4">
            <Suspense fallback={<DeckLoadingFallback />}>
              <RtlSdrControlPanel
                sdrBridge={sdrBridgeRef.current!}
                sdrStatus={sdrStatus}
                onStatusChange={setSdrStatus}
              />
              <RigControllerPanel
                rigController={rigControllerRef.current!}
                rigStatus={rigStatus}
                onStatusChange={setRigStatus}
                onPanicUnkey={triggerPanicUnkey}
              />
            </Suspense>

            {/* Hardware Interface Reference Diagram */}
            <section className="panel hardware-ref-panel font-mono text-xs text-zinc-300 space-y-2" aria-label="Hardware Wiring Reference">
              <div className="panel-header">
                <div className="panel-title-group">
                  <span className="status-led led-cyan" />
                  <h2 className="panel-title">PLUG-AND-PLAY HARDWARE WIRING REFERENCE</h2>
                </div>
                <span className="badge-mono">WINDOWS &amp; ANDROID USB-OTG</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-zinc-400 pt-1">
                <div className="p-3.5 bg-black/40 rounded-xl border border-zinc-800/80">
                  <div className="text-zinc-200 font-bold mb-1">RTL-SDR V4 / V3 Dongle</div>
                  <div>• Windows: Plug into any USB 2.0/3.0 port (Direct WebUSB pairing in Chrome/Edge).</div>
                  <div>• Android (Samsung S26 Ultra): USB-C OTG cable; direct device descriptor.</div>
                  <div>• Sample Rate: 2.048 MS/s zero-drop baseband.</div>
                </div>
                <div className="p-3.5 bg-black/40 rounded-xl border border-zinc-800/80">
                  <div className="text-zinc-200 font-bold mb-1">Digirig Mobile &amp; SignaLink</div>
                  <div>• PTT Keying: Serial RTS pin high on TX, low on RX.</div>
                  <div>• Audio: 300–3000 Hz USB soundcard with 4:1 soft-knee Dynamike compressor.</div>
                  <div>• CM108 GPIO3: Hardware pin 13 bit 2 toggle for zero-VOX latency.</div>
                </div>
                <div className="p-3.5 bg-black/40 rounded-xl border border-zinc-800/80">
                  <div className="text-zinc-200 font-bold mb-1">Hamlib rigctld &amp; CAT</div>
                  <div>• Default rigctld TCP: 127.0.0.1:4532 via embedded bridge.</div>
                  <div>• Kenwood/Elecraft/Xiegu: 38400 baud, 8N1 ASCII FA;/MD;/TX;.</div>
                  <div>• Icom CI-V: Packed Little-Endian BCD 0xFE 0xFE &lt;Addr&gt; 0xE0 ... 0xFD.</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB: HIGHWAY QSO & TRAFFIC LOG */}
        {activeTab === 'TRAFFIC_LOG' && (
          <HighwayDispatchDeck
            trafficLog={trafficLog}
            quickMessage={quickMessage}
            onQuickMessageChange={setQuickMessage}
            onSendSpot={handleSendQuickSpot}
            frequencyMhz={frequencyMhz}
            mode={mode}
            onLogQso={handlePromoteSpotToAdif}
          />
        )}

        {/* 4. FRONT-PANEL ANALOG CONTROLS (Always visible at bottom) */}
        <AnalogControlKnobs
          masterVolume={masterVolume}
          onMasterVolumeChange={setMasterVolume}
          squelchDbm={squelchDbm}
          onSquelchDbmChange={setSquelchDbm}
          rfGainPct={rfGainPct}
          onRfGainPctChange={setRfGainPct}
          dynamikePct={dynamikePct}
          onDynamikePctChange={setDynamikePct}
        />
      </main>

      {/* 5. SAMSUNG GALAXY S26 ULTRA MOBILE TACTICAL COCKPIT & OVERSIZED THUMB PTT */}
      <MobileTacticalCockpit
        currentFreqMhz={frequencyMhz}
        currentMode={mode}
        pttActive={pttActive}
        totRemainingSec={totRemainingSec}
        squelchOpen={squelchOpen}
        onFrequencyChange={handleFrequencyChange}
        onStartPtt={startPtt}
        onStopPtt={stopPtt}
        onPanicUnkey={triggerPanicUnkey}
      />
    </div>
  );
};

export default App;
