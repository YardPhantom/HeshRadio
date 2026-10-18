import React from 'react';

export type TacticalButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'emerald'
  | 'amber'
  | 'ghost';

export type TacticalButtonSize = 'sm' | 'md' | 'lg';

export interface TacticalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TacticalButtonVariant;
  size?: TacticalButtonSize;
  icon?: React.ReactNode;
}

export const TacticalButton: React.FC<TacticalButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-mono font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none border leading-none';

  const sizeClasses: Record<TacticalButtonSize, string> = {
    sm: 'text-[11px] px-2.5 py-1.5 gap-1.5',
    md: 'text-xs px-3.5 py-2 gap-2',
    lg: 'text-sm px-4 py-2.5 gap-2.5',
  };

  const variantClasses: Record<TacticalButtonVariant, string> = {
    primary:
      'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400 shadow-sm shadow-cyan-500/20 active:translate-y-px',
    secondary:
      'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 hover:border-zinc-600 active:translate-y-px',
    danger:
      'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-sm shadow-red-600/30 active:translate-y-px',
    emerald:
      'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-600/20 active:translate-y-px',
    amber:
      'bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow-sm shadow-amber-500/20 active:translate-y-px',
    ghost:
      'bg-transparent hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border-transparent active:translate-y-px',
  };

  return (
    <button
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children}
    </button>
  );
};
