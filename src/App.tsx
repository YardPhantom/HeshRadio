import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { InternetRadioDeck } from './components/InternetRadioDeck';
import { MultiBandVfoDeck } from './components/MultiBandVfoDeck';
import { RtlSdrControlPanel } from './components/RtlSdrControlPanel';
import { RigControllerPanel } from './components/RigControllerPanel';
import { DigitalModesDeck } from './components/DigitalModesDeck';
import { SolarPropagationDeck } from './components/SolarPropagationDeck';
import { AdifQsoLogDeck } from './components/AdifQsoLogDeck';
import { TacticalScannerDeck } from './components/TacticalScannerDeck';
import { NoaaEmergencyDeck } from './components/NoaaEmergencyDeck';
import { BlackBoxRecorderDeck } from './components/BlackBoxRecorderDeck';
import { LaboratorySignalDeck } from './components/LaboratorySignalDeck';
import { MobileTacticalCockpit } from './components/MobileTacticalCockpit';
import { AdifLogger } from './radio/adifLogger';
import { ScanEngine, MemoryChannel } from './radio/scanEngine';
import { BlackBoxRecorder } from './radio/blackBoxRecorder';
import { CURRENT_VERSION } from './version';
import {
  Radio,
  Cpu,
  Cable,
  Music,
  ListFilter,
  ShieldAlert,
  Zap,
  Mic,
  Activity,
  Sun,
  BookOpen,
  FastForward,
  HardDrive,
  Wrench,
} from 'lucide-react';

interface TrafficLogEntry {
  id: string;
  utcTime: string;
  handle: string;
  corridor: string;
  channelLabel: string;
  freqMhz: string;
  mode: ModulationModeExtended;
  rstOrSignal: string;
  message: string;
  isSelf?: boolean;
}

export type ViewTab =
  | 'VFO_SDR'
  | 'SCANNER'
  | 'NOAA_EAS'
  | 'BLACK_BOX'
  | 'LAB_SUITE'
  | 'DIGITAL_MODES'
  | 'PROPAGATION'
  | 'ADIF_LOG'
  | 'HARDWARE_RIG'
  | 'INTERNET_RADIO'
  | 'TRAFFIC_LOG';

export const App: React.FC = () => {
  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState<ViewTab>('VFO_SDR');

  type WorkspaceCategory = 'TRANSCEIVER' | 'SCAN_ALERTS' | 'VOICE_AUDIO' | 'DIGITAL_WX' | 'HARDWARE_LAB';

  const getCategoryForTab = (tab: ViewTab): WorkspaceCategory => {
    switch (tab) {
      case 'VFO_SDR':
        return 'TRANSCEIVER';
      case 'SCANNER':
      case 'NOAA_EAS':
        return 'SCAN_ALERTS';
      case 'BLACK_BOX':
      case 'INTERNET_RADIO':
      case 'TRAFFIC_LOG':
        return 'VOICE_AUDIO';
      case 'DIGITAL_MODES':
      case 'PROPAGATION':
      case 'ADIF_LOG':
        return 'DIGITAL_WX';
      case 'HARDWARE_RIG':
      case 'LAB_SUITE':
        return 'HARDWARE_LAB';
    }
  };

  const activeCategory = getCategoryForTab(activeTab);

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

  // Classic CB Channel Selector Compatibility
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

  // Connect to LAN / Embedded Vite WebSocket CB Relay
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws-cb`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

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
              dspRef.current.triggerIncomingTransmission(
                parseFloat(entry.freqMhz),
                -53,
                msg.text,
                108,
                masterVolume,
                anlEnabled,
                rogerBeep,
                null,
                () => setActiveRxHandle(null)
              );
            }
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (ws) ws.close();
    };
  }, [masterVolume, anlEnabled, rogerBeep]);

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
  ]);

  // Frequency change handler (coordinates VFO A/B, RigController, RTL-SDR Bridge)
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

  const handleModeChange = useCallback((newMode: ModulationModeExtended) => {
    setMode(newMode);
    if (rigControllerRef.current) {
      rigControllerRef.current.setMode(newMode);
    }
  }, []);

  const handleVfoSwitch = useCallback(() => {
    const nextVfo = activeVfo === 'VFO_A' ? 'VFO_B' : 'VFO_A';
    setActiveVfo(nextVfo);
    const targetFreq = nextVfo === 'VFO_A' ? vfoAFreqMhz : vfoBFreqMhz;
    setFrequencyMhz(targetFreq);
    if (rigControllerRef.current) {
      rigControllerRef.current.switchActiveVfo();
    }
  }, [activeVfo, vfoAFreqMhz, vfoBFreqMhz]);

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
  }, [pttActive, talkbackEnabled, mode, cwBfoPitchHz]);

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

  // Digital Mode Modem Audio Transmit & Hardware CAT PTT Automation
  const handleTransmitDigitalAudio = useCallback(async (samples: Float32Array) => {
    if (!dspRef.current) return;
    try {
      await dspRef.current.initAudioContext();
      if (rigControllerRef.current) {
        rigControllerRef.current.setTransmit(true, 'Digital Mode Modem');
      }
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

  // Automatic ADIF 3.1.4 Logging from Digital Modes Suite
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
      comment: 'Logged from HeshRadio Digital Modes Suite',
    });
  }, [myGridSquare, operatorHandle]);

  // Memory Channel Quick Tuning
  const handleTuneMemoryChannel = useCallback((channel: MemoryChannel) => {
    handleFrequencyChange(channel.frequencyMhz);
    setMode(channel.mode);
    if (channel.ctcssToneHz) {
      setCtcssToneHz(channel.ctcssToneHz);
      setCtcssSquelchEnabled(true);
    } else {
      setCtcssToneHz(null);
      setCtcssSquelchEnabled(false);
    }
    if (channel.repeaterOffsetMhz !== 0) {
      setRepeaterOffsetMhz(Math.abs(channel.repeaterOffsetMhz));
      setRepeaterOffsetMode(channel.repeaterOffsetMhz > 0 ? 'PLUS_OFFSET' : 'MINUS_OFFSET');
    } else {
      setRepeaterOffsetMode('SIMPLEX');
    }
  }, [handleFrequencyChange]);

  // Audio Buffer Playback Handler (for Replay, NOAA EAS, and Laboratory Suite)
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
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startPtt();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
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

  return (
    <div className="heshradio-shell">
      {/* 1. TOP TACTICAL TELEMETRY HEADER */}
      <header className="top-telemetry-bar">
        <div className="brand-cluster">
          <div className={`tx-rx-beacon ${pttActive ? 'tx' : squelchOpen ? 'rx-open' : 'rx-stby'}`}>
            {pttActive ? 'TX ON AIR' : squelchOpen ? (activeRxHandle ? `RX: ${activeRxHandle}` : 'RX SQUELCH OPEN') : 'RX GUARD'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="app-logo">HESHRADIO</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wider shadow-sm">
                {CURRENT_VERSION}
              </span>
            </div>
            <div className="app-subtitle">
              WIDEBAND SDR (100kHz–1.75GHz) • RTL-SDR USB BRIDGE • CAT RIG CONTROLLER • AUTO-DUCKING
            </div>
          </div>
        </div>

        {/* Global Tactical Header Pills */}
        <div className="header-telemetry-pills">
          <div className="telemetry-pill">
            <span className="pill-label">OPERATOR CALL / HANDLE</span>
            <input
              type="text"
              value={operatorHandle}
              onChange={(e) => setOperatorHandle(e.target.value.toUpperCase())}
              className="handle-input font-mono font-bold"
              aria-label="Operator Call or Handle"
            />
          </div>

          <div className="telemetry-pill">
            <span className="pill-label">HARDWARE SDR</span>
            <span
              className={`pill-value font-bold ${
                sdrStatus.connected ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {sdrStatus.mode === 'WEBUSB'
                ? 'RTL-SDR USB'
                : sdrStatus.mode === 'RTL_TCP'
                ? 'RTL_TCP NET'
                : 'SIMULATED / WebSDR'}
            </span>
          </div>

          <div className="telemetry-pill">
            <span className="pill-label">CAT RIG CONTROL</span>
            <span
              className={`pill-value font-bold ${
                rigStatus.connected ? 'text-emerald-400' : 'text-zinc-500'
              }`}
            >
              {rigStatus.connected ? rigStatus.protocol : 'DIRECT SDR'}
            </span>
          </div>

          <div className="telemetry-pill">
            <span className="pill-label">UTC CLOCK</span>
            <span className="pill-value">{utcClock}</span>
          </div>

          {/* Emergency Panic Unkey Button */}
          <button
            type="button"
            onClick={triggerPanicUnkey}
            className="px-3 py-1.5 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white border border-red-500/60 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg shadow-red-950/60 active:scale-95 transition-all cursor-pointer"
            title="Immediate Fail-Safe Panic Unkey"
          >
            <Zap className="w-3.5 h-3.5 text-red-200 animate-pulse" /> PANIC UNKEY
          </button>
        </div>
      </header>

      {/* 2. MODERN 2-TIER WORKSPACE NAVIGATION */}
      <nav className="panel nav-panel flex flex-col gap-2.5" aria-label="Tactical Workspace Navigation">
        {/* Tier 1: 5 Clean Segmented Workspaces */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 1. TRANSCEIVER */}
            <button
              type="button"
              onClick={() => setActiveTab('VFO_SDR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
                activeCategory === 'TRANSCEIVER'
                  ? 'bg-gradient-to-b from-amber-500/25 to-amber-600/10 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-500/15'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${activeCategory === 'TRANSCEIVER' ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
              <span>TRANSCEIVER</span>
            </button>

            {/* 2. SCAN & ALERTS */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'SCANNER' && activeTab !== 'NOAA_EAS') {
                  setActiveTab('SCANNER');
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
                activeCategory === 'SCAN_ALERTS'
                  ? 'bg-gradient-to-b from-emerald-500/25 to-emerald-600/10 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-500/15'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
              }`}
            >
              <FastForward className={`w-3.5 h-3.5 ${activeCategory === 'SCAN_ALERTS' ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span>SCAN &amp; ALERTS</span>
            </button>

            {/* 3. AUDIO & SPOTS */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'BLACK_BOX' && activeTab !== 'INTERNET_RADIO' && activeTab !== 'TRAFFIC_LOG') {
                  setActiveTab('BLACK_BOX');
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
                activeCategory === 'VOICE_AUDIO'
                  ? 'bg-gradient-to-b from-orange-500/25 to-orange-600/10 text-orange-300 border-orange-500/60 shadow-lg shadow-orange-500/15'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
              }`}
            >
              <HardDrive className={`w-3.5 h-3.5 ${activeCategory === 'VOICE_AUDIO' ? 'text-orange-400' : 'text-zinc-500'}`} />
              <span>AUDIO &amp; SPOTS</span>
            </button>

            {/* 4. DIGITAL MODES */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'DIGITAL_MODES' && activeTab !== 'PROPAGATION' && activeTab !== 'ADIF_LOG') {
                  setActiveTab('DIGITAL_MODES');
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
                activeCategory === 'DIGITAL_WX'
                  ? 'bg-gradient-to-b from-purple-500/25 to-purple-600/10 text-purple-300 border-purple-500/60 shadow-lg shadow-purple-500/15'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${activeCategory === 'DIGITAL_WX' ? 'text-purple-400' : 'text-zinc-500'}`} />
              <span>DIGITAL MODES</span>
            </button>

            {/* 5. RIG & LAB */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'HARDWARE_RIG' && activeTab !== 'LAB_SUITE') {
                  setActiveTab('HARDWARE_RIG');
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
                activeCategory === 'HARDWARE_LAB'
                  ? 'bg-gradient-to-b from-cyan-500/25 to-cyan-600/10 text-cyan-300 border-cyan-500/60 shadow-lg shadow-cyan-500/15'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
              }`}
            >
              <Cpu className={`w-3.5 h-3.5 ${activeCategory === 'HARDWARE_LAB' ? 'text-cyan-400' : 'text-zinc-500'}`} />
              <span>RIG &amp; LAB</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="text-zinc-500">IARU S9 REF:</span>
            <span className="text-amber-400 font-bold bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
              {frequencyMhz > 30 ? '-93 dBm (VHF/UHF)' : '-73 dBm (HF)'}
            </span>
          </div>
        </div>

        {/* Tier 2: Sleek Sub-Tabs (Clean, Concise, No Overlay) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-zinc-800/60">
          {activeCategory === 'TRANSCEIVER' && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-3 py-1 rounded-full bg-amber-500 text-black font-bold flex items-center gap-1.5 shadow-sm">
                <Radio className="w-3 h-3" /> VFO &amp; 120Hz WATERFALL
              </span>
              <span className="text-zinc-400 text-xs">
                Tuned: <strong className="text-amber-300">{frequencyMhz.toFixed(4)} MHz</strong> ({mode}) • <span className="text-zinc-300">{currentBand.name}</span>
              </span>
            </div>
          )}

          {activeCategory === 'SCAN_ALERTS' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('SCANNER')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'SCANNER'
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <FastForward className="w-3.5 h-3.5" /> TACTICAL SCANNER (100 ch/s)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('NOAA_EAS')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'NOAA_EAS'
                    ? 'bg-red-500 text-white border-red-400 shadow-md shadow-red-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" /> NOAA EAS SAME ALERTS
              </button>
            </div>
          )}

          {activeCategory === 'VOICE_AUDIO' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('BLACK_BOX')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'BLACK_BOX'
                    ? 'bg-orange-500 text-black border-orange-400 shadow-md shadow-orange-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" /> 60s BLACK BOX REPLAY
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('INTERNET_RADIO')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'INTERNET_RADIO'
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <Music className="w-3.5 h-3.5" /> INTERNET RADIO AUTO-DUCKER
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('TRAFFIC_LOG')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'TRAFFIC_LOG'
                    ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" /> HIGHWAY SPOTS ({trafficLog.length})
              </button>
            </div>
          )}

          {activeCategory === 'DIGITAL_WX' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('DIGITAL_MODES')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'DIGITAL_MODES'
                    ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> APRS / FT8 / SSTV
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PROPAGATION')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'PROPAGATION'
                    ? 'bg-yellow-500 text-black border-yellow-400 shadow-md shadow-yellow-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <Sun className="w-3.5 h-3.5" /> SOLAR WX &amp; GREYLINE
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ADIF_LOG')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'ADIF_LOG'
                    ? 'bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> ADIF 3.1.4 LOGBOOK
              </button>
            </div>
          )}

          {activeCategory === 'HARDWARE_LAB' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('HARDWARE_RIG')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'HARDWARE_RIG'
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" /> RTL-SDR &amp; CAT RIG CONTROLLER
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('LAB_SUITE')}
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  activeTab === 'LAB_SUITE'
                    ? 'bg-teal-500 text-black border-teal-400 shadow-md shadow-teal-500/30'
                    : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" /> CALIBRATION &amp; SIGNAL LAB
              </button>
            </div>
          )}
        </div>
      </nav>

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
                <section className="panel ptt-panel space-y-3" aria-label="Tactical PTT Action Deck">
                  <div className="panel-header">
                    <div className="panel-title-group">
                      <span className={`status-led ${pttActive ? 'led-red' : 'led-emerald'}`} />
                      <h2 className="panel-title">TRANSMIT &amp; PTT ENGINE</h2>
                    </div>
                    <span className="badge-mono">TOT: {totRemainingSec}s</span>
                  </div>

                  <button
                    type="button"
                    className={`w-full py-4 rounded-xl font-mono font-bold text-sm border-2 transition-all flex flex-col items-center justify-center shadow-lg cursor-pointer ${
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

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setTalkbackEnabled((v) => !v)}
                      className={`py-1.5 px-2 rounded border text-center font-bold cursor-pointer transition-colors ${
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
                      className={`py-1.5 px-2 rounded border text-center font-bold cursor-pointer transition-colors ${
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

        {/* TAB: TACTICAL HIGH-SPEED SCANNER & MEMORY BANKS */}
        {activeTab === 'SCANNER' && (
          <TacticalScannerDeck
            scanEngine={scanEngine}
            currentFreqMhz={frequencyMhz}
            onTuneChannel={handleTuneMemoryChannel}
          />
        )}

        {/* TAB: NOAA WEATHER ALL-HAZARDS & EAS SAME DECODER */}
        {activeTab === 'NOAA_EAS' && (
          <NoaaEmergencyDeck
            onTransmitAudio={handlePlayBufferAudio}
            onTuneNoaaChannel={(freq) => handleFrequencyChange(freq)}
          />
        )}

        {/* TAB: COCKPIT BLACK BOX RECORDER & INSTANT REPLAY */}
        {activeTab === 'BLACK_BOX' && (
          <BlackBoxRecorderDeck
            recorder={blackBoxRef.current}
            onPlayBuffer={handlePlayBufferAudio}
          />
        )}

        {/* TAB: RF & AUDIO LABORATORY CALIBRATION SUITE */}
        {activeTab === 'LAB_SUITE' && (
          <LaboratorySignalDeck
            onPlayBuffer={handlePlayBufferAudio}
          />
        )}

        {/* TAB: DIGITAL MODES (APRS / FT8 / SSTV) */}
        {activeTab === 'DIGITAL_MODES' && (
          <DigitalModesDeck
            myCallsign={operatorHandle}
            myGridSquare={myGridSquare}
            currentFreqMhz={frequencyMhz}
            onTransmitAudio={handleTransmitDigitalAudio}
            onLogQso={handleLogDigitalQso}
          />
        )}

        {/* TAB: SPACE WEATHER & IONOSPHERIC PROPAGATION */}
        {activeTab === 'PROPAGATION' && (
          <SolarPropagationDeck
            myGridSquare={myGridSquare}
            onMyGridChange={setMyGridSquare}
          />
        )}

        {/* TAB: ADIF 3.1.4 ELECTRONIC QSO LOGBOOK */}
        {activeTab === 'ADIF_LOG' && (
          <AdifQsoLogDeck
            currentFreqMhz={frequencyMhz}
            currentMode={mode}
            myGridSquare={myGridSquare}
            operatorHandle={operatorHandle}
          />
        )}

        {/* TAB 2: HARDWARE RTL-SDR & RIG CONTROLLER */}
        {activeTab === 'HARDWARE_RIG' && (
          <div className="flex flex-col gap-4">
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
                <div className="p-3 bg-black/40 rounded-xl border border-zinc-800/80">
                  <div className="text-zinc-200 font-bold mb-1">RTL-SDR V4 / V3 Dongle</div>
                  <div>• Windows: Plug into any USB 2.0/3.0 port (Direct WebUSB pairing in Chrome/Edge).</div>
                  <div>• Android (Samsung S26 Ultra): USB-C OTG cable; direct device descriptor.</div>
                  <div>• Sample Rate: 2.048 MS/s zero-drop baseband.</div>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-zinc-800/80">
                  <div className="text-zinc-200 font-bold mb-1">Digirig Mobile &amp; SignaLink</div>
                  <div>• PTT Keying: Serial RTS pin high on TX, low on RX.</div>
                  <div>• Audio: 300–3000 Hz USB soundcard with 4:1 soft-knee Dynamike compressor.</div>
                  <div>• CM108 GPIO3: Hardware pin 13 bit 2 toggle for zero-VOX latency.</div>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-zinc-800/80">
                  <div className="text-zinc-200 font-bold mb-1">Hamlib rigctld &amp; CAT</div>
                  <div>• Default rigctld TCP: 127.0.0.1:4532 via embedded bridge.</div>
                  <div>• Kenwood/Elecraft/Xiegu: 38400 baud, 8N1 ASCII FA;/MD;/TX;.</div>
                  <div>• Icom CI-V: Packed Little-Endian BCD 0xFE 0xFE &lt;Addr&gt; 0xE0 ... 0xFD.</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: INTERNET RADIO AUTO-DUCKER */}
        {activeTab === 'INTERNET_RADIO' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <InternetRadioDeck
                duckGain={duckGain}
                autoDuckEnabled={autoDuckEnabled}
                onToggleAutoDuck={() => setAutoDuckEnabled((v) => !v)}
                currentCbChannel={channel}
                currentFreqMhz={frequencyMhz}
              />
            </div>
            <section className="panel sidechain-panel lg:col-span-4 space-y-3 font-mono text-xs" aria-label="Auto-Ducking Sidechain Specs">
              <div className="panel-header">
                <div className="panel-title-group">
                  <span className="status-led led-emerald" />
                  <h2 className="panel-title">AUTO-DUCKING SIDECHAIN SPECS</h2>
                </div>
                <span className="badge-mono">-18 dB RF PRIORITY</span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                When active RF voice is detected (carrier squelch breaks threshold or PTT is held),
                the background Internet Radio stream automatically ducks by -18 dB (gain 0.125) within
                15 ms.
              </p>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                After transmission ceases, audio holds for 600 ms to absorb speech pauses, then smoothly
                restores to 100% volume over 400 ms.
              </p>
              <div className="p-3 bg-black/50 rounded-xl border border-zinc-800">
                <div className="flex justify-between text-[11px]">
                  <span>Current Ducker Multiplier:</span>
                  <span className="text-amber-300 font-bold">{(duckGain * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-75"
                    style={{ width: `${duckGain * 100}%` }}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: HIGHWAY QSO & TRAFFIC LOG */}
        {activeTab === 'TRAFFIC_LOG' && (
          <section className="panel traffic-log-panel" aria-label="Highway Trucker Comms Log">
            <div className="panel-header">
              <div className="panel-title-group">
                <span className="status-led led-emerald" />
                <h2 className="panel-title">LIVE HIGHWAY, REPEATER &amp; QSO SPOTS LOG</h2>
              </div>
              <span className="badge-mono">{trafficLog.length} SPOTS RECORDED</span>
            </div>

            <form
              className="quick-dispatch-form"
              onSubmit={async (e) => {
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
              }}
            >
              <input
                type="text"
                placeholder={`Broadcast traffic spot on ${frequencyMhz.toFixed(3)} MHz ${mode}...`}
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                className="dispatch-input"
              />
              <button type="submit" className="dispatch-send-btn">
                SEND SPOT
              </button>
            </form>

            <div className="traffic-log-list">
              {trafficLog.map((item) => (
                <article
                  key={item.id}
                  className={`traffic-card ${item.isSelf ? 'traffic-self' : ''}`}
                >
                  <div className="traffic-card-top">
                    <span className="t-handle">{item.handle}</span>
                    <span className="t-corridor">{item.corridor}</span>
                    <span className="t-freq">
                      {item.channelLabel} ({item.freqMhz} {item.mode})
                    </span>
                    <span className="t-sig">{item.rstOrSignal}</span>
                    <span className="t-time">{item.utcTime}</span>
                  </div>
                  <p className="traffic-card-msg">&ldquo;{item.message}&rdquo;</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* 4. FRONT-PANEL ANALOG CONTROLS (Always visible at bottom) */}
        <section className="panel knobs-panel" aria-label="Front-Panel Analog Audio and RF Controls">
          <div className="panel-header">
            <div className="panel-title-group">
              <span className="status-led led-cyan" />
              <h2 className="panel-title">FRONT-PANEL ANALOG &amp; DSP CONTROLS</h2>
            </div>
            <span className="badge-mono">4-CHANNEL ANALOG POTENTIOMETERS</span>
          </div>
          <div className="knobs-grid">
            <div className="knob-card">
              <div className="knob-header">
                <label htmlFor="vol-range">AF VOLUME</label>
                <span className="knob-val">{Math.round(masterVolume * 100)}%</span>
              </div>
              <input
                id="vol-range"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                className="tactical-slider"
              />
              <span className="knob-sub">Master Receiver Audio</span>
            </div>

            <div className="knob-card">
              <div className="knob-header">
                <label htmlFor="sql-range">SQUELCH (3dB HYST)</label>
                <span className="knob-val">{squelchDbm} dBm</span>
              </div>
              <input
                id="sql-range"
                type="range"
                min={-125}
                max={-55}
                step={1}
                value={squelchDbm}
                onChange={(e) => setSquelchDbm(parseInt(e.target.value, 10))}
                className="tactical-slider"
              />
              <span className="knob-sub">
                {squelchDbm <= -114 ? 'OPEN (HEAR RF STATIC)' : 'GATED CARRIER THRESHOLD'}
              </span>
            </div>

            <div className="knob-card">
              <div className="knob-header">
                <label htmlFor="rfg-range">RF GAIN</label>
                <span className="knob-val">{rfGainPct}%</span>
              </div>
              <input
                id="rfg-range"
                type="range"
                min={20}
                max={100}
                step={2}
                value={rfGainPct}
                onChange={(e) => setRfGainPct(parseInt(e.target.value, 10))}
                className="tactical-slider"
              />
              <span className="knob-sub">Front-End LNA Attenuator</span>
            </div>

            <div className="knob-card">
              <div className="knob-header">
                <label htmlFor="dyn-range">DYNAMIKE (4:1 COMP)</label>
                <span className="knob-val">{dynamikePct}%</span>
              </div>
              <input
                id="dyn-range"
                type="range"
                min={20}
                max={100}
                step={5}
                value={dynamikePct}
                onChange={(e) => setDynamikePct(parseInt(e.target.value, 10))}
                className="tactical-slider"
              />
              <span className="knob-sub">Speech Compressor &amp; Limiter</span>
            </div>
          </div>
        </section>
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
