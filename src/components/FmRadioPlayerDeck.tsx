import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CURATED_FM_STATIONS,
  FmRadioService,
  FmStation,
} from '../radio/fmRadioService';
import {
  Radio,
  Play,
  Square,
  Volume2,
  VolumeX,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Star,
  ExternalLink,
  Plus,
  Compass,
  Zap,
} from 'lucide-react';

interface FmRadioPlayerDeckProps {
  duckGain: number; // 1.0 normal, 0.125 (-18 dB) when ducked by CB RF/PTT
  autoDuckEnabled: boolean;
  onToggleAutoDuck: () => void;
  onTuneTransceiverVfo?: (freqMhz: number) => void;
}

export const FmRadioPlayerDeck: React.FC<FmRadioPlayerDeckProps> = ({
  duckGain,
  autoDuckEnabled,
  onToggleAutoDuck,
  onTuneTransceiverVfo,
}) => {
  const service = FmRadioService.getInstance();

  // Active Station & Tuner State
  const [currentStation, setCurrentStation] = useState<FmStation>(CURATED_FM_STATIONS[0]);
  const [dialFreqMhz, setDialFreqMhz] = useState<number>(CURATED_FM_STATIONS[0].frequencyMhz);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.75);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Station Directory Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [stations, setStations] = useState<FmStation[]>(CURATED_FM_STATIONS);
  const [searching, setSearching] = useState<boolean>(false);

  // Preset Banks (P1 - P8)
  const [presets, setPresets] = useState<FmStation[]>(() => service.loadMemoryPresets());
  const [saveSlotIndex, setSaveSlotIndex] = useState<number | null>(null);

  // Custom Stream Modal State
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customFreq, setCustomFreq] = useState<string>('98.5');
  const [customGenre, setCustomGenre] = useState<string>('Custom Stream');

  // Audio & Visualizer Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const visualizerBars = useRef<number[]>(new Array(48).fill(0.1));

  // Auto-Ducking calculations
  const effectiveVolume = isPlaying && !isMuted ? volume * (autoDuckEnabled ? duckGain : 1.0) : 0;
  const isCurrentlyDucked = autoDuckEnabled && duckGain < 0.85 && isPlaying;
  const attenuationDb = isCurrentlyDucked
    ? Math.round(20 * Math.log10(Math.max(0.05, duckGain)))
    : 0;

  // Sync volume with auto-ducking to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, effectiveVolume));
    }
  }, [effectiveVolume]);

  // Handle Play Station
  const handlePlayStation = async (station: FmStation) => {
    setStreamError(null);
    setCurrentStation(station);
    setDialFreqMhz(station.frequencyMhz);
    setIsLoading(true);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = station.streamUrl;
      audioRef.current.load();

      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      } catch (err: unknown) {
        setIsLoading(false);
        setIsPlaying(false);
        const errMsg = err instanceof Error ? err.message : 'Playback failed';
        setStreamError(`Stream blocked or offline: ${errMsg}`);
      }
    }
  };

  // Cleanly Stop Playback & Terminate Audio Stream Buffer
  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  // Toggle Play / Pause
  const handleTogglePlay = async () => {
    if (isPlaying) {
      handleStop();
    } else {
      await handlePlayStation(currentStation);
    }
  };

  // Perform Online Search via Radio-Browser API
  const handleSearch = useCallback(
    async (query: string, genre: string) => {
      setSearching(true);
      try {
        const results = await service.searchOnlineStations(query, genre, '', 30);
        setStations(results);
      } finally {
        setSearching(false);
      }
    },
    [service]
  );

  // Trigger search on query or genre change
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery, selectedGenre);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedGenre, handleSearch]);

  // Frequency Dial Step Tuning
  const handleDialStep = (stepMhz: number) => {
    const nextFreq = Math.round((dialFreqMhz + stepMhz) * 10) / 10;
    if (nextFreq >= 87.5 && nextFreq <= 108.0) {
      setDialFreqMhz(nextFreq);
      // Find station on or closest to this frequency
      const match = stations.find((s) => Math.abs(s.frequencyMhz - nextFreq) < 0.15);
      if (match) {
        handlePlayStation(match);
      }
    }
  };

  // Seek Up / Down to Next Available Station
  const handleSeek = (direction: 'UP' | 'DOWN') => {
    const sorted = [...stations].sort((a, b) => a.frequencyMhz - b.frequencyMhz);
    if (sorted.length === 0) return;

    if (direction === 'UP') {
      const next = sorted.find((s) => s.frequencyMhz > dialFreqMhz + 0.1);
      if (next) handlePlayStation(next);
      else handlePlayStation(sorted[0]); // Wrap around
    } else {
      const prev = [...sorted].reverse().find((s) => s.frequencyMhz < dialFreqMhz - 0.1);
      if (prev) handlePlayStation(prev);
      else handlePlayStation(sorted[sorted.length - 1]); // Wrap around
    }
  };

  // Save to Preset Slot
  const handleSaveToPreset = (slotIndex: number) => {
    const updated = [...presets];
    updated[slotIndex] = currentStation;
    setPresets(updated);
    service.saveMemoryPresets(updated);
    setSaveSlotIndex(null);
  };

  // Add Custom Station Form Submit
  const handleAddCustomStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customUrl.trim()) return;

    const freq = parseFloat(customFreq) || 98.5;
    const newStation: FmStation = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      frequencyMhz: Math.round(freq * 10) / 10,
      genre: customGenre.trim() || 'Custom Stream',
      country: 'Custom',
      bitrate: '128 kbps',
      codec: 'MP3',
      streamUrl: customUrl.trim(),
      isCustom: true,
    };

    setStations((prev) => [newStation, ...prev]);
    handlePlayStation(newStation);
    setShowCustomModal(false);
    setCustomName('');
    setCustomUrl('');
  };

  // Real-Time Canvas Audio Spectrum Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const numBars = 48;
      const barWidth = w / numBars - 2;

      // Update animated bar values based on playing state
      for (let i = 0; i < numBars; i++) {
        if (isPlaying && !isMuted) {
          const target = Math.random() * 0.85 + 0.15;
          visualizerBars.current[i] += (target - visualizerBars.current[i]) * 0.25;
        } else {
          visualizerBars.current[i] *= 0.88;
        }

        const barHeight = Math.max(2, visualizerBars.current[i] * h);
        const x = i * (barWidth + 2);
        const y = h - barHeight;

        // Gradient coloring: cyan to amber to red
        const grad = ctx.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(0.65, '#f59e0b');
        grad.addColorStop(1, '#ef4444');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isMuted]);

  // Standard Genres for Quick Filter Buttons
  const GENRE_PILLS = [
    { id: 'ALL', label: 'ALL STATIONS' },
    { id: 'ROCK', label: 'ROCK / INDIE' },
    { id: 'COUNTRY', label: 'COUNTRY' },
    { id: 'NEWS', label: 'NEWS / NPR' },
    { id: 'JAZZ', label: 'JAZZ / BLUES' },
    { id: 'POP', label: 'POP / TOP 40' },
    { id: 'ELECTRONIC', label: 'ELECTRONIC' },
    { id: '80S', label: '80s / RETRO' },
    { id: 'CLASSICAL', label: 'CLASSICAL' },
  ];

  return (
    <section className="panel fm-radio-deck font-mono space-y-4" aria-label="FM Broadcast Radio Player">
      {/* Invisible HTML5 Audio Stream Element */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onPlaying={() => {
          setIsPlaying(true);
          setIsLoading(false);
          setStreamError(null);
        }}
        onWaiting={() => setIsLoading(true)}
        onError={() => {
          setIsLoading(false);
          setIsPlaying(false);
          setStreamError('Stream connection lost or codec unsupported by browser.');
        }}
      />

      {/* 1. Deck Header & Status */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className={`status-led ${isPlaying ? 'led-emerald' : 'led-amber'}`} />
          <h2 className="panel-title">FM BROADCAST RADIO PLAYER &amp; ONLINE DIRECTORY</h2>
          <span className="badge-mono hidden sm:inline-block">87.5 – 108.0 MHz WFM</span>
        </div>

        <div className="flex items-center gap-2">
          {onTuneTransceiverVfo && (
            <button
              type="button"
              onClick={() => onTuneTransceiverVfo(currentStation.frequencyMhz)}
              className="px-3.5 py-1.5 rounded-md text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Tune Transceiver VFO A to this exact FM broadcast frequency in WFM mode"
            >
              <Compass className="w-3.5 h-3.5 text-amber-400" /> TUNE VFO ({currentStation.frequencyMhz.toFixed(1)} MHz)
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCustomModal(true)}
            className="px-3.5 py-1.5 rounded-md text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> ADD STREAM URL
          </button>
        </div>
      </div>

      {/* 2. Main Tactical FM Radio Faceplate (Dial, LED Readout, Visualizer) */}
      <div className="bg-gradient-to-b from-[#0e1624] via-[#090d16] to-[#04070c] p-4 sm:p-5 rounded-2xl border-2 border-amber-500/40 shadow-2xl space-y-4">
        {/* Top Info Readout Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-md text-[10px] font-bold bg-red-950/80 text-red-400 border border-red-700 animate-pulse">
              ● LIVE ON AIR
            </span>
            <span className="px-3 py-1 rounded-md text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
              FM STEREO
            </span>
            <span className="px-3 py-1 rounded-md text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" /> RDS ACTIVE
            </span>
          </div>

          {/* Auto-Ducking Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 font-bold">SIDECHAIN DUCKER:</span>
            <span
              className={`px-3 py-1 rounded-md text-[10px] font-bold border transition-all ${
                isCurrentlyDucked
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isCurrentlyDucked ? `DUCKED ${attenuationDb} dB (RF VOICE ACTIVE)` : '0 dB (FULL VOLUME)'}
            </span>
          </div>
        </div>

        {/* Digital Frequency Readout & RDS Banner */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Big Frequency Readout */}
          <div className="md:col-span-5 flex flex-col justify-center items-start bg-black/60 p-3.5 rounded-xl border border-zinc-800 shadow-inner">
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              CARRIER FREQUENCY
            </div>
            <div className="font-mono text-4xl sm:text-5xl font-black text-amber-400 tracking-tight flex items-baseline">
              <span>{currentStation.frequencyMhz.toFixed(1)}</span>
              <span className="text-xs sm:text-sm text-zinc-400 ml-2 font-sans font-bold">MHz FM</span>
            </div>
            <div className="text-xs text-emerald-400 font-bold truncate mt-1">
              {currentStation.name}
            </div>
          </div>

          {/* Scrolling RDS Text & Metadata */}
          <div className="md:col-span-7 flex flex-col justify-between bg-black/60 p-3.5 rounded-xl border border-zinc-800 space-y-2 h-full">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-bold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400" /> RDS PROGRAM SERVICE:
              </span>
              <span className="text-amber-300 font-bold font-mono text-sm">
                {currentStation.name.slice(0, 16)}
              </span>
            </div>

            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-900 text-xs font-mono text-zinc-300 overflow-hidden whitespace-nowrap">
              <span className="text-cyan-400 font-bold">NOW PLAYING: </span>
              <span>{currentStation.genre} • {currentStation.bitrate} {currentStation.codec} • {currentStation.country}</span>
            </div>

            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>Station ID: {currentStation.id.slice(0, 18)}</span>
              <span>Bitrate: {currentStation.bitrate}</span>
            </div>
          </div>
        </div>

        {/* Tactical Analog FM Dial Track (87.5 - 108.0 MHz) */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-[11px] font-mono font-bold text-zinc-400 px-1">
            <span>88</span>
            <span>90</span>
            <span>92</span>
            <span>94</span>
            <span>96</span>
            <span>98</span>
            <span>100</span>
            <span>102</span>
            <span>104</span>
            <span>106</span>
            <span>108 MHz</span>
          </div>

          <div
            className="relative h-12 bg-black rounded-lg border border-zinc-700 cursor-pointer overflow-hidden select-none"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              const clickedFreq = Math.round((87.5 + pct * (108.0 - 87.5)) * 10) / 10;
              setDialFreqMhz(clickedFreq);
              const match = stations.find((s) => Math.abs(s.frequencyMhz - clickedFreq) < 0.2);
              if (match) handlePlayStation(match);
            }}
            title="Click anywhere to tune dial needle"
          >
            {/* Tuning Scale Hash Marks */}
            <div className="absolute inset-0 flex justify-between items-end pb-1.5 px-2 pointer-events-none opacity-40">
              {Array.from({ length: 41 }).map((_, i) => (
                <div
                  key={i}
                  className={`bg-zinc-400 ${i % 4 === 0 ? 'h-6 w-0.5' : 'h-3 w-px'}`}
                />
              ))}
            </div>

            {/* Glowing Orange Needle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-amber-300 via-amber-500 to-red-500 shadow-[0_0_12px_#f59e0b] pointer-events-none transition-all duration-150"
              style={{
                left: `${Math.max(0, Math.min(100, ((dialFreqMhz - 87.5) / (108.0 - 87.5)) * 100))}%`,
              }}
            >
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full -ml-[3px] shadow-[0_0_8px_#f59e0b]" />
            </div>
          </div>
        </div>

        {/* Tuning Step & Seek Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleSeek('DOWN')}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-md font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Auto-seek down to previous online FM station"
          >
            <ChevronLeft className="w-4 h-4" /> SEEK DOWN
          </button>
          <button
            type="button"
            onClick={() => handleDialStep(-0.1)}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-md font-bold text-xs cursor-pointer transition-colors"
          >
            -0.1 MHz
          </button>
          <div className="px-4 py-1.5 bg-zinc-950 text-amber-300 border border-zinc-800 rounded-md font-bold text-xs font-mono">
            DIAL: {dialFreqMhz.toFixed(1)} MHz
          </div>
          <button
            type="button"
            onClick={() => handleDialStep(0.1)}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-md font-bold text-xs cursor-pointer transition-colors"
          >
            +0.1 MHz
          </button>
          <button
            type="button"
            onClick={() => handleSeek('UP')}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-md font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Auto-seek up to next online FM station"
          >
            SEEK UP <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Live Audio Spectrum Visualizer */}
        <div className="bg-black/80 rounded-xl p-2.5 border border-zinc-800/80 shadow-inner">
          <canvas
            ref={canvasRef}
            width={580}
            height={52}
            className="w-full h-14 block rounded"
          />
        </div>

        {/* Stream Error Alert if any */}
        {streamError && (
          <div className="bg-red-950/70 border border-red-800 text-red-300 text-xs px-3.5 py-2 rounded-lg flex items-center justify-between">
            <span>{streamError}</span>
            <button
              onClick={() => handlePlayStation(CURATED_FM_STATIONS[0])}
              className="px-2.5 py-1 bg-red-900 text-white rounded text-[11px] font-bold"
            >
              SWITCH TO BACKUP
            </button>
          </div>
        )}

        {/* Master Audio Controls Bar (Play/Stop, Volume, Mute, Duck Toggle) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={isLoading}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs font-mono flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/30'
              }`}
            >
              {isLoading ? (
                <span>BUFFERING...</span>
              ) : isPlaying ? (
                <>
                  <Square className="w-4 h-4 fill-current" /> STOP RADIO
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> PLAY FM RADIO
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-800 cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs">
              <span className="text-zinc-400 text-[11px]">VOL:</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-24 sm:w-32 accent-amber-500 cursor-pointer"
              />
              <span className="text-amber-300 font-bold w-9 text-right">
                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleAutoDuck}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                autoDuckEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}
              title="When enabled, music volume ducks by -18 dB whenever CB voice or PTT is keyed"
            >
              <Zap className="w-3.5 h-3.5" /> AUTO-DUCK: {autoDuckEnabled ? 'ON (-18dB)' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => setSaveSlotIndex((prev) => (prev === null ? 0 : null))}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Save current playing station to one of the 8 car preset slots"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400/40 text-amber-400" /> SAVE PRESET
            </button>
          </div>
        </div>

        {/* Preset Save Slot Selector (P1 - P8) if activated */}
        {saveSlotIndex !== null && (
          <div className="p-3 bg-zinc-900 rounded-xl border border-amber-500/40 space-y-2">
            <div className="text-xs text-amber-300 font-bold flex justify-between items-center">
              <span>SELECT PRESET SLOT TO STORE "{currentStation.name}":</span>
              <button onClick={() => setSaveSlotIndex(null)} className="text-zinc-500 hover:text-white">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {presets.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSaveToPreset(i)}
                  className="py-1.5 px-2 bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-300 rounded-md font-bold text-xs border border-zinc-700 transition-colors"
                >
                  SET P{i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Car-Style 8-Channel Preset Bank Buttons (P1 - P8) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-mono text-zinc-400">
          <span className="font-bold flex items-center gap-1.5 text-zinc-300">
            <Star className="w-3.5 h-3.5 text-amber-400" /> QUICK CAR MEMORY PRESETS (P1 - P8)
          </span>
          <span className="text-[11px] text-zinc-500">1-Click Recall</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {presets.map((station, idx) => {
            const isCurrent = station.id === currentStation.id;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => (isCurrent && isPlaying ? handleStop() : handlePlayStation(station))}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer min-h-[68px] ${
                  isCurrent && isPlaying
                    ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-md shadow-amber-500/20'
                    : isCurrent
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800'
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className={`text-[10px] font-bold ${isCurrent ? 'text-black' : 'text-zinc-500'}`}>
                    P{idx + 1}
                  </span>
                  <span className={`text-[10px] font-bold ${isCurrent ? 'text-black' : 'text-amber-400'}`}>
                    {station.frequencyMhz.toFixed(1)}
                  </span>
                </div>
                <div className="font-bold text-xs truncate w-full mt-1">{station.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Live Online Radio Station Directory Search Engine */}
      <div className="space-y-3 pt-2 border-t border-zinc-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" /> ONLINE FM &amp; BROADCAST STREAM DIRECTORY
            </h3>
            <p className="text-xs text-zinc-500">
              Query over 40,000 live community broadcast stations via the Radio-Browser API.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by callsign, genre, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 pl-9 pr-3.5 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500 font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Genre Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {GENRE_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSelectedGenre(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                selectedGenre === pill.id
                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20'
                  : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border-zinc-800'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Station Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
          {searching ? (
            <div className="col-span-full py-12 text-center text-zinc-500 text-xs">
              Querying online radio database...
            </div>
          ) : stations.length === 0 ? (
            <div className="col-span-full py-12 text-center text-zinc-500 text-xs bg-black/20 rounded-xl border border-zinc-900">
              No matching stations found. Try searching for "rock", "country", "jazz", or a callsign.
            </div>
          ) : (
            stations.map((st) => {
              const isCurrent = st.id === currentStation.id && isPlaying;
              return (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-md'
                      : 'bg-black/40 border-zinc-800/90 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-amber-400 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5" /> {st.frequencyMhz.toFixed(1)} MHz
                      </span>
                      <span className="text-[10px] px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 font-bold border border-zinc-700/80">
                        {st.bitrate}
                      </span>
                    </div>

                    <div className="text-zinc-100 font-bold text-sm truncate" title={st.name}>
                      {st.name}
                    </div>

                    <div className="text-xs text-zinc-400 truncate" title={st.genre}>
                      {st.genre}
                    </div>

                    <div className="text-[11px] text-zinc-500">
                      {st.country} {st.state ? `• ${st.state}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2.5 border-t border-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => (isCurrent ? handleStop() : handlePlayStation(st))}
                      className={`flex-1 py-2 px-3.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/40'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-black shadow-sm'
                      }`}
                    >
                      {isCurrent ? <Square className="w-3.5 h-3.5 fill-current shrink-0" /> : <Play className="w-3.5 h-3.5 fill-current shrink-0" />}
                      <span>{isCurrent ? 'STOP RADIO' : 'TUNE IN'}</span>
                    </button>

                    {onTuneTransceiverVfo && (
                      <button
                        type="button"
                        onClick={() => onTuneTransceiverVfo(st.frequencyMhz)}
                        className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs border border-zinc-700 cursor-pointer font-bold font-mono"
                        title="Set VFO A to this frequency"
                      >
                        VFO
                      </button>
                    )}

                    {st.homepageUrl && (
                      <a
                        href={st.homepageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-800"
                        title="Open Station Homepage"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Custom Stream URL Entry Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCustomStation}
            className="bg-[#0f1724] border border-zinc-700 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> ADD CUSTOM ONLINE FM STREAM
              </span>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-zinc-400 hover:text-white px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">STATION NAME / CALLSIGN:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Favorite FM Station"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-black border border-zinc-700 text-white px-3.5 py-2 rounded-lg font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">STREAM AUDIO URL (MP3 / AAC / ICECAST / HLS):</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/stream.mp3"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full bg-black border border-zinc-700 text-cyan-300 px-3.5 py-2 rounded-lg font-mono focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">FM FREQUENCY (MHz):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="87.5"
                    max="108.0"
                    value={customFreq}
                    onChange={(e) => setCustomFreq(e.target.value)}
                    className="w-full bg-black border border-zinc-700 text-amber-300 px-3.5 py-2 rounded-lg font-mono font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">GENRE / FORMAT:</label>
                  <input
                    type="text"
                    placeholder="e.g. Rock / News"
                    value={customGenre}
                    onChange={(e) => setCustomGenre(e.target.value)}
                    className="w-full bg-black border border-zinc-700 text-white px-3.5 py-2 rounded-lg font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs shadow-md"
              >
                ADD &amp; PLAY NOW
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
