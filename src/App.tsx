import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CB_CHANNELS,
  HIGHWAY_CORRIDORS,
  ModulationMode,
  NOAA_WX_CHANNELS,
  SIMULATED_TRUCKER_TRAFFIC,
} from './radio/cbChannels';
import {
  computeIaruSMeter,
  HeshRadioDspEngine,
  RogerBeepType,
  SMeterReading,
} from './radio/dspEngine';
import { SMeterDisplay } from './components/SMeterDisplay';
import { WaterfallDisplay } from './components/WaterfallDisplay';
import { InternetRadioDeck } from './components/InternetRadioDeck';

interface TrafficLogEntry {
  id: string;
  utcTime: string;
  handle: string;
  corridor: string;
  channelLabel: string;
  freqMhz: string;
  mode: ModulationMode;
  rstOrSignal: string;
  message: string;
  isSelf?: boolean;
}

export const App: React.FC = () => {
  // Core Transceiver State
  const [channel, setChannel] = useState<number>(19);
  const [wxIndex, setWxIndex] = useState<number>(0);
  const [mode, setMode] = useState<ModulationMode>('AM');
  const [corridorId, setCorridorId] = useState<string>('I-80');
  const [operatorHandle, setOperatorHandle] = useState<string>('HESHRADIO-19');

  // Front-Panel Analog Controls
  const [masterVolume, setMasterVolume] = useState<number>(0.80);
  const [squelchDbm, setSquelchDbm] = useState<number>(-98);
  const [rfGainPct, setRfGainPct] = useState<number>(100);
  const [dynamikePct, setDynamikePct] = useState<number>(85);

  // DSP Chain Toggles
  const [anlEnabled, setAnlEnabled] = useState<boolean>(true);
  const [rogerBeep, setRogerBeep] = useState<RogerBeepType>('CLASSIC_2475');
  const [talkbackEnabled, setTalkbackEnabled] = useState<boolean>(false);
  const [autoDuckEnabled, setAutoDuckEnabled] = useState<boolean>(true);
  const [autoTrafficEnabled, setAutoTrafficEnabled] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);

  // PTT & TOT Watchdog State
  const [pttActive, setPttActive] = useState<boolean>(false);
  const [totRemainingSec, setTotRemainingSec] = useState<number>(180);
  const [micReady, setMicReady] = useState<boolean>(false);

  // Live Telemetry from DSP Engine
  const [sMeter, setSMeter] = useState<SMeterReading>(() => computeIaruSMeter(-114, 0, 1.15));
  const [squelchOpen, setSquelchOpen] = useState<boolean>(false);
  const [duckGain, setDuckGain] = useState<number>(1.0);
  const [activeRxHandle, setActiveRxHandle] = useState<string | null>(null);

  // Network / LAN Peers & Clock
  const [lanPeerCount, setLanPeerCount] = useState<number>(1);
  const [utcClock, setUtcClock] = useState<string>('');
  const [quickMessage, setQuickMessage] = useState<string>('');
  const [show40ChModal, setShow40ChModal] = useState<boolean>(false);

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
      message:
        'Breaker 1-9, watch your foot westbound at the 142 yardstick, full-grown bear in the median shooting laser.',
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
      message:
        'Appreciate that comeback Iron Horse! Eastbound is clean and green all the way back to the Flying J at exit 118.',
    },
  ]);

  const dspRef = useRef<HeshRadioDspEngine | null>(null);
  if (!dspRef.current) {
    dspRef.current = new HeshRadioDspEngine();
  }
  const wsRef = useRef<WebSocket | null>(null);
  const pttStartTimestampRef = useRef<number>(0);

  const currentCbInfo = CB_CHANNELS[channel - 1] || CB_CHANNELS[18];
  const currentWxInfo = NOAA_WX_CHANNELS[wxIndex] || NOAA_WX_CHANNELS[0];
  const displayedFreqMhz =
    mode === 'WX' ? currentWxInfo.frequencyMhz : currentCbInfo.frequencyMhz;

  // Format UTC Clock at 1 Hz
  useEffect(() => {
    const updateClock = () => {
      setUtcClock(new Date().toISOString().slice(11, 19) + ' UTC');
    };
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Connect to embedded Vite / LAN WebSocket CB Relay (/ws-cb)
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
            typeof event.data === 'string'
              ? event.data
              : await (event.data as Blob).text();
          const msg = JSON.parse(textData);

          if (msg.type === 'PEER_COUNT') {
            setLanPeerCount(msg.count);
          } else if (msg.type === 'CB_TRANSMISSION') {
            const entry: TrafficLogEntry = {
              id: 'ws-' + Date.now(),
              utcTime: new Date().toISOString().slice(11, 19) + 'Z',
              handle: msg.handle || 'LAN Rig',
              corridor: msg.corridor || 'LOCAL LAN',
              channelLabel: `CH ${String(msg.channel).padStart(2, '0')}`,
              freqMhz: (CB_CHANNELS[(msg.channel || 19) - 1]?.frequencyMhz || 27.185).toFixed(3),
              mode: msg.mode || 'AM',
              rstOrSignal: 'S9+20dB',
              message: msg.text,
            };
            setTrafficLog((prev) => [entry, ...prev.slice(0, 39)]);

            if (dspRef.current && msg.channel === channel) {
              await dspRef.current.initAudioContext();
              setActiveRxHandle(entry.handle);
              dspRef.current.triggerIncomingTransmission(
                msg.channel,
                -53,
                msg.text,
                108,
                masterVolume,
                anlEnabled,
                rogerBeep,
                () => setActiveRxHandle(null)
              );
            }
          }
        } catch {
          // Ignore malformed frame
        }
      };
    } catch {
      // Offline / standalone fallback
    }

    return () => {
      if (ws) ws.close();
    };
  }, [channel, masterVolume, anlEnabled, rogerBeep]);

  // 60Hz Real-Time DSP Step Loop
  useEffect(() => {
    let animId = 0;
    const tick = () => {
      if (dspRef.current) {
        const res = dspRef.current.stepDspFrame({
          currentChannel: channel,
          mode,
          pttActive,
          squelchThresholdDbm: squelchDbm,
          rfGainPct,
          dynamikePct,
          anlEnabled,
          masterVolume,
          autoDuckEnabled,
        });
        setSMeter(res.sMeter);
        setSquelchOpen(res.squelchOpen);
        setDuckGain(res.duckGain);
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [
    channel,
    mode,
    pttActive,
    squelchDbm,
    rfGainPct,
    dynamikePct,
    anlEnabled,
    masterVolume,
    autoDuckEnabled,
  ]);

  // 40-Channel CB Priority Scanner
  useEffect(() => {
    if (!scanning || pttActive || activeRxHandle) return;
    const scanTimer = window.setInterval(() => {
      setChannel((prev) => (prev >= 40 ? 1 : prev + 1));
    }, 320);
    return () => window.clearInterval(scanTimer);
  }, [scanning, pttActive, activeRxHandle]);

  // Trigger a simulated Trucker transmission on the current or highway channel
  const triggerSimulatedTruckerCall = useCallback(
    async (customPrompt?: {
      handle: string;
      text: string;
      signalDbm: number;
      pitchHz: number;
      targetChannel?: number;
    }) => {
      if (!dspRef.current || pttActive) return;
      await dspRef.current.initAudioContext();

      if (mode === 'WX') {
        setActiveRxHandle(currentWxInfo.stationName);
        dspRef.current.playNoaaAlertTone(masterVolume);
        dspRef.current.triggerIncomingTransmission(
          channel,
          -62,
          currentWxInfo.forecastText,
          105,
          masterVolume,
          anlEnabled,
          'OFF',
          () => setActiveRxHandle(null)
        );
        return;
      }

      const pool = SIMULATED_TRUCKER_TRAFFIC.filter((t) => t.channel === channel);
      const chosen =
        customPrompt ||
        (pool.length > 0
          ? pool[Math.floor(Math.random() * pool.length)]
          : SIMULATED_TRUCKER_TRAFFIC[
              Math.floor(Math.random() * SIMULATED_TRUCKER_TRAFFIC.length)
            ]);

      const rxCh = customPrompt?.targetChannel ?? channel;
      const chInfo = CB_CHANNELS[rxCh - 1] || CB_CHANNELS[18];
      const sReading = computeIaruSMeter(chosen.signalDbm);

      setActiveRxHandle(chosen.handle);

      const newLog: TrafficLogEntry = {
        id: 'sim-' + Date.now(),
        utcTime: new Date().toISOString().slice(11, 19) + 'Z',
        handle: chosen.handle,
        corridor: HIGHWAY_CORRIDORS.find((c) => c.id === corridorId)?.code || 'I-80 TRANSCON',
        channelLabel: `CH ${String(rxCh).padStart(2, '0')}`,
        freqMhz: chInfo.frequencyMhz.toFixed(3),
        mode: chInfo.defaultMode,
        rstOrSignal: sReading.formatted,
        message: chosen.text,
      };
      setTrafficLog((prev) => [newLog, ...prev.slice(0, 39)]);

      dspRef.current.triggerIncomingTransmission(
        rxCh,
        chosen.signalDbm,
        chosen.text,
        chosen.pitchHz,
        masterVolume,
        anlEnabled,
        rogerBeep,
        () => setActiveRxHandle(null)
      );
    },
    [
      pttActive,
      mode,
      currentWxInfo,
      masterVolume,
      channel,
      anlEnabled,
      corridorId,
      rogerBeep,
    ]
  );

  // Periodic background highway chatter when AUTO HIGHWAY CHATTER is active
  useEffect(() => {
    if (!autoTrafficEnabled) return;
    const timer = window.setInterval(() => {
      if (!pttActive && !activeRxHandle && Math.random() < 0.45) {
        triggerSimulatedTruckerCall();
      }
    }, 19000);
    return () => window.clearInterval(timer);
  }, [autoTrafficEnabled, pttActive, activeRxHandle, triggerSimulatedTruckerCall]);

  // Fail-Safe PTT Start & Stop with Mandatory 180s Time-Out Timer (TOT) Watchdog
  const startPtt = useCallback(async () => {
    if (pttActive || !dspRef.current) return;
    setScanning(false);
    dspRef.current.stopIncomingTransmission();
    setActiveRxHandle(null);

    await dspRef.current.initAudioContext();
    const hasMic = await dspRef.current.enableMicrophone(talkbackEnabled);
    setMicReady(hasMic);
    dspRef.current.setTalkbackVolume(talkbackEnabled, true);
    dspRef.current.playMicClick();

    pttStartTimestampRef.current = performance.now();
    setTotRemainingSec(180);
    setPttActive(true);
  }, [pttActive, talkbackEnabled]);

  const stopPtt = useCallback(
    (spokenOverride?: string) => {
      if (!pttActive || !dspRef.current) return;
      setPttActive(false);
      setTotRemainingSec(180);
      dspRef.current.setTalkbackVolume(talkbackEnabled, false);
      dspRef.current.playRogerBeepAndSquelchTail(rogerBeep, masterVolume);

      const heldMs = performance.now() - pttStartTimestampRef.current;
      if (heldMs > 350 || spokenOverride) {
        const msgText =
          spokenOverride ||
          quickMessage.trim() ||
          `Breaker 1-${channel}, this is ${operatorHandle} on ${currentCbInfo.frequencyMhz.toFixed(
            3
          )} MHz ${mode}, requesting a radio check!`;

        const selfEntry: TrafficLogEntry = {
          id: 'tx-' + Date.now(),
          utcTime: new Date().toISOString().slice(11, 19) + 'Z',
          handle: operatorHandle,
          corridor: HIGHWAY_CORRIDORS.find((c) => c.id === corridorId)?.code || 'I-80 TRANSCON',
          channelLabel: `CH ${String(channel).padStart(2, '0')}`,
          freqMhz: currentCbInfo.frequencyMhz.toFixed(3),
          mode,
          rstOrSignal: 'TX 4.0W',
          message: msgText,
          isSelf: true,
        };
        setTrafficLog((prev) => [selfEntry, ...prev.slice(0, 39)]);
        if (!spokenOverride) setQuickMessage('');

        // Broadcast over LAN WebSocket so Samsung S26 Ultra or 2nd window receives it live
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'CB_TRANSMISSION',
              handle: operatorHandle,
              corridor: selfEntry.corridor,
              channel,
              mode,
              text: msgText,
            })
          );
        }

        // Automated Trucker Comeback Reply 1.6 seconds after unkeying!
        window.setTimeout(() => {
          triggerSimulatedTruckerCall({
            handle: channel === 38 ? 'Delta X-Ray 707' : 'Bluegrass Bandit',
            text:
              channel === 38
                ? `${operatorHandle}, you are booming into the West Coast at 20 over S9 on 38 Lower Sideband! 73!`
                : `Loud and proud ${operatorHandle}! You're pegging my meter at 9 plus 10 here on Channel ${channel}, clean modulation driver!`,
            signalDbm: -63,
            pitchHz: 102,
            targetChannel: channel,
          });
        }, 1450);
      }
    },
    [
      pttActive,
      talkbackEnabled,
      rogerBeep,
      masterVolume,
      quickMessage,
      channel,
      operatorHandle,
      currentCbInfo.frequencyMhz,
      mode,
      corridorId,
      triggerSimulatedTruckerCall,
    ]
  );

  // Mandatory Safety Rule: TOT Countdown & Panic Unkey on Window Blur
  useEffect(() => {
    if (!pttActive) return;
    const totInterval = window.setInterval(() => {
      setTotRemainingSec((prev) => {
        if (prev <= 1) {
          stopPtt('[TOT WATCHDOG AUTO-UNKEY]');
          return 180;
        }
        return prev - 1;
      });
    }, 1000);

    const handleWindowBlur = () => {
      stopPtt();
    };
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.clearInterval(totInterval);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [pttActive, stopPtt]);

  // Global Spacebar Push-To-Talk (when not typing in a text input)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startPtt();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setChannel((c) => (c >= 40 ? 1 : c + 1));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setChannel((c) => (c <= 1 ? 40 : c - 1));
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

  const selectPresetChannel = (ch: number, targetMode?: ModulationMode) => {
    setScanning(false);
    setChannel(ch);
    const info = CB_CHANNELS[ch - 1];
    if (targetMode) {
      setMode(targetMode);
    } else if (info) {
      setMode(info.defaultMode);
    }
  };

  return (
    <div className="heshradio-shell">
      {/* TOP TACTICAL TELEMETRY HEADER */}
      <header className="top-telemetry-bar">
        <div className="brand-cluster">
          <div className={`tx-rx-beacon ${pttActive ? 'tx' : squelchOpen ? 'rx-open' : 'rx-stby'}`}>
            {pttActive ? 'TX ON AIR' : squelchOpen ? 'RX SQUELCH OPEN' : 'RX GUARD'}
          </div>
          <div>
            <h1 className="app-logo">HESHRADIO</h1>
            <div className="app-subtitle">
              11M CB TRANSCEIVER • BLACKMAN-HARRIS SDR WATERFALL • AUTO-DUCKING NET RADIO
            </div>
          </div>
        </div>

        <div className="header-telemetry-pills">
          <div className="telemetry-pill">
            <span className="pill-label">HANDLE / CALL</span>
            <input
              type="text"
              value={operatorHandle}
              onChange={(e) => setOperatorHandle(e.target.value.toUpperCase())}
              className="handle-input"
              aria-label="Operator CB Handle or Amateur Callsign"
            />
          </div>

          <div className="telemetry-pill">
            <span className="pill-label">CORRIDOR</span>
            <select
              value={corridorId}
              onChange={(e) => setCorridorId(e.target.value)}
              className="corridor-select"
              aria-label="Select Highway Corridor"
            >
              {HIGHWAY_CORRIDORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} ({c.activeRigs} Rigs)
                </option>
              ))}
            </select>
          </div>

          <div className="telemetry-pill">
            <span className="pill-label">GRID / LAN</span>
            <span className="pill-value">CN87uq • {lanPeerCount} NODE(S)</span>
          </div>

          <div className="telemetry-pill">
            <span className="pill-label">CLOCK</span>
            <span className="pill-value">{utcClock}</span>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE GRID */}
      <main className="main-tactical-grid">
        {/* LEFT COLUMN: 40-CH CB TRANSCEIVER FACEPLATE + WATERFALL */}
        <div className="left-transceiver-column">
          <section className="panel cb-faceplate-panel" aria-label="40-Channel CB Radio Transceiver Deck">
            <div className="panel-header">
              <div className="panel-title-group">
                <span className={`status-led ${pttActive ? 'led-red' : 'led-emerald'}`} />
                <h2 className="panel-title">
                  COBRA / PRESIDENT TACTICAL 40-CH CB &amp; WX SYNTHESIZER
                </h2>
              </div>
              <div className="faceplate-badges">
                <span className="badge-mono">
                  {micReady ? 'MIC DSP: 300-3kHz + 4:1 COMP' : 'MIC: CLICK PTT TO ARM'}
                </span>
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => setShow40ChModal((v) => !v)}
                >
                  {show40ChModal ? 'HIDE 40-CH MATRIX' : '40-CH FCC MATRIX'}
                </button>
              </div>
            </div>

            {/* VFO & CHANNEL DISPLAY DECK */}
            <div className="vfo-deck-grid">
              {/* Rotary Channel Selector & 7-Segment Display */}
              <div
                className="channel-selector-box"
                onWheel={(e) => {
                  if (mode === 'WX') {
                    setWxIndex((i) => (e.deltaY < 0 ? (i + 1) % 7 : (i + 6) % 7));
                  } else {
                    setChannel((c) => (e.deltaY < 0 ? (c >= 40 ? 1 : c + 1) : c <= 1 ? 40 : c - 1));
                  }
                }}
                title="Scroll mouse wheel or click ▲/▼ to step channels"
              >
                <div className="ch-step-buttons">
                  <button
                    type="button"
                    className="ch-step-btn"
                    onClick={() =>
                      mode === 'WX'
                        ? setWxIndex((i) => (i + 1) % 7)
                        : setChannel((c) => (c >= 40 ? 1 : c + 1))
                    }
                    aria-label="Channel Up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="ch-step-btn"
                    onClick={() =>
                      mode === 'WX'
                        ? setWxIndex((i) => (i + 6) % 7)
                        : setChannel((c) => (c <= 1 ? 40 : c - 1))
                    }
                    aria-label="Channel Down"
                  >
                    ▼
                  </button>
                </div>

                <div className="seven-seg-readout">
                  <span className="seg-caption">{mode === 'WX' ? 'NOAA WX' : 'CB CHANNEL'}</span>
                  <span className={`seg-digits ${pttActive ? 'tx-glow' : ''}`}>
                    {mode === 'WX' ? `W${wxIndex + 1}` : String(channel).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Frequency & Channel Usage Readout */}
              <div className="vfo-frequency-box">
                <div className="vfo-top-meta">
                  <span className="vfo-mode-pill">{mode} MODULATION</span>
                  <span className="vfo-tot-pill">TOT WATCHDOG: {totRemainingSec}s</span>
                  {activeRxHandle && (
                    <span className="rx-caller-pill">RX CARRIER: {activeRxHandle}</span>
                  )}
                </div>

                <div className="vfo-main-freq">
                  {displayedFreqMhz.toFixed(3)}
                  <span className="freq-sub-digits">.00 MHz</span>
                </div>

                <div className="vfo-usage-line">
                  {mode === 'WX' ? currentWxInfo.stationName : currentCbInfo.truckerUsage}
                </div>

                {mode !== 'WX' && currentCbInfo.synthNote && (
                  <div className="vfo-synth-anomaly">
                    ⚡ RF SYNTH NOTE: {currentCbInfo.synthNote}
                  </div>
                )}
              </div>

              {/* Calibrated IARU S-Meter */}
              <SMeterDisplay
                reading={sMeter}
                pttActive={pttActive}
                squelchOpen={squelchOpen}
                mode={mode}
              />
            </div>

            {/* OPTIONAL 40-CHANNEL INTERACTIVE FCC FREQUENCY MATRIX */}
            {show40ChModal && (
              <div className="channel-matrix-drawer">
                <div className="matrix-header">
                  <span>FCC PART 95 40-CHANNEL SYNTHESIZER MATRIX (CLICK TO TUNE)</span>
                  <span className="matrix-note">
                    Note non-linear Ch 23 (27.255) / Ch 24 (27.235) / Ch 25 (27.245 MHz) &amp; skipped R/C A-channels
                  </span>
                </div>
                <div className="channel-matrix-grid">
                  {CB_CHANNELS.map((ch) => (
                    <button
                      key={ch.channel}
                      type="button"
                      className={`matrix-cell ${ch.channel === channel && mode !== 'WX' ? 'active' : ''} ${
                        ch.priority ? 'priority-' + ch.priority.toLowerCase() : ''
                      }`}
                      onClick={() => {
                        selectPresetChannel(ch.channel);
                        setShow40ChModal(false);
                      }}
                    >
                      <span className="m-ch">CH {String(ch.channel).padStart(2, '0')}</span>
                      <span className="m-freq">{ch.frequencyMhz.toFixed(3)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PRIORITY QUICK-JUMP CHANNELS & MODE SELECTOR BAR */}
            <div className="priority-bar">
              <div className="quick-jump-group">
                <button
                  type="button"
                  className={`jump-btn jump-hwy ${channel === 19 && mode !== 'WX' ? 'active' : ''}`}
                  onClick={() => selectPresetChannel(19, 'AM')}
                >
                  CH 19 HIGHWAY (27.185)
                </button>
                <button
                  type="button"
                  className={`jump-btn jump-emg ${channel === 9 && mode !== 'WX' ? 'active' : ''}`}
                  onClick={() => selectPresetChannel(9, 'AM')}
                >
                  CH 09 EMERGENCY (27.065)
                </button>
                <button
                  type="button"
                  className={`jump-btn ${channel === 6 && mode !== 'WX' ? 'active' : ''}`}
                  onClick={() => selectPresetChannel(6, 'AM')}
                >
                  CH 06 SUPER BOWL
                </button>
                <button
                  type="button"
                  className={`jump-btn ${channel === 38 && mode === 'LSB' ? 'active' : ''}`}
                  onClick={() => selectPresetChannel(38, 'LSB')}
                >
                  CH 38 LSB SKIP
                </button>
                <button
                  type="button"
                  className={`jump-btn ${mode === 'WX' ? 'active' : ''}`}
                  onClick={() => setMode('WX')}
                >
                  NOAA WX ({currentWxInfo.label})
                </button>
                <button
                  type="button"
                  className={`jump-btn ${scanning ? 'active-scan' : ''}`}
                  onClick={() => {
                    if (mode === 'WX') setMode('AM');
                    setScanning((s) => !s);
                  }}
                >
                  {scanning ? '■ STOP SCAN' : '⟳ 40-CH SCAN'}
                </button>
              </div>

              <div className="mode-pill-group">
                {(['AM', 'FM', 'LSB', 'USB', 'WX'] as ModulationMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`mode-btn ${mode === m ? 'active' : ''}`}
                    onClick={() => setMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 TACTICAL FRONT-PANEL ANALOG CONTROLS */}
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
                <span className="knob-sub">Master Receiver Audio Gain</span>
              </div>

              <div className="knob-card">
                <div className="knob-header">
                  <label htmlFor="sql-range">SQUELCH (3dB HYST)</label>
                  <span className="knob-val">{squelchDbm} dBm</span>
                </div>
                <input
                  id="sql-range"
                  type="range"
                  min={-120}
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
                <span className="knob-sub">300-3kHz Punch &amp; Limiter</span>
              </div>
            </div>

            {/* DSP SWITCHES & ROGER BEEP SELECTOR */}
            <div className="dsp-switches-bar">
              <button
                type="button"
                className={`chip-btn ${anlEnabled ? 'active' : ''}`}
                onClick={() => setAnlEnabled((v) => !v)}
              >
                ANL / NB IGNITION BLANKER: {anlEnabled ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                className={`chip-btn ${talkbackEnabled ? 'active' : ''}`}
                onClick={() => {
                  const next = !talkbackEnabled;
                  setTalkbackEnabled(next);
                  if (dspRef.current) {
                    dspRef.current.enableMicrophone(next);
                  }
                }}
              >
                PA / TALKBACK MONITOR: {talkbackEnabled ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                className={`chip-btn ${autoTrafficEnabled ? 'active' : ''}`}
                onClick={() => setAutoTrafficEnabled((v) => !v)}
              >
                HIGHWAY SIM TRAFFIC: {autoTrafficEnabled ? 'AUTO' : 'MANUAL'}
              </button>

              <div className="roger-select-wrap">
                <label htmlFor="roger-select">ROGER BEEP:</label>
                <select
                  id="roger-select"
                  value={rogerBeep}
                  onChange={(e) => setRogerBeep(e.target.value as RogerBeepType)}
                  className="corridor-select"
                >
                  <option value="CLASSIC_2475">COBRA 2475 Hz</option>
                  <option value="APOLLO_DUAL">NASA QUINDAR DUAL</option>
                  <option value="TRUCKER_K">MORSE &apos;K&apos; (-.-)</option>
                  <option value="OFF">OFF (SQUELCH TAIL ONLY)</option>
                </select>
              </div>
            </div>

            {/* PUSH-TO-TALK (PTT) DECK & INSTANT TRUCKER RADIO CHECK */}
            <div className="ptt-deck-row">
              <button
                type="button"
                className={`giant-ptt-button ${pttActive ? 'ptt-transmitting' : ''}`}
                onMouseDown={startPtt}
                onMouseUp={() => stopPtt()}
                onMouseLeave={() => {
                  if (pttActive) stopPtt();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startPtt();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopPtt();
                }}
              >
                <span className="ptt-main-label">
                  {pttActive
                    ? '● TRANSMITTING ON AIR (RELEASE TO UNKEY)'
                    : '🎙 HOLD TO TALK (PTT) — OR HOLD SPACEBAR'}
                </span>
                <span className="ptt-sub-label">
                  {pttActive
                    ? `CH ${channel} (${displayedFreqMhz.toFixed(3)} MHz ${mode}) • 4.0W CARRIER + ROGER BEEP ARMED`
                    : 'Keys Mic 300-3000Hz DSP Filter + Ducks Internet Radio -18dB + Triggers Squelch Tail'}
                </span>
              </button>

              <div className="ptt-side-actions">
                <button
                  type="button"
                  className="test-call-btn"
                  onClick={async () => {
                    if (!dspRef.current) return;
                    await dspRef.current.initAudioContext();
                    dspRef.current.playMicClick();
                    stopPtt(
                      `Breaker 1-${channel} for a radio check! How copy ${operatorHandle} in the ${corridorId} corridor?`
                    );
                    // If user wasn't holding PTT, dispatch directly and trigger trucker comeback
                    if (!pttActive) {
                      dspRef.current.playRogerBeepAndSquelchTail(rogerBeep, masterVolume);
                      const selfEntry: TrafficLogEntry = {
                        id: 'rc-' + Date.now(),
                        utcTime: new Date().toISOString().slice(11, 19) + 'Z',
                        handle: operatorHandle,
                        corridor:
                          HIGHWAY_CORRIDORS.find((c) => c.id === corridorId)?.code ||
                          'I-80 TRANSCON',
                        channelLabel: `CH ${String(channel).padStart(2, '0')}`,
                        freqMhz: currentCbInfo.frequencyMhz.toFixed(3),
                        mode,
                        rstOrSignal: 'TX 4.0W',
                        message: `Breaker 1-${channel} for a radio check! How copy ${operatorHandle}?`,
                        isSelf: true,
                      };
                      setTrafficLog((prev) => [selfEntry, ...prev.slice(0, 39)]);

                      window.setTimeout(() => {
                        triggerSimulatedTruckerCall({
                          handle: 'Big Rig Bounty',
                          text: `Got you 5 by 9 plus 15 dB ${operatorHandle}! Crystal clear audio on Channel ${channel}, keep the shiny side up driver!`,
                          signalDbm: -58,
                          pitchHz: 100,
                          targetChannel: channel,
                        });
                      }, 1200);
                    }
                  }}
                >
                  ⚡ BREAKER 1-9 RADIO CHECK
                </button>

                <button
                  type="button"
                  className="rx-sim-btn"
                  onClick={() => triggerSimulatedTruckerCall()}
                >
                  📡 RECEIVE TRUCKER CALL NOW
                </button>
              </div>
            </div>
          </section>

          {/* 60-120FPS SPECTRUM & WATERFALL ANALYZER */}
          <WaterfallDisplay
            spectrumDb={dspRef.current.spectrumDb}
            peakHoldDb={dspRef.current.peakHoldDb}
            currentChannel={channel}
            mode={mode}
            pttActive={pttActive}
            squelchThresholdDbm={squelchDbm}
            onSelectChannel={(ch) => selectPresetChannel(ch)}
          />
        </div>

        {/* RIGHT COLUMN: INTERNET RADIO AUTO-DUCKER + LIVE TRUCKER LOG & DISPATCH */}
        <div className="right-telemetry-column">
          <InternetRadioDeck
            duckGain={duckGain}
            autoDuckEnabled={autoDuckEnabled}
            onToggleAutoDuck={() => setAutoDuckEnabled((v) => !v)}
            currentCbChannel={channel}
            currentFreqMhz={displayedFreqMhz}
          />

          {/* HIGHWAY CORRIDOR & TRUCKER COMMS LOG */}
          <section className="panel traffic-log-panel" aria-label="Highway Trucker Radio Log and Spotter Feed">
            <div className="panel-header">
              <div className="panel-title-group">
                <span className="status-led led-emerald" />
                <h2 className="panel-title">LIVE HIGHWAY &amp; SKIP TRAFFIC LOG</h2>
              </div>
              <span className="badge-mono">{trafficLog.length} SPOTS</span>
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
                  corridor:
                    HIGHWAY_CORRIDORS.find((c) => c.id === corridorId)?.code || 'I-80 TRANSCON',
                  channelLabel: `CH ${String(channel).padStart(2, '0')}`,
                  freqMhz: currentCbInfo.frequencyMhz.toFixed(3),
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
                      mode,
                      text: textToSend,
                    })
                  );
                }
                window.setTimeout(() => {
                  triggerSimulatedTruckerCall({
                    handle: ' Smokey Spotter 99',
                    text: `10-4 ${operatorHandle}, copy your traffic on Channel ${channel}: "${textToSend}". Safe travels out there!`,
                    signalDbm: -66,
                    pitchHz: 108,
                    targetChannel: channel,
                  });
                }, 1300);
              }}
            >
              <input
                type="text"
                placeholder={`Transmit voice/packet spot on Ch ${channel} (e.g. "Bear report MM 112" or press Enter)...`}
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                className="dispatch-input"
              />
              <button type="submit" className="dispatch-send-btn">
                KEY &amp; SEND
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
        </div>
      </main>
    </div>
  );
};
export default App;
