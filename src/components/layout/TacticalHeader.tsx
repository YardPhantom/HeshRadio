import React from 'react';
import { RtlSdrStatus } from '../../radio/rtlSdrBridge';
import { RigStatus } from '../../radio/rigController';
import { CURRENT_VERSION } from '../../version';
import { Zap } from 'lucide-react';

export interface TacticalHeaderProps {
  pttActive: boolean;
  squelchOpen: boolean;
  activeRxHandle: string | null;
  operatorHandle: string;
  onOperatorHandleChange: (handle: string) => void;
  sdrStatus: RtlSdrStatus;
  rigStatus: RigStatus;
  utcClock: string;
  onPanicUnkey: () => void;
}

export const TacticalHeader: React.FC<TacticalHeaderProps> = ({
  pttActive,
  squelchOpen,
  activeRxHandle,
  operatorHandle,
  onOperatorHandleChange,
  sdrStatus,
  rigStatus,
  utcClock,
  onPanicUnkey,
}) => {
  return (
    <header className="top-telemetry-bar" aria-label="Tactical Telemetry Header">
      <div className="brand-cluster">
        <div className={`ui-pill-bcn ${pttActive ? 'tx' : squelchOpen ? 'rx-open' : 'rx-stby'}`}>
          {pttActive
            ? 'TX ON AIR'
            : squelchOpen
            ? activeRxHandle
              ? `RX: ${activeRxHandle}`
              : 'RX SQUELCH OPEN'
            : 'RX GUARD'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="app-logo">HESHRADIO</h1>
            <span className="ui-pill-sm bg-amber-500/20 text-amber-300 border-amber-500/40 tracking-wider shadow-sm">
              {CURRENT_VERSION}
            </span>
          </div>
          <div className="app-subtitle">
            WIDEBAND SDR (100kHz–1.75GHz) • RTL-SDR USB BRIDGE • CAT RIG CONTROLLER • AUTO-DUCKING
          </div>
        </div>
      </div>

      {/* Global Tactical Header Pills */}
      <div className="header-telemetry-pills">
        <div className="ui-pill-md">
          <span className="ui-lbl">CALL / HANDLE</span>
          <div className="inline-flex items-center px-1 py-0.5">
            <input
              type="text"
              value={operatorHandle}
              onChange={(e) => onOperatorHandleChange(e.target.value.toUpperCase())}
              className="handle-input font-mono font-bold"
              aria-label="Operator Call or Handle"
            />
          </div>
        </div>

        <div className="ui-pill-md">
          <span className="ui-lbl">HARDWARE SDR</span>
          <span
            className={`ui-val ${
              sdrStatus.connected ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {sdrStatus.mode === 'WEBUSB'
              ? 'RTL-SDR USB'
              : sdrStatus.mode === 'RTL_TCP'
              ? 'RTL_TCP NET'
              : 'SIMULATED / WebSDR'}
          </span>
        </div>

        <div className="ui-pill-md">
          <span className="ui-lbl">CAT RIG CONTROL</span>
          <span
            className={`ui-val ${
              rigStatus.connected ? 'text-emerald-400' : 'text-zinc-500'
            }`}
          >
            {rigStatus.connected ? rigStatus.protocol : 'DIRECT SDR'}
          </span>
        </div>

        <div className="ui-pill-md">
          <span className="ui-lbl">UTC CLOCK</span>
          <span className="ui-val text-amber-300">{utcClock}</span>
        </div>

        {/* Emergency Panic Unkey Button */}
        <button
          type="button"
          onClick={onPanicUnkey}
          className="ui-pill-btn bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white border border-red-500/60 shadow-lg shadow-red-950/60 active:scale-95 transition-all"
          title="Immediate Fail-Safe Panic Unkey"
        >
          <Zap className="w-3.5 h-3.5 text-red-200 animate-pulse shrink-0" /> PANIC UNKEY
        </button>
      </div>
    </header>
  );
};
