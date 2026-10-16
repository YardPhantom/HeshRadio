import React, { useState } from 'react';
import {
  BandPlan,
  MASTER_BAND_PLANS,
  ModulationModeExtended,
} from '../radio/bandPlans';
import { CTCSS_TONES_HZ, CtcssDetectionResult } from '../radio/ctcssTones';
import { RdsStationData } from '../radio/demodulators';
import {
  Radio,
  Split,
  Layers,
  Activity,
  Sparkles,
  Compass,
  ArrowRightLeft,
  Copy,
  Hash,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MultiBandVfoDeckProps {
  currentBand: BandPlan;
  frequencyMhz: number;
  vfoAFreqMhz: number;
  vfoBFreqMhz: number;
  activeVfo: 'VFO_A' | 'VFO_B';
  mode: ModulationModeExtended;
  stepHz: number;
  repeaterOffsetMode: 'SIMPLEX' | 'PLUS_OFFSET' | 'MINUS_OFFSET' | 'SPLIT';
  repeaterOffsetMhz: number;
  ctcssToneHz: number | null;
  ctcssSquelchEnabled: boolean;
  ctcssResult: CtcssDetectionResult;
  cwBfoPitchHz: number;
  rdsData: RdsStationData;
  onSelectBand: (band: BandPlan) => void;
  onFrequencyChange: (freqMhz: number) => void;
  onModeChange: (mode: ModulationModeExtended) => void;
  onStepChange: (stepHz: number) => void;
  onVfoSwitch: () => void;
  onVfoCopy: () => void;
  onRepeaterOffsetModeChange: (mode: 'SIMPLEX' | 'PLUS_OFFSET' | 'MINUS_OFFSET' | 'SPLIT') => void;
  onRepeaterOffsetMhzChange: (offsetMhz: number) => void;
  onCtcssToneChange: (toneHz: number | null) => void;
  onCtcssSquelchToggle: (enabled: boolean) => void;
  onCwBfoPitchChange: (pitchHz: number) => void;
}

// Popular quick bands for 1-click access
const POPULAR_BAND_IDS = ['11M_CB', '2M_HAM', '70CM_HAM', 'GMRS_FRS', 'NOAA_WEATHER', 'AIRBAND_VHF'];

export const MultiBandVfoDeck: React.FC<MultiBandVfoDeckProps> = ({
  currentBand,
  frequencyMhz,
  vfoAFreqMhz,
  vfoBFreqMhz,
  activeVfo,
  mode,
  stepHz,
  repeaterOffsetMode,
  repeaterOffsetMhz,
  ctcssToneHz,
  ctcssSquelchEnabled,
  ctcssResult,
  cwBfoPitchHz,
  rdsData,
  onSelectBand,
  onFrequencyChange,
  onModeChange,
  onStepChange,
  onVfoSwitch,
  onVfoCopy,
  onRepeaterOffsetModeChange,
  onRepeaterOffsetMhzChange,
  onCtcssToneChange,
  onCtcssSquelchToggle,
  onCwBfoPitchChange,
}) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');

  // Format frequency to 6 decimal places: e.g. "146.520000" or "027.185000"
  const formattedFreq = frequencyMhz.toFixed(6).padStart(10, '0');
  const mhzPart = formattedFreq.slice(0, -7);
  const khzPart = formattedFreq.slice(-7, -4);
  const hzPart = formattedFreq.slice(-4);

  const handleStepTune = (multiplier: number) => {
    const deltaMhz = (stepHz / 1e6) * multiplier;
    const newFreq = Math.max(0.1, Math.min(1750.0, frequencyMhz + deltaMhz));
    onFrequencyChange(parseFloat(newFreq.toFixed(6)));
  };

  const handleKeypadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(keypadInput.trim());
    if (!isNaN(val) && val >= 0.1 && val <= 1750.0) {
      onFrequencyChange(parseFloat(val.toFixed(6)));
      setShowKeypad(false);
      setKeypadInput('');
    }
  };

  return (
    <div className="bg-[#0b1017]/95 border border-amber-900/40 rounded-xl p-3.5 shadow-2xl space-y-3.5">
      {/* 1. Header & Streamlined Band Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Radio className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-zinc-100 tracking-wider text-sm whitespace-nowrap">
              MULTI-BAND VFO &amp; SDR
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono shrink-0 hidden sm:inline-block">
              100 kHz – 1.75 GHz
            </span>
          </div>
        </div>

        {/* Streamlined Band Selector: Quick Popular Pills + All Bands Dropdown */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Popular Band Quick Pills */}
          <div className="flex flex-wrap items-center gap-1">
            {MASTER_BAND_PLANS.filter((b) => POPULAR_BAND_IDS.includes(b.id)).map((b) => {
              const isSelected = b.id === currentBand.id;
              const shortName = b.name.split(' ')[0];
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelectBand(b)}
                  className={`text-xs px-2.5 py-1 rounded font-mono font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80 hover:bg-zinc-700 hover:text-amber-300'
                  }`}
                  title={b.description}
                >
                  {shortName}
                </button>
              );
            })}
          </div>

          {/* All Bands Dropdown (eliminates clutter of 18 separate buttons) */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700/90 rounded px-2 py-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">ALL BANDS:</span>
            <select
              value={currentBand.id}
              onChange={(e) => {
                const found = MASTER_BAND_PLANS.find((b) => b.id === e.target.value);
                if (found) onSelectBand(found);
              }}
              className="bg-transparent text-amber-300 text-xs font-mono font-bold focus:outline-none cursor-pointer"
              aria-label="Select RF Band"
            >
              <optgroup label="HF & 11-Meter CB" className="bg-zinc-900 text-zinc-300">
                {MASTER_BAND_PLANS.filter((b) => b.frequencyMaxMhz <= 30).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="VHF & UHF Bands" className="bg-zinc-900 text-zinc-300">
                {MASTER_BAND_PLANS.filter((b) => b.frequencyMaxMhz > 30).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Main High-Precision Tactical Frequency Display & VFO Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left: VFO A / VFO B Switcher & Repeater Shift Controls */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-2.5 bg-black/40 p-3 rounded-xl border border-zinc-800/80">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-400 font-bold flex items-center gap-1.5">
                <Split className="w-3.5 h-3.5 text-amber-400" /> VFO SYSTEM
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={onVfoSwitch}
                  className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-amber-500/20 text-amber-300 rounded border border-zinc-700 flex items-center gap-1 font-mono font-bold cursor-pointer transition-colors"
                  title="Swap VFO A and VFO B"
                >
                  <ArrowRightLeft className="w-3 h-3 text-amber-400" /> A / B
                </button>
                <button
                  type="button"
                  onClick={onVfoCopy}
                  className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-amber-500/20 text-zinc-300 rounded border border-zinc-700 flex items-center gap-1 font-mono font-bold cursor-pointer transition-colors"
                  title="Copy Active VFO to Inactive VFO (A = B)"
                >
                  <Copy className="w-3 h-3" /> A=B
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div
                className={`p-2 rounded-lg border transition-all ${
                  activeVfo === 'VFO_A'
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 font-bold shadow-sm'
                    : 'border-zinc-800/80 bg-zinc-900/50 text-zinc-400'
                }`}
              >
                <div className="text-[10px] uppercase text-zinc-500 font-bold">VFO A (RX)</div>
                <div className="truncate text-sm">{vfoAFreqMhz.toFixed(4)} MHz</div>
              </div>
              <div
                className={`p-2 rounded-lg border transition-all ${
                  activeVfo === 'VFO_B'
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 font-bold shadow-sm'
                    : 'border-zinc-800/80 bg-zinc-900/50 text-zinc-400'
                }`}
              >
                <div className="text-[10px] uppercase text-zinc-500 font-bold">VFO B (TX/SPLIT)</div>
                <div className="truncate text-sm">{vfoBFreqMhz.toFixed(4)} MHz</div>
              </div>
            </div>
          </div>

          {/* Repeater Offset Selector (Clean 2x2 layout with proper breathing room) */}
          <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="font-bold">REPEATER SHIFT:</span>
              <span className="text-amber-400 font-bold">{repeaterOffsetMode}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
              {(
                [
                  { id: 'SIMPLEX', label: 'SIMPLEX' },
                  { id: 'PLUS_OFFSET', label: '+RPT SHIFT' },
                  { id: 'MINUS_OFFSET', label: '-RPT SHIFT' },
                  { id: 'SPLIT', label: 'SPLIT VFO' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onRepeaterOffsetModeChange(id)}
                  className={`py-1.5 px-2 text-center rounded border font-bold transition-all cursor-pointer ${
                    repeaterOffsetMode === id
                      ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {repeaterOffsetMode !== 'SIMPLEX' && repeaterOffsetMode !== 'SPLIT' && (
              <div className="mt-1.5 flex items-center justify-between text-xs font-mono text-zinc-400 bg-zinc-900/90 px-2.5 py-1.5 rounded border border-zinc-800">
                <span className="font-bold">OFFSET:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.05"
                    value={repeaterOffsetMhz}
                    onChange={(e) => onRepeaterOffsetMhzChange(parseFloat(e.target.value) || 0)}
                    className="w-20 bg-black text-right text-amber-300 px-1.5 py-0.5 rounded border border-zinc-700 focus:outline-none font-bold"
                  />
                  <span className="text-zinc-500">MHz</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Large Tactical LED Frequency Display & Quick Step Controls (Guaranteed ZERO OVERLAY) */}
        <div className="lg:col-span-6 bg-black p-4 rounded-xl border-2 border-amber-500/40 shadow-inner flex flex-col justify-between items-center min-h-[175px]">
          {/* Top Info Bar (Guaranteed No Overlay with Band Name or Direct Tune button) */}
          <div className="w-full flex items-center justify-between text-xs font-mono pb-2 border-b border-zinc-900 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-amber-400 font-bold uppercase truncate max-w-[240px] sm:max-w-xs" title={currentBand.name}>
                {currentBand.name}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold shrink-0">
                {activeVfo} ACTIVE
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowKeypad(true)}
              className="text-xs bg-zinc-900 hover:bg-amber-500/20 text-zinc-300 hover:text-amber-300 px-2.5 py-1 rounded border border-zinc-800 font-mono flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              title="Direct Frequency Keypad"
            >
              <Hash className="w-3.5 h-3.5 text-amber-400" /> DIRECT TUNE
            </button>
          </div>

          {/* Large Digit Readout (Cleanly Isolated) */}
          <div className="font-mono text-amber-400 font-black tracking-tight flex items-baseline select-none py-3 text-3xl sm:text-4xl lg:text-5xl whitespace-nowrap">
            <span className="text-amber-200">{mhzPart}</span>
            <span className="text-zinc-400 mx-0.5">.</span>
            <span className="text-amber-300">{khzPart}</span>
            <span className="text-amber-500/80 text-xl sm:text-2xl lg:text-3xl ml-0.5">{hzPart}</span>
            <span className="text-xs sm:text-sm text-zinc-400 ml-2.5 font-sans font-bold">MHz</span>
          </div>

          {/* Step Tuning Controls (Cleanly Aligned with proper symbols) */}
          <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-zinc-900">
            <button
              type="button"
              onClick={() => handleStepTune(-10)}
              className="text-xs px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded font-mono font-bold border border-zinc-800 cursor-pointer"
            >
              -10x
            </button>
            <button
              type="button"
              onClick={() => handleStepTune(-1)}
              className="text-xs px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-mono font-bold border border-amber-500/40 flex items-center gap-1 cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5" /> STEP DN
            </button>
            <div className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800 text-xs font-mono text-zinc-300">
              <span className="text-[10px] text-zinc-500 font-bold">STEP:</span>
              <select
                value={stepHz}
                onChange={(e) => onStepChange(parseInt(e.target.value, 10))}
                className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
                aria-label="Tuning Step"
              >
                <option value={100} className="bg-zinc-900">100 Hz</option>
                <option value={1000} className="bg-zinc-900">1 kHz</option>
                <option value={5000} className="bg-zinc-900">5 kHz</option>
                <option value={6250} className="bg-zinc-900">6.25 kHz</option>
                <option value={8333} className="bg-zinc-900">8.33 kHz (Air)</option>
                <option value={10000} className="bg-zinc-900">10 kHz (CB)</option>
                <option value={12500} className="bg-zinc-900">12.5 kHz (NFM)</option>
                <option value={20000} className="bg-zinc-900">20 kHz (2m)</option>
                <option value={25000} className="bg-zinc-900">25 kHz</option>
                <option value={50000} className="bg-zinc-900">50 kHz</option>
                <option value={100000} className="bg-zinc-900">100 kHz (WFM)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => handleStepTune(1)}
              className="text-xs px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-mono font-bold border border-amber-500/40 flex items-center gap-1 cursor-pointer"
            >
              STEP UP <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleStepTune(10)}
              className="text-xs px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded font-mono font-bold border border-zinc-800 cursor-pointer"
            >
              +10x
            </button>
          </div>
        </div>

        {/* Right: Demodulator Bank Selector & Mode Subpanels */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-2.5 bg-black/40 p-3 rounded-xl border border-zinc-800/80">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400 font-bold">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" /> DEMODULATOR
              </span>
              <span className="text-amber-400 font-bold">{mode}</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 font-mono text-xs font-bold">
              {(['AM', 'NFM', 'WFM', 'USB', 'LSB', 'CW'] as const).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onModeChange(m)}
                    className={`py-2 text-center rounded-lg border transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30'
                        : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80 hover:bg-zinc-700 hover:text-amber-300'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Demodulator Mode Details */}
          {mode === 'CW' && (
            <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-zinc-400">
                <span>CW BFO PITCH:</span>
                <span className="text-amber-300 font-bold">{cwBfoPitchHz} Hz</span>
              </div>
              <input
                type="range"
                min="400"
                max="900"
                step="10"
                value={cwBfoPitchHz}
                onChange={(e) => onCwBfoPitchChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="text-[10px] text-zinc-500 text-center font-mono">
                250 Hz DSP Filter Active
              </div>
            </div>
          )}

          {mode === 'WFM' && (
            <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-amber-500/20 text-xs font-mono space-y-1 min-h-[64px]">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> RDS BROADCAST
                </span>
                <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">
                  {rdsData.stereoDetected ? 'STEREO' : 'MONO'}
                </span>
              </div>
              <div className="text-amber-300 font-bold truncate">{rdsData.programService}</div>
              <div className="text-[11px] text-zinc-400 truncate" title={rdsData.radioText}>
                {rdsData.radioText}
              </div>
            </div>
          )}

          {mode !== 'CW' && mode !== 'WFM' && (
            <div className="bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/60 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
              <span>PASSBAND:</span>
              <span className="text-zinc-300 font-bold">
                {mode === 'AM' ? '6.0 kHz AM' : mode === 'NFM' ? '12.5 kHz NFM' : '2.7 kHz SSB'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. CTCSS Sub-Audible Tone & Band Presets (Well-Spaced, Non-Overlapping) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5 border-t border-zinc-800/80">
        {/* CTCSS (PL) Tone Sub-Audible Engine */}
        <div className="bg-black/30 p-3 rounded-xl border border-zinc-800 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-zinc-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              CTCSS (PL) SUB-AUDIBLE TONES
            </span>
            <button
              type="button"
              onClick={() => onCtcssSquelchToggle(!ctcssSquelchEnabled)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                ctcssSquelchEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              TONE SQUELCH (TSQ): {ctcssSquelchEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-zinc-400 shrink-0">PL TONE:</span>
            <select
              value={ctcssToneHz || ''}
              onChange={(e) => onCtcssToneChange(e.target.value ? parseFloat(e.target.value) : null)}
              className="bg-zinc-900 border border-zinc-700 text-amber-300 px-2.5 py-1 rounded-lg flex-1 focus:outline-none font-bold"
              aria-label="CTCSS Tone Selector"
            >
              <option value="">CSQ / CARRIER SQUELCH (NO TONE)</option>
              {CTCSS_TONES_HZ.map((tone) => (
                <option key={tone} value={tone}>
                  {tone.toFixed(1)} Hz (EIA/TIA Tone)
                </option>
              ))}
            </select>
          </div>

          {/* Live Tone Detection Telemetry */}
          <div className="flex items-center justify-between text-xs font-mono bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-400 font-bold">DECODED TONE:</span>
            {ctcssResult.detectedToneHz ? (
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                ● {ctcssResult.detectedToneHz.toFixed(1)} Hz
                <span className="text-[10px] text-zinc-500 font-normal">
                  ({Math.round(ctcssResult.detectedToneConfidence * 100)}% Match)
                </span>
              </span>
            ) : (
              <span className="text-zinc-500">NO TONE DETECTED</span>
            )}
          </div>
        </div>

        {/* Current Band Channel Presets */}
        <div className="bg-black/30 p-3 rounded-xl border border-zinc-800 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-zinc-200 flex items-center gap-1.5 truncate">
              <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{currentBand.name} PRESETS</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-mono shrink-0">
              {currentBand.presets.length} PRESETS
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-28 overflow-y-auto pr-1">
            {currentBand.presets.map((preset) => {
              const isActive = Math.abs(preset.frequencyMhz - frequencyMhz) < 0.001;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    onFrequencyChange(preset.frequencyMhz);
                    onModeChange(preset.mode);
                    if (preset.repeaterOffsetMhz) {
                      onRepeaterOffsetModeChange('PLUS_OFFSET');
                      onRepeaterOffsetMhzChange(preset.repeaterOffsetMhz);
                    }
                    if (preset.ctcssToneHz) {
                      onCtcssToneChange(preset.ctcssToneHz);
                    }
                  }}
                  className={`text-xs px-2 py-1.5 rounded-lg font-mono transition-all text-left flex flex-col justify-center border cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-md'
                      : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80 hover:bg-zinc-700 hover:text-white'
                  }`}
                  title={`${preset.name}: ${preset.description}`}
                >
                  <span className="font-bold truncate">{preset.name}</span>
                  <span className={`text-[10px] ${isActive ? 'text-black/80' : 'text-zinc-400'}`}>
                    {preset.frequencyMhz.toFixed(3)} MHz
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Direct Keypad Entry Modal */}
      {showKeypad && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/40 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="font-mono font-bold text-amber-400 text-sm">
                DIRECT FREQUENCY ENTRY
              </span>
              <button
                type="button"
                onClick={() => setShowKeypad(false)}
                className="text-zinc-400 hover:text-zinc-100 text-sm font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleKeypadSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-1">
                  ENTER FREQUENCY IN MHz (0.100 – 1750.000):
                </label>
                <input
                  type="number"
                  step="0.0001"
                  autoFocus
                  placeholder="e.g. 146.520 or 27.185"
                  value={keypadInput}
                  onChange={(e) => setKeypadInput(e.target.value)}
                  className="w-full bg-black border border-zinc-700 text-amber-300 px-3 py-2 rounded font-mono text-lg font-bold focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['146.520', '446.000', '27.185', '121.500', '156.800', '14.225'].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setKeypadInput(quick)}
                    className="text-xs py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-mono font-bold cursor-pointer transition-colors"
                  >
                    {quick}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeypad(false)}
                  className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black rounded cursor-pointer shadow-md"
                >
                  TUNE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
