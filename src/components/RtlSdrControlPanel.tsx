import React, { useState } from 'react';
import { RtlSdrHardwareBridge, RtlSdrStatus } from '../radio/rtlSdrBridge';
import { Cpu, Wifi, Sliders, ShieldCheck } from 'lucide-react';

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
    <div className="bg-[#0b1017] border border-cyan-900/40 rounded-xl p-4 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <span className="font-bold text-zinc-100 text-sm font-mono flex items-center gap-2">
            RTL-SDR HARDWARE BRIDGE
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold border ${
                sdrStatus.mode === 'WEBUSB'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : sdrStatus.mode === 'RTL_TCP'
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {sdrStatus.mode === 'WEBUSB'
                ? 'HW USB DONGLE'
                : sdrStatus.mode === 'RTL_TCP'
                ? 'RTL_TCP NETWORK'
                : 'SIMULATED / WebSDR'}
            </span>
          </span>
        </div>

        {/* Connection Action Buttons */}
        <div className="flex items-center gap-2">
          {sdrStatus.connected ? (
            <button
              onClick={handleDisconnect}
              className="text-xs px-3 py-1 bg-red-950/80 hover:bg-red-900 text-red-300 rounded font-mono font-bold border border-red-800"
            >
              DISCONNECT HARDWARE
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={handleConnectWebUsb}
                disabled={connecting}
                className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-black rounded font-mono font-bold transition-all shadow-md flex items-center gap-1"
                title="Connect physical RTL-SDR Blog V4/V3 over USB or USB-OTG"
              >
                <Cpu className="w-3.5 h-3.5" />
                {connecting ? 'PAIRING...' : 'CONNECT USB'}
              </button>
              <button
                onClick={handleConnectRtlTcp}
                disabled={connecting}
                className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded font-mono font-bold border border-zinc-700 flex items-center gap-1"
                title="Connect to rtl_tcp daemon (127.0.0.1:1234)"
              >
                <Wifi className="w-3.5 h-3.5" /> RTL_TCP
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hardware Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div className="bg-black/40 p-2 rounded border border-zinc-800">
          <div className="text-[10px] text-zinc-500 uppercase">Device Hardware</div>
          <div className="text-zinc-200 font-bold truncate" title={sdrStatus.dongleName}>
            {sdrStatus.dongleName}
          </div>
        </div>
        <div className="bg-black/40 p-2 rounded border border-zinc-800">
          <div className="text-[10px] text-zinc-500 uppercase">Tuner Architecture</div>
          <div className="text-cyan-300 font-bold">{sdrStatus.tunerType}</div>
        </div>
        <div className="bg-black/40 p-2 rounded border border-zinc-800">
          <div className="text-[10px] text-zinc-500 uppercase">IQ Sample Rate</div>
          <div className="text-amber-300 font-bold">
            {(sdrStatus.sampleRateHz / 1e6).toFixed(3)} MS/s
          </div>
        </div>
        <div className="bg-black/40 p-2 rounded border border-zinc-800">
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

      {/* Controls & Fallback Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono bg-black/50 p-2.5 rounded-lg border border-zinc-800">
        {/* Gain Controls */}
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-amber-400" /> TUNER GAIN:
          </span>
          <button
            onClick={() => handleGainChange(sdrStatus.gainDb, sdrStatus.gainMode !== 'AUTO')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
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
                className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="text-amber-300 font-bold">{sdrStatus.gainDb.toFixed(1)} dB</span>
            </div>
          )}
        </div>

        {/* Network Target IP/Port when connecting to rtl_tcp */}
        {!sdrStatus.connected && (
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <span>RTL_TCP HOST:</span>
            <input
              type="text"
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              className="w-24 bg-black border border-zinc-700 text-cyan-300 px-1 py-0.5 rounded"
            />
            <span>:</span>
            <input
              type="number"
              value={targetPort}
              onChange={(e) => setTargetPort(parseInt(e.target.value, 10) || 1234)}
              className="w-14 bg-black border border-zinc-700 text-cyan-300 px-1 py-0.5 rounded"
            />
          </div>
        )}

        {/* Status Message */}
        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 w-full sm:w-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="truncate">{sdrStatus.statusMessage}</span>
        </div>
      </div>
    </div>
  );
};
