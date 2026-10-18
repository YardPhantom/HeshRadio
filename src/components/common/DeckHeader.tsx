import React from 'react';
import { TacticalBadge, TacticalBadgeVariant } from './TacticalBadge';

export interface DeckHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  statusLed?: 'amber' | 'cyan' | 'emerald' | 'red' | 'purple';
  badgeText?: string;
  badgeVariant?: TacticalBadgeVariant;
  badgeNode?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const DeckHeader: React.FC<DeckHeaderProps> = ({
  title,
  icon,
  statusLed,
  badgeText,
  badgeVariant = 'cyan',
  badgeNode,
  actions,
  className = '',
}) => {
  return (
    <div className={`panel-header ${className}`}>
      <div className="panel-title-group">
        {statusLed && <span className={`status-led led-${statusLed}`} />}
        {icon && <span className="text-zinc-400 flex items-center shrink-0">{icon}</span>}
        <h2 className="panel-title">{title}</h2>
        {badgeText && (
          <TacticalBadge variant={badgeVariant} className="hidden sm:inline-flex">
            {badgeText}
          </TacticalBadge>
        )}
        {badgeNode}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
};
