import React from 'react';

export interface TacticalSliderProps {
  id?: string;
  label: string;
  valueReadout: React.ReactNode;
  subLabel?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  accentColor?: 'cyan' | 'amber' | 'emerald' | 'red';
  className?: string;
  disabled?: boolean;
}

export const TacticalSlider: React.FC<TacticalSliderProps> = ({
  id,
  label,
  valueReadout,
  subLabel,
  min,
  max,
  step = 1,
  value,
  onChange,
  accentColor = 'cyan',
  className = '',
  disabled = false,
}) => {
  const generatedId = id || `tactical-slider-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  const accentTextClasses: Record<string, string> = {
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
  };

  return (
    <div className={`knob-card bg-black/40 border border-zinc-800 rounded-xl p-3.5 space-y-2 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between text-xs font-mono font-bold">
        <label htmlFor={generatedId} className="text-zinc-400 tracking-wider">
          {label}
        </label>
        <span className={`px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono font-bold ${accentTextClasses[accentColor] || 'text-cyan-400'}`}>
          {valueReadout}
        </span>
      </div>

      <input
        id={generatedId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="tactical-slider w-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      />

      {subLabel && (
        <span className="text-[10px] text-zinc-500 font-mono tracking-tight">
          {subLabel}
        </span>
      )}
    </div>
  );
};
