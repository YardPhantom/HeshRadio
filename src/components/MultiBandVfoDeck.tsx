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
    <div className="bg-[#0b1017] border border-amber-900/40 rounded-xl p-4 shadow-2xl space-y-4">
      {/* 1. Header & Band Selector Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-zinc-100 tracking-wider text-sm flex items-center gap-2">
            MULTI-BAND VFO & SDR RECEIVER
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
              100 kHz – 1.75 GHz
            </span>
          </span>
        </div>

        {/* Band Switcher Badges */}
        <div className="flex flex-wrap gap-1 max-w-full">
          {MASTER_BAND_PLANS.map((b) => {
            const isSelected = b.id === currentBand.id;
            return (
              <button
                key={b.id}
                onClick={() => onSelectBand(b)}
                className={`text-xs px-2.5 py-1 rounded font-mono font-semibold transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-amber-300'
                }`}
                title={b.description}
              >
                {b.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main High-Precision Tactical Frequency Display & VFO A/B Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        {/* Left: VFO A / VFO B Switcher & Repeater Shift Controls */}
        <div className="lg:col-span-3 flex flex-col gap-2 bg-black/40 p-3 rounded-lg border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 font-bold flex items-center gap-1">
              <Split className="w-3.5 h-3.5 text-amber-400" /> VFO SYSTEM
            </span>
            <div className="flex gap-1">
              <button
                onClick={onVfoSwitch}
                className="text-xs px-2 py-0.5 bg-zinc-800 hover:bg-amber-500/20 text-amber-400 rounded border border-zinc-700 flex items-center gap-1 font-mono font-bold"
                title="Swap VFO A and VFO B"
              >
                <ArrowRightLeft className="w-3 h-3" /> A / B
              </button>
              <button
                onClick={onVfoCopy}
                className="text-xs px-2 py-0.5 bg-zinc-800 hover:bg-amber-500/20 text-zinc-300 rounded border border-zinc-700 flex items-center gap-1 font-mono font-bold"
                title="Copy Active VFO to Inactive VFO (A = B)"
              >
                <Copy className="w-3 h-3" /> A=B
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div
              className={`p-2 rounded border ${
                activeVfo === 'VFO_A'
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 font-bold'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'
              }`}
            >
              <div className="text-[10px] uppercase text-zinc-500">VFO A (RX)</div>
              <div>{vfoAFreqMhz.toFixed(4)} MHz</div>
            </div>
            <div
              className={`p-2 rounded border ${
                activeVfo === 'VFO_B'
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 font-bold'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'
              }`}
            >
              <div className="text-[10px] uppercase text-zinc-500">VFO B (TX/SPLIT)</div>
              <div>{vfoBFreqMhz.toFixed(4)} MHz</div>
            </div>
          </div>

          {/* Repeater Offset Selector */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
              <span>REPEATER SHIFT:</span>
              <span className="text-amber-400 font-bold">{repeaterOffsetMode}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[11px] font-mono">
              {(['SIMPLEX', 'PLUS_OFFSET', 'MINUS_OFFSET', 'SPLIT'] as const).map((rMode) => (
                <button
                  key={rMode}
                  onClick={() => onRepeaterOffsetModeChange(rMode)}
                  className={`py-1 text-center rounded border transition-all ${
                    repeaterOffsetMode === rMode
                      ? 'bg-amber-500 text-black font-bold border-amber-400'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {rMode === 'SIMPLEX'
                    ? 'SIMP'
                    : rMode === 'PLUS_OFFSET'
                    ? '+RPT'
                    : rMode === 'MINUS_OFFSET'
                    ? '-RPT'
                    : 'SPLIT'}
                </button>
              ))}
            </div>
            {repeaterOffsetMode !== 'SIMPLEX' && repeaterOffsetMode !== 'SPLIT' && (
              <div className="mt-1 flex items-center justify-between text-xs font-mono text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
                <span>Offset:</span>
                <input
                  type="number"
                  step="0.05"
                  value={repeaterOffsetMhz}
                  onChange={(e) => onRepeaterOffsetMhzChange(parseFloat(e.target.value) || 0)}
                  className="w-20 bg-black text-right text-amber-300 px-1 rounded border border-zinc-700 focus:outline-none"
                />
                <span>MHz</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Large Tactical LED Frequency Display & Quick Step Buttons */}
        <div className="lg:col-span-6 bg-black p-4 rounded-xl border-2 border-amber-500/40 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute top-2 left-3 text-[10px] font-mono text-amber-500/70 uppercase tracking-widest flex items-center gap-2">
            <span>{currentBand.name}</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">{activeVfo} ACTIVE</span>
          </div>

          <button
            onClick={() => setShowKeypad(true)}
            className="absolute top-2 right-3 text-xs bg-zinc-900/80 hover:bg-amber-500/20 text-zinc-300 hover:text-amber-300 px-2 py-0.5 rounded border border-zinc-800 font-mono flex items-center gap-1"
            title="Direct Keypad Entry"
          >
            <Hash className="w-3 h-3" /> DIRECT
          </button>

          {/* Large Digit Readout */}
          <div className="font-mono text-amber-400 font-black tracking-tight flex items-baseline select-none py-2 text-3xl sm:text-5xl">
            <span className="text-amber-200">{mhzPart}</span>
            <span className="text-zinc-400 mx-0.5">.</span>
            <span className="text-amber-300">{khzPart}</span>
            <span className="text-amber-500/80 text-xl sm:text-3xl">{hzPart}</span>
            <span className="text-xs sm:text-sm text-zinc-400 ml-2 font-sans font-bold">MHz</span>
          </div>

          {/* Quick Frequency Step Buttons & Step Selector */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2 w-full pt-2 border-t border-zinc-900">
            <button
              onClick={() => handleStepTune(-10)}
              className="text-xs px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded font-mono font-bold"
            >
              -10x
            </button>
            <button
              onClick={() => handleStepTune(-1)}
              className="text-xs px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-mono font-bold border border-amber-500/40"
            >
              ◀ DOWN
            </button>
            <div className="flex items-center gap-1 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-xs font-mono text-zinc-300">
              <span className="text-[10px] text-zinc-500">STEP:</span>
              <select
                value={stepHz}
                onChange={(e) => onStepChange(parseInt(e.target.value, 10))}
                className="bg-transparent text-amber-300 font-bold focus:outline-none"
              >
                <option value={100}>100 Hz</option>
                <option value={1000}>1 kHz</option>
                <option value={5000}>5 kHz</option>
                <option value={6250}>6.25 kHz</option>
                <option value={8333}>8.33 kHz (Air)</option>
                <option value={10000}>10 kHz (CB)</option>
                <option value={12500}>12.5 kHz (NFM)</option>
                <option value={20000}>20 kHz (2m)</option>
                <option value={25000}>25 kHz</option>
                <option value={50000}>50 kHz</option>
                <option value={100000}>100 kHz (WFM)</option>
              </select>
            </div>
            <button
              onClick={() => handleStepTune(1)}
              className="text-xs px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-mono font-bold border border-amber-500/40"
            >
              UP ▶
            </button>
            <button
              onClick={() => handleStepTune(10)}
              className="text-xs px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded font-mono font-bold"
            >
              +10x
            </button>
          </div>
        </div>

        {/* Right: Demodulator Bank Selector & Mode Toggles */}
        <div className="lg:col-span-3 flex flex-col gap-2 bg-black/40 p-3 rounded-lg border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 font-bold">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" /> DEMODULATOR BANK
            </span>
            <span className="text-amber-400 font-bold">{mode}</span>
          </div>

          <div className="grid grid-cols-3 gap-1 font-mono text-xs font-bold">
            {(['AM', 'NFM', 'WFM', 'USB', 'LSB', 'CW'] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  className={`py-1.5 text-center rounded border transition-all ${
                    active
                      ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30'
                      : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-750 hover:text-amber-300'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* Special Demodulator Subpanels */}
          {mode === 'CW' && (
            <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800 space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-zinc-400">
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
                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="text-[10px] text-zinc-500 text-center font-mono">
                250 Hz Ultra-Narrow DSP Filter Active
              </div>
            </div>
          )}

          {mode === 'WFM' && (
            <div className="bg-zinc-900/80 p-2 rounded border border-amber-500/20 text-xs font-mono space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> RDS BROADCAST
                </span>
                <span className="px-1.5 py-0.2 rounded bg-red-950 text-red-400 border border-red-800 text-[10px]">
                  {rdsData.stereoDetected ? 'STEREO' : 'MONO'}
                </span>
              </div>
              <div className="text-amber-300 font-bold">{rdsData.programService}</div>
              <div className="text-[11px] text-zinc-400 truncate" title={rdsData.radioText}>
                {rdsData.radioText}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. CTCSS Sub-Audible Tone & Band Preset Quick Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
        {/* CTCSS (PL) Tone Sub-Audible Engine */}
        <div className="bg-black/30 p-3 rounded-lg border border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-zinc-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              GOERTZEL CTCSS (PL) SUB-AUDIBLE TONES
            </span>
            <button
              onClick={() => onCtcssSquelchToggle(!ctcssSquelchEnabled)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                ctcssSquelchEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}
            >
              TONE SQUELCH (TSQ): {ctcssSquelchEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-zinc-400">TX/RX PL TONE:</span>
            <select
              value={ctcssToneHz || ''}
              onChange={(e) => onCtcssToneChange(e.target.value ? parseFloat(e.target.value) : null)}
              className="bg-zinc-900 border border-zinc-700 text-amber-300 px-2 py-1 rounded flex-1 focus:outline-none"
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
          <div className="flex items-center justify-between text-xs font-mono bg-zinc-950 px-2 py-1.5 rounded border border-zinc-800">
            <span className="text-zinc-400">DECODED TONE:</span>
            {ctcssResult.detectedToneHz ? (
              <span className="text-cyan-400 font-bold flex items-center gap-1">
                ● {ctcssResult.detectedToneHz.toFixed(1)} Hz
                <span className="text-[10px] text-zinc-500">
                  ({Math.round(ctcssResult.detectedToneConfidence * 100)}% Match)
                </span>
              </span>
            ) : (
              <span className="text-zinc-500">NO SUB-AUDIBLE TONE DETECTED</span>
            )}
          </div>
        </div>

        {/* Current Band Channel Presets */}
        <div className="bg-black/30 p-3 rounded-lg border border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-zinc-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              {currentBand.name} PRESETS & CALLING FREQUENCIES
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {currentBand.presets.length} PRESETS
            </span>
          </div>

          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
            {currentBand.presets.map((preset) => {
              const isActive = Math.abs(preset.frequencyMhz - frequencyMhz) < 0.001;
              return (
                <button
                  key={preset.name}
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
                  className={`text-xs px-2 py-1 rounded font-mono transition-all text-left flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-amber-500 text-black font-bold shadow-md'
                      : 'bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 hover:text-amber-300'
                  }`}
                  title={`${preset.name}: ${preset.description}`}
                >
                  <span className="font-bold">{preset.name}</span>
                  <span className="text-[10px] opacity-75">{preset.frequencyMhz.toFixed(3)}</span>
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
                onClick={() => setShowKeypad(false)}
                className="text-zinc-400 hover:text-zinc-100 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleKeypadSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-1">
                  ENTER FREQUENCY IN MHz (0.100 - 1750.000):
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
                    className="text-xs py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-mono"
                  >
                    {quick}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeypad(false)}
                  className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black rounded"
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
