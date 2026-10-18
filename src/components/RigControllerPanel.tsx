import React, { useState } from 'react';
import {
  CatProtocolType,
  HardwarePttMechanism,
  RigController,
  RigStatus,
} from '../radio/rigController';
import {
  Cable,
  ShieldAlert,
  CheckCircle2,
  Zap,
} from 'lucide-react';

interface RigControllerPanelProps {
  rigController: RigController;
  rigStatus: RigStatus;
  onStatusChange: (status: RigStatus) => void;
  onPanicUnkey: () => void;
}

export const RigControllerPanel: React.FC<RigControllerPanelProps> = ({
  rigController,
  rigStatus,
  onStatusChange,
  onPanicUnkey,
}) => {
  const [baudRate, setBaudRate] = useState(38400);
  const [connecting, setConnecting] = useState(false);

  const handleConnectSerial = async () => {
    setConnecting(true);
    try {
      await rigController.connectSerial(baudRate);
      onStatusChange(rigController.getStatus());
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectHamlib = async () => {
    setConnecting(true);
    try {
      await rigController.connectHamlibRigctld('127.0.0.1', 4532);
      onStatusChange(rigController.getStatus());
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectCm108 = async () => {
    setConnecting(true);
    try {
      await rigController.connectCm108Hid();
      onStatusChange(rigController.getStatus());
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    rigController.disconnect();
    onStatusChange(rigController.getStatus());
  };

  const handleProtocolChange = (p: CatProtocolType) => {
    rigController.setProtocol(p);
    onStatusChange(rigController.getStatus());
  };

  const handlePttMechChange = (m: HardwarePttMechanism) => {
    rigController.setPttMechanism(m);
    onStatusChange(rigController.getStatus());
  };

  const handleTotTimeoutChange = (sec: number) => {
    rigController.setTotTimeout(sec);
    onStatusChange(rigController.getStatus());
  };

  return (
    <section className="panel rig-panel space-y-3 font-mono" aria-label="CAT Transceiver Rig Controller &amp; Hardware PTT">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className={`status-led ${rigStatus.connected ? 'led-emerald' : 'led-red'}`} />
          <h2 className="panel-title">TRANSCEIVER CAT RIG CONTROL &amp; HARDWARE PTT</h2>
          <span
            className={`badge-mono font-bold ${
              rigStatus.connected ? 'text-emerald-400' : 'text-zinc-400'
            }`}
          >
            {rigStatus.connected ? 'RIG ONLINE' : 'DIRECT SDR MODE'}
          </span>
        </div>

        {/* Connect / Disconnect Buttons */}
        <div className="flex items-center gap-2">
          {rigStatus.connected ? (
            <button
              onClick={handleDisconnect}
              className="text-xs px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md font-mono font-bold border border-zinc-700 cursor-pointer"
            >
              DISCONNECT RIG
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleConnectSerial}
                disabled={connecting}
                className="text-xs px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md font-mono font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                title="Connect Digirig or Serial CAT COM port (WebSerial)"
              >
                <Cable className="w-3.5 h-3.5" />
                {connecting ? 'PAIRING...' : 'SERIAL CAT / DIGIRIG'}
              </button>
              <button
                onClick={handleConnectHamlib}
                disabled={connecting}
                className="text-xs px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md font-mono font-bold border border-zinc-700 cursor-pointer"
                title="Connect Hamlib rigctld (127.0.0.1:4532)"
              >
                HAMLIB
              </button>
              <button
                onClick={handleConnectCm108}
                disabled={connecting}
                className="text-xs px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md font-mono font-bold border border-zinc-700 cursor-pointer"
                title="Connect C-Media CM108 / CM119 USB Audio GPIO PTT"
              >
                CM108 HID
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Protocol & PTT Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
        {/* CAT Protocol Selection */}
        <div className="bg-black/40 p-3 rounded-lg border border-zinc-800 space-y-2">
          <div className="text-[10px] text-zinc-400 font-bold uppercase flex items-center justify-between">
            <span>CAT Protocol Engine</span>
            <span className="text-amber-400 font-bold">{rigStatus.protocol}</span>
          </div>
          <select
            value={rigStatus.protocol}
            onChange={(e) => handleProtocolChange(e.target.value as CatProtocolType)}
            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg focus:outline-none cursor-pointer"
          >
            <option value="KENWOOD">Kenwood / Elecraft / Xiegu (ASCII FA;/MD;)</option>
            <option value="YAESU">Yaesu FT-891/991A/DX10 (FA027185000;)</option>
            <option value="ICOM_CIV">Icom CI-V Bus (0xFE 0xFE BCD 0xFD)</option>
            <option value="HAMLIB_RIGCTLD">Hamlib rigctld (TCP Client)</option>
          </select>
          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
            <span>Baud Rate:</span>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(parseInt(e.target.value, 10))}
              className="bg-black text-amber-300 border border-zinc-800 rounded px-2 py-0.5 font-bold cursor-pointer"
            >
              <option value={9600}>9600</option>
              <option value={19200}>19200</option>
              <option value={38400}>38400 (Default)</option>
              <option value={115200}>115200</option>
            </select>
          </div>
        </div>

        {/* Hardware PTT Mechanism */}
        <div className="bg-black/40 p-3 rounded-lg border border-zinc-800 space-y-2">
          <div className="text-[10px] text-zinc-400 font-bold uppercase flex items-center justify-between">
            <span>Hardware PTT Keying</span>
            <span className="text-red-400 font-bold">{rigStatus.pttMechanism}</span>
          </div>
          <select
            value={rigStatus.pttMechanism}
            onChange={(e) => handlePttMechChange(e.target.value as HardwarePttMechanism)}
            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg focus:outline-none cursor-pointer"
          >
            <option value="SERIAL_RTS">Serial RTS Pin (Digirig Mobile / SignaLink)</option>
            <option value="SERIAL_DTR">Serial DTR Pin Keying</option>
            <option value="CM108_GPIO">CM108 / CM119 USB Audio GPIO3 (Bit 2)</option>
            <option value="CAT_COMMAND">CAT Software Command (TX;/RX; or CI-V)</option>
            <option value="VOX">VOX Audio Keying</option>
          </select>
          <div className="text-[10px] text-zinc-500 pt-1">
            {rigStatus.pttMechanism === 'SERIAL_RTS'
              ? 'Asserts RTS line on USB-Serial interface for opto-isolated PTT.'
              : rigStatus.pttMechanism === 'CM108_GPIO'
              ? 'Toggles GPIO3 pin on C-Media USB Audio chip without VOX delay.'
              : 'Software CAT packets key rig over serial bus.'}
          </div>
        </div>

        {/* Fail-Safe TOT & Panic Unkey Watchdog */}
        <div className="bg-black/40 p-3 rounded-lg border border-red-900/50 space-y-2">
          <div className="text-[10px] text-zinc-400 font-bold uppercase flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-red-400 font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> TOT SAFETY WATCHDOG
            </span>
            <span
              className={`font-bold font-mono px-3 py-1.5 rounded-lg border leading-none ${
                rigStatus.txActive ? 'bg-red-900/80 text-white border-red-700 animate-pulse' : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/70'
              }`}
            >
              {rigStatus.txActive ? `${rigStatus.totRemainingSec}s LEFT` : 'ARMED'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Timeout Limit:</span>
            <select
              value={rigStatus.totConfiguredSec}
              onChange={(e) => handleTotTimeoutChange(parseInt(e.target.value, 10))}
              className="bg-zinc-900 text-amber-300 border border-zinc-700 rounded px-2 py-0.5 font-bold cursor-pointer"
            >
              <option value={30}>30 Seconds</option>
              <option value={60}>60 Seconds</option>
              <option value={120}>120 Seconds</option>
              <option value={180}>180 Seconds (Default)</option>
              <option value={300}>300 Seconds</option>
            </select>
          </div>

          <button
            onClick={onPanicUnkey}
            className="w-full py-2 px-3 text-xs font-bold bg-red-950 hover:bg-red-900 text-red-200 border border-red-700 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            title="Immediately unkeys transmitter and resets all hardware control lines"
          >
            <Zap className="w-3.5 h-3.5 text-red-400" /> PANIC UNKEY (FORCE RX)
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      <div className="flex items-center justify-between text-[11px] font-mono bg-black/60 px-3.5 py-2 rounded-lg border border-zinc-800 text-zinc-400">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>PORT: {rigStatus.portLabel}</span>
        </span>
        <span className="text-zinc-500 truncate max-w-sm">{rigStatus.statusMessage}</span>
      </div>
    </section>
  );
};
