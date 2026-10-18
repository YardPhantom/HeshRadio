import React from 'react';
import { ModulationModeExtended } from '../../radio/bandPlans';
import { BookOpen } from 'lucide-react';

export interface TrafficLogEntry {
  id: string;
  utcTime: string;
  handle: string;
  corridor: string;
  channelLabel: string;
  freqMhz: string;
  mode: ModulationModeExtended;
  rstOrSignal: string;
  message: string;
  isSelf?: boolean;
}

export interface HighwayDispatchDeckProps {
  trafficLog: TrafficLogEntry[];
  quickMessage: string;
  onQuickMessageChange: (val: string) => void;
  onSendSpot: (e: React.FormEvent) => void;
  frequencyMhz: number;
  mode: string;
  onLogQso?: (entry: TrafficLogEntry) => void;
}

export const HighwayDispatchDeck: React.FC<HighwayDispatchDeckProps> = ({
  trafficLog,
  quickMessage,
  onQuickMessageChange,
  onSendSpot,
  frequencyMhz,
  mode,
  onLogQso,
}) => {
  return (
    <section className="panel traffic-log-panel" aria-label="Highway Trucker Comms Log">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="status-led led-emerald" />
          <h2 className="panel-title">LIVE HIGHWAY, REPEATER &amp; QSO SPOTS LOG</h2>
        </div>
        <span className="badge-mono">{trafficLog.length} SPOTS RECORDED</span>
      </div>

      <form className="quick-dispatch-form" onSubmit={onSendSpot}>
        <input
          type="text"
          placeholder={`Broadcast traffic spot on ${frequencyMhz.toFixed(3)} MHz ${mode}...`}
          value={quickMessage}
          onChange={(e) => onQuickMessageChange(e.target.value)}
          className="dispatch-input"
        />
        <button type="submit" className="dispatch-send-btn">
          SEND SPOT
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
              {onLogQso && !item.isSelf && (
                <button
                  type="button"
                  onClick={() => onLogQso(item)}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  title="Promote and save this contact to ADIF QSO Logbook"
                >
                  <BookOpen className="w-3 h-3 text-amber-400" /> LOG TO ADIF
                </button>
              )}
            </div>
            <p className="traffic-card-msg">&ldquo;{item.message}&rdquo;</p>
          </article>
        ))}
      </div>
    </section>
  );
};
