import React, { useState } from 'react';
import { RtlSdrHardwareBridge, RtlSdrStatus } from '../radio/rtlSdrBridge';
import { Cpu, Wifi, Sliders, ShieldCheck } from 'lucide-react';
import { DeckHeader } from './common/DeckHeader';

interface RtlSdrControlPanelProps {
  sdrBridge: RtlSdrHardwareBridge;
  sdrStatus: RtlSdrStatus;
  onStatusChange: (status: RtlSdrStatus) => void;
}

export const RtlSdrControlPanel: React.FC<RtlSdrControlPanelProps> = ({
  sdrBridge,
  sdrStatus,
  onStatusChange,
}) => {
  const [targetHost, setTargetHost] = useState('127.0.0.1');
  const [targetPort, setTargetPort] = useState(1234);
  const [connecting, setConnecting] = useState(false);

  const handleConnectWebUsb = async () => {
    setConnecting(true);
    try {
      await sdrBridge.connectWebUsb();
      onStatusChange(sdrBridge.getStatus());
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectRtlTcp = async () => {
    setConnecting(true);
    try {
      await sdrBridge.connectRtlTcp(targetHost, targetPort);
      onStatusChange(sdrBridge.getStatus());
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    sdrBridge.disconnect();
    onStatusChange(sdrBridge.getStatus());
  };

  const handleGainChange = (gainDb: number, auto: boolean) => {
    sdrBridge.setGain(gainDb, auto);
    onStatusChange(sdrBridge.getStatus());
  };

  return (
    <section className="panel sdr-panel space-y-3 font-mono" aria-label="RTL-SDR V4 Hardware Configuration">
      {/* Header */}
      <DeckHeader
        statusLed={sdrStatus.connected ? 'emerald' : 'amber'}
        title="RTL-SDR HARDWARE BRIDGE"
        badgeText={
          sdrStatus.mode === 'WEBUSB'
            ? 'HW USB DONGLE'
            : sdrStatus.mode === 'RTL_TCP'
            ? 'RTL_TCP NETWORK'
            : 'SIMULATED / WebSDR'
        }
        badgeVariant={sdrStatus.connected ? 'emerald' : 'amber'}
        actions={
          sdrStatus.connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="text-xs px-3.5 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 rounded-lg font-mono font-bold border border-red-800 cursor-pointer"
            >
              DISCONNECT HARDWARE
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConnectWebUsb}
                disabled={connecting}
                className="text-xs px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black rounded-lg font-mono font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                title="Connect physical RTL-SDR Blog V4/V3 over USB or USB-OTG"
              >
                <Cpu className="w-3.5 h-3.5" />
                {connecting ? 'PAIRING...' : 'CONNECT USB'}
              </button>
              <button
                type="button"
                onClick={handleConnectRtlTcp}
                disabled={connecting}
                className="text-xs px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded-lg font-mono font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer"
                title="Connect to rtl_tcp daemon (127.0.0.1:1234)"
              >
                <Wifi className="w-3.5 h-3.5" /> RTL_TCP
              </button>
            </div>
          )
        }
      />

      {/* Hardware Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
        <div className="tactical-tile">
          <div className="px-0.5 space-y-0.5">
            <div className="text-[10px] text-zinc-500 uppercase">Device Hardware</div>
            <div className="text-zinc-200 font-bold truncate" title={sdrStatus.dongleName}>
              {sdrStatus.dongleName}
            </div>
          </div>
        </div>
        <div className="tactical-tile">
          <div className="px-0.5 space-y-0.5">
            <div className="text-[10px] text-zinc-500 uppercase">Tuner Architecture</div>
            <div className="text-cyan-300 font-bold">{sdrStatus.tunerType}</div>
          </div>
        </div>
        <div className="tactical-tile">
          <div className="px-0.5 space-y-0.5">
            <div className="text-[10px] text-zinc-500 uppercase">IQ Sample Rate</div>
            <div className="text-amber-300 font-bold">
              {(sdrStatus.sampleRateHz / 1e6).toFixed(3)} MS/s
            </div>
          </div>
        </div>
        <div className="tactical-tile">
          <div className="px-0.5 space-y-0.5">
            <div className="text-[10px] text-zinc-500 uppercase">Direct Sampling</div>
            <div className="text-zinc-300 font-bold">
              {sdrStatus.directSampling === 2
                ? 'Q-Branch (HF)'
                : sdrStatus.directSampling === 1
                ? 'I-Branch'
                : 'Off (PLL)'}
            </div>
          </div>
        </div>
      </div>

      {/* Controls & Fallback Status Bar */}
      <div className="tactical-card flex-row flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Gain Controls */}
        <div className="flex items-center gap-3 px-0.5">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-400" /> TUNER GAIN:
          </span>
          <button
            type="button"
            onClick={() => handleGainChange(sdrStatus.gainDb, sdrStatus.gainMode !== 'AUTO')}
            className={`px-3 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
              sdrStatus.gainMode === 'AUTO'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            AUTO AGC: {sdrStatus.gainMode === 'AUTO' ? 'ON' : 'OFF'}
          </button>
          {sdrStatus.gainMode === 'MANUAL' && (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="49.6"
                step="0.8"
                value={sdrStatus.gainDb}
                onChange={(e) => handleGainChange(parseFloat(e.target.value), false)}
                className="w-24 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="text-amber-300 font-bold">{sdrStatus.gainDb.toFixed(1)} dB</span>
            </div>
          )}
        </div>

        {/* Network Target IP/Port when connecting to rtl_tcp */}
        {!sdrStatus.connected && (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span>RTL_TCP HOST:</span>
            <input
              type="text"
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              className="w-28 bg-black border border-zinc-700 text-cyan-300 px-2.5 py-1 rounded-md font-mono"
            />
            <span>:</span>
            <input
              type="number"
              value={targetPort}
              onChange={(e) => setTargetPort(parseInt(e.target.value, 10) || 1234)}
              className="w-16 bg-black border border-zinc-700 text-cyan-300 px-2.5 py-1 rounded-md font-mono"
            />
          </div>
        )}

        {/* Status Message */}
        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 w-full sm:w-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="truncate">{sdrStatus.statusMessage}</span>
        </div>
      </div>
    </section>
  );
};
