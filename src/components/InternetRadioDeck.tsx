import React, { useEffect, useRef, useState } from 'react';
import { INTERNET_RADIO_PRESETS, InternetRadioStation } from '../radio/cbChannels';

interface InternetRadioDeckProps {
  duckGain: number; // 1.0 normal, 0.125 (-18 dB) when ducked by CB voice/PTT
  autoDuckEnabled: boolean;
  onToggleAutoDuck: () => void;
  currentCbChannel: number;
  currentFreqMhz: number;
}

export const InternetRadioDeck: React.FC<InternetRadioDeckProps> = ({
  duckGain,
  autoDuckEnabled,
  onToggleAutoDuck,
  currentCbChannel,
  currentFreqMhz,
}) => {
  const [selectedStation, setSelectedStation] = useState<InternetRadioStation>(
    INTERNET_RADIO_PRESETS[0]
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(0.65);
  const [useBuiltInSynth, setUseBuiltInSynth] = useState<boolean>(false);
  const [streamStatus, setStreamStatus] = useState<string>('STANDBY');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthCtxRef = useRef<AudioContext | null>(null);
  const synthMasterGainRef = useRef<GainNode | null>(null);
  const synthTimerRef = useRef<number | null>(null);

  const effectiveGain = isPlaying ? musicVolume * (autoDuckEnabled ? duckGain : 1.0) : 0;
  const isCurrentlyDucked = autoDuckEnabled && duckGain < 0.85 && isPlaying;
  const attenuationDb = isCurrentlyDucked
    ? Math.round(20 * Math.log10(Math.max(0.05, duckGain)))
    : 0;

  // Apply real-time sidechain auto-ducking gain to HTML5 Audio & WebAudio Synth
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, effectiveGain));
    }
    if (synthMasterGainRef.current && synthCtxRef.current) {
      synthMasterGainRef.current.gain.setTargetAtTime(
        effectiveGain * 0.22,
        synthCtxRef.current.currentTime,
        0.015
      );
    }
  }, [effectiveGain]);

  const stopSynthLoop = () => {
    if (synthTimerRef.current) {
      window.clearInterval(synthTimerRef.current);
      synthTimerRef.current = null;
    }
    if (synthCtxRef.current) {
      synthCtxRef.current.close().catch(() => {});
      synthCtxRef.current = null;
      synthMasterGainRef.current = null;
    }
  };

  /**
   * Built-in Highway Cruiser Audio Synth so the user can test -18dB sidechain
   * auto-ducking instantaneously even without external internet stream buffering.
   */
  const startRoadSynthLoop = (style: InternetRadioStation['fallbackSynthStyle']) => {
    stopSynthLoop();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    synthCtxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = effectiveGain * 0.22;
    master.connect(ctx.destination);
    synthMasterGainRef.current = master;

    const chords =
      style === 'OUTLAW_COUNTRY'
        ? [110.0, 146.83, 164.81, 130.81] // A2 - D3 - E3 - C3 outlaw bassline
        : style === 'HIGHWAY_ROCK'
        ? [82.41, 98.0, 110.0, 123.47] // E2 - G2 - A2 - B2 driving rock
        : [130.81, 164.81, 196.0, 146.83]; // Synthwave cruiser

    let step = 0;
    synthTimerRef.current = window.setInterval(() => {
      if (!synthCtxRef.current || !synthMasterGainRef.current) return;
      const now = synthCtxRef.current.currentTime;
      const rootFreq = chords[Math.floor(step / 4) % chords.length];
      const noteFreq = step % 2 === 0 ? rootFreq : rootFreq * 1.5;

      const osc = synthCtxRef.current.createOscillator();
      const filter = synthCtxRef.current.createBiquadFilter();
      const noteGain = synthCtxRef.current.createGain();

      osc.type = style === 'NIGHT_SYNTH' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(noteFreq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, now);

      noteGain.gain.setValueAtTime(0.45, now);
      noteGain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);

      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(synthMasterGainRef.current);

      osc.start(now);
      osc.stop(now + 0.28);
      step++;
    }, 280);
  };

  const togglePlay = async (station: InternetRadioStation = selectedStation, forceSynth = useBuiltInSynth) => {
    if (isPlaying && station.id === selectedStation.id) {
      setIsPlaying(false);
      setStreamStatus('STOPPED');
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      stopSynthLoop();
      return;
    }

    setSelectedStation(station);
    setIsPlaying(true);

    if (forceSynth) {
      if (audioRef.current) audioRef.current.pause();
      startRoadSynthLoop(station.fallbackSynthStyle);
      setStreamStatus('LOCAL SYNTH ENGINE ACTIVE');
      return;
    }

    stopSynthLoop();
    if (audioRef.current) {
      setStreamStatus('CONNECTING ICECAST...');
      audioRef.current.src = station.streamUrl;
      audioRef.current.volume = Math.max(0, Math.min(1, effectiveGain));
      try {
        await audioRef.current.play();
        setStreamStatus('LIVE STREAMING');
      } catch {
        // Automatic fallback to built-in Highway Cruiser Synth if offline or blocked
        setUseBuiltInSynth(true);
        startRoadSynthLoop(station.fallbackSynthStyle);
        setStreamStatus('FALLBACK ROAD SYNTH ACTIVE');
      }
    }
  };

  useEffect(() => {
    return () => stopSynthLoop();
  }, []);

  return (
    <section className="panel net-radio-panel" aria-label="Internet Radio and WebSDR Bridge">
      <audio ref={audioRef} crossOrigin="anonymous" />
      <div className="panel-header">
        <div className="panel-title-group">
          <span className={`status-led ${isPlaying ? 'led-emerald' : 'led-amber'}`} />
          <h2 className="panel-title">INTERNET RADIO &amp; LIVE WEBSDR DECK</h2>
        </div>
        <span className="badge-mono">{streamStatus}</span>
      </div>

      <div className="net-radio-body">
        <div className="station-readout-box">
          <div className="station-meta">
            <div className="station-title">{selectedStation.name}</div>
            <div className="station-genre">
              {selectedStation.genre} • {useBuiltInSynth ? 'Built-in DSP Road Synth' : selectedStation.bitrate}
            </div>
          </div>

          <div className="ducking-status-box">
            <span className="ducking-label">SIDECHAIN DUCKER</span>
            <span className={`ducking-badge ${isCurrentlyDucked ? 'ducked' : 'clear'}`}>
              {isCurrentlyDucked ? `DUCKED ${attenuationDb} dB (CB VOICE)` : '0 dB (FULL GAIN)'}
            </span>
          </div>
        </div>

        {/* Station Preset Selector Grid */}
        <div className="station-presets-grid">
          {INTERNET_RADIO_PRESETS.map((st) => {
            const active = st.id === selectedStation.id && isPlaying;
            return (
              <button
                key={st.id}
                type="button"
                className={`station-preset-btn ${active ? 'active' : ''}`}
                onClick={() => togglePlay(st, useBuiltInSynth)}
              >
                <span className="preset-name">{st.name}</span>
                <span className="preset-sub">{st.genre}</span>
              </button>
            );
          })}
        </div>

        {/* Controls Row: Play/Stop, Volume, Auto-Duck Toggle, Synth/Stream Switch */}
        <div className="net-controls-row">
          <button
            type="button"
            className={`action-btn ${isPlaying ? 'btn-stop' : 'btn-play'}`}
            onClick={() => togglePlay(selectedStation, useBuiltInSynth)}
          >
            {isPlaying ? '■ STOP RADIO' : '▶ PLAY INTERNET RADIO'}
          </button>

          <button
            type="button"
            className={`chip-btn ${autoDuckEnabled ? 'active' : ''}`}
            onClick={onToggleAutoDuck}
            title="Automatically ducks music by -18 dB in 15ms whenever CB squelch breaks or PTT is pressed"
          >
            AUTO-DUCK: {autoDuckEnabled ? 'ON (-18dB)' : 'OFF'}
          </button>

          <button
            type="button"
            className={`chip-btn ${useBuiltInSynth ? 'active' : ''}`}
            onClick={() => {
              const next = !useBuiltInSynth;
              setUseBuiltInSynth(next);
              if (isPlaying) {
                togglePlay(selectedStation, next);
              }
            }}
            title="Toggle between live Icecast stream and instant offline Highway Synth beat"
          >
            {useBuiltInSynth ? 'MODE: BUILT-IN SYNTH' : 'MODE: LIVE ICECAST'}
          </button>
        </div>

        <div className="slider-row">
          <label htmlFor="net-vol-slider" className="slider-label">
            DECK LEVEL: {Math.round(musicVolume * 100)}%
          </label>
          <input
            id="net-vol-slider"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={musicVolume}
            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
            className="tactical-slider"
          />
        </div>

        {/* Live External 11m WebSDR / KiwiSDR Bridge */}
        <div className="websdr-bridge-box">
          <div className="websdr-info">
            <span className="websdr-title">LIVE 11M (27 MHz) OVER-THE-AIR WEBSDR BRIDGE</span>
            <span className="websdr-sub">
              Tune external physical HF/CB receivers to Ch {currentCbChannel} ({currentFreqMhz.toFixed(3)} MHz)
            </span>
          </div>
          <div className="websdr-links">
            <a
              href={`http://kiwisdr.com/public/`}
              target="_blank"
              rel="noreferrer"
              className="chip-link"
            >
              OPEN KIWISDR GLOBAL NET ↗
            </a>
            <a
              href={`http://websdr.ewi.utwente.nl:8901/?tune=${Math.round(currentFreqMhz * 1000)}am`}
              target="_blank"
              rel="noreferrer"
              className="chip-link"
            >
              TUNE {currentFreqMhz.toFixed(3)} MHz WEBSDR ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
