import React from 'react';

export type TacticalBadgeVariant =
  | 'amber'
  | 'cyan'
  | 'emerald'
  | 'red'
  | 'purple'
  | 'zinc';

export interface TacticalBadgeProps {
  variant?: TacticalBadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  title?: string;
}

export const TacticalBadge: React.FC<TacticalBadgeProps> = ({
  variant = 'zinc',
  children,
  icon,
  className = '',
  title,
}) => {
  const variantStyles: Record<TacticalBadgeVariant, string> = {
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    cyan: 'bg-cyan-950/50 text-cyan-300 border-cyan-800/40',
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
    red: 'bg-red-950/60 text-red-300 border-red-700/50',
    purple: 'bg-purple-950/50 text-purple-300 border-purple-800/40',
    zinc: 'bg-zinc-850 text-zinc-300 border-zinc-700/80',
  };

  return (
    <span
      className={`ui-pill-sm shrink-0 tracking-wider ${variantStyles[variant]} ${className}`}
      title={title}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className="leading-none">{children}</span>
    </span>
  );
};
