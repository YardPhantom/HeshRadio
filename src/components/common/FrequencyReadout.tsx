import React from 'react';

export interface FrequencyReadoutProps {
  frequencyMhz: number;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showUnits?: boolean;
  className?: string;
  subColor?: 'amber' | 'cyan' | 'emerald';
}

export const FrequencyReadout: React.FC<FrequencyReadoutProps> = ({
  frequencyMhz,
  active = true,
  size = 'xl',
  showUnits = true,
  className = '',
  subColor = 'amber',
}) => {
  const safeFreq = isNaN(frequencyMhz) ? 0 : Math.max(0, frequencyMhz);
  const totalHz = Math.round(safeFreq * 1_000_000);
  const mhz = Math.floor(totalHz / 1_000_000);
  const remHz = totalHz % 1_000_000;
  const khz = Math.floor(remHz / 1_000);
  const hz = remHz % 1_000;

  const mhzStr = mhz.toString();
  const khzStr = khz.toString().padStart(3, '0');
  const hzStr = hz.toString().padStart(3, '0');

  const sizeClasses = {
    sm: 'text-base sm:text-lg',
    md: 'text-xl sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl lg:text-5xl',
  };

  const hzSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg sm:text-xl',
    xl: 'text-xl sm:text-2xl lg:text-3xl',
  };

  const colorStyles = {
    amber: {
      mhz: 'text-amber-200',
      khz: 'text-amber-300',
      hz: 'text-amber-500/80',
      glow: active ? 'drop-shadow-[0_0_12px_rgba(245,158,11,0.25)]' : '',
    },
    cyan: {
      mhz: 'text-cyan-200',
      khz: 'text-cyan-300',
      hz: 'text-cyan-500/80',
      glow: active ? 'drop-shadow-[0_0_12px_rgba(34,211,238,0.25)]' : '',
    },
    emerald: {
      mhz: 'text-emerald-200',
      khz: 'text-emerald-300',
      hz: 'text-emerald-500/80',
      glow: active ? 'drop-shadow-[0_0_12px_rgba(16,185,129,0.25)]' : '',
    },
  }[subColor];

  return (
    <div
      className={`font-mono font-black tracking-tight flex items-baseline select-none whitespace-nowrap ${sizeClasses[size]} ${colorStyles.glow} ${className}`}
    >
      <span className={colorStyles.mhz}>{mhzStr}</span>
      <span className="text-zinc-500 mx-0.5">.</span>
      <span className={colorStyles.khz}>{khzStr}</span>
      <span className={`${colorStyles.hz} ${hzSizeClasses[size]} ml-0.5`}>{hzStr}</span>
      {showUnits && (
        <span className="text-xs sm:text-sm text-zinc-400 ml-2.5 font-sans font-bold tracking-normal">
          MHz
        </span>
      )}
    </div>
  );
};
