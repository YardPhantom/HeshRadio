import React, { useEffect, useState } from 'react';
import {
  MemoryBank,
  MemoryChannel,
  ScanEngine,
  ScanResumeMode,
  ScanStatus,
} from '../radio/scanEngine';
import { ModulationModeExtended } from '../radio/bandPlans';
import {
  Play,
  Square,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Download,
} from 'lucide-react';
import { downloadTextFile } from '../utils/fileExport';
import { TacticalModal } from './common/TacticalModal';
import { DeckHeader } from './common/DeckHeader';

interface TacticalScannerDeckProps {
  scanEngine: ScanEngine;
  currentFreqMhz: number;
  onTuneChannel: (channel: MemoryChannel) => void;
}

export const TacticalScannerDeck: React.FC<TacticalScannerDeckProps> = ({
  scanEngine,
  currentFreqMhz,
  onTuneChannel,
}) => {
  const [banks, setBanks] = useState<MemoryBank[]>(() => scanEngine.getBanks());
  const [activeBankId, setActiveBankId] = useState<string>(() => scanEngine.getActiveBank().id);
  const [scanStatus, setScanStatus] = useState<ScanStatus>(() => scanEngine.getStatus());
  const [resumeMode, setResumeMode] = useState<ScanResumeMode>('CARRIER_OPERATED');
  const [dwellMs, setDwellMs] = useState<number>(120);

  // New Channel Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newFreq, setNewFreq] = useState(currentFreqMhz.toFixed(4));
  const [newMode, setNewMode] = useState<ModulationModeExtended>('AM');
  const [newAlpha, setNewAlpha] = useState('');

  useEffect(() => {
    scanEngine.setOnFrequencyTune((ch) => {
      onTuneChannel(ch);
      setScanStatus(scanEngine.getStatus());
    });
  }, [scanEngine, onTuneChannel]);

  // Periodic status poll while scanning
  useEffect(() => {
    const interval = setInterval(() => {
      setScanStatus(scanEngine.getStatus());
    }, 150);
    return () => clearInterval(interval);
  }, [scanEngine]);

  const activeBank = banks.find((b) => b.id === activeBankId) || banks[0];

  const handleToggleScan = () => {
    if (scanStatus.isScanning) {
      scanEngine.stopScan();
    } else {
      scanEngine.startScan(resumeMode, dwellMs);
    }
    setScanStatus(scanEngine.getStatus());
  };

  const handleBankChange = (id: string) => {
    setActiveBankId(id);
    scanEngine.setActiveBankId(id);
    setScanStatus(scanEngine.getStatus());
  };

  const handleToggleSkip = (chanId: string) => {
    scanEngine.toggleChannelSkip(activeBankId, chanId);
    setBanks(scanEngine.getBanks());
  };

  const handleDeleteChannel = (chanId: string) => {
    scanEngine.deleteChannel(activeBankId, chanId);
    setBanks(scanEngine.getBanks());
  };

  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const freq = parseFloat(newFreq);
    if (!newLabel.trim() || isNaN(freq)) return;

    scanEngine.addChannel(activeBankId, {
      bankId: activeBankId,
      channelNumber: activeBank.channels.length + 1,
      label: newLabel.toUpperCase(),
      frequencyMhz: freq,
      mode: newMode,
      ctcssToneHz: null,
      repeaterOffsetMhz: 0.0,
      powerWatts: 4.0,
      alphaTag: newAlpha.toUpperCase() || 'USER MEMORY',
      skip: false,
    });

    setBanks(scanEngine.getBanks());
    setShowAddModal(false);
    setNewLabel('');
    setNewAlpha('');
  };

  const handleExportJson = () => {
    const data = scanEngine.exportJson();
    downloadTextFile(data, `HeshRadio_MemoryBanks_${Date.now()}.json`, 'application/json');
  };

  return (
    <section className="panel scanner-panel font-mono space-y-4" aria-label="Tactical High-Speed Scanner">
      {/* Header */}
      <DeckHeader
        statusLed="emerald"
        title="TACTICAL HIGH-SPEED SCANNER & MEMORY BANKS"
        badgeText="100 CH/SEC"
        badgeVariant="emerald"
        actions={
          <>
            <button
              onClick={handleExportJson}
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center gap-1.5 border border-zinc-700 cursor-pointer transition-colors font-bold"
              title="Export Memory Banks to JSON"
            >
              <Download className="w-3.5 h-3.5" /> EXPORT JSON
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> ADD CHANNEL
            </button>
          </>
        }
      />

      {/* Scanner Control Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-black/40 p-4 rounded-xl border border-zinc-800/80 items-center">
        {/* Play/Stop Button */}
        <div className="md:col-span-3">
          <button
            onClick={handleToggleScan}
            className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              scanStatus.isScanning
                ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-black'
            }`}
          >
            {scanStatus.isScanning ? (
              <>
                <Square className="w-4 h-4 fill-current" /> STOP SCANNING
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> START SCANNER
              </>
            )}
          </button>
        </div>

        {/* Scan Status Badge */}
        <div className="md:col-span-3 text-xs">
          <div className="text-zinc-500 text-[10px]">SCANNER STATUS</div>
          <div className="font-bold flex items-center gap-1.5 pt-0.5">
            <span
              className={`w-2 h-2 rounded-full ${
                scanStatus.isScanning
                  ? scanStatus.pausedOnSignal
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-emerald-400 animate-pulse'
                  : 'bg-zinc-600'
              }`}
            />
            <span
              className={
                scanStatus.isScanning
                  ? scanStatus.pausedOnSignal
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                  : 'text-zinc-400'
              }
            >
              {scanStatus.isScanning
                ? scanStatus.pausedOnSignal
                  ? 'PAUSED ON CARRIER'
                  : `SWEEPING (${scanStatus.channelsScannedPerSec} CH/S)`
                : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Resume Mode */}
        <div className="md:col-span-3 text-xs">
          <div className="text-zinc-500 text-[10px]">RESUME MODE</div>
          <select
            value={resumeMode}
            onChange={(e) => setResumeMode(e.target.value as ScanResumeMode)}
            className="w-full bg-[#121924] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 cursor-pointer focus:outline-none"
          >
            <option value="CARRIER_OPERATED">CARRIER-OPERATED (CO) - Wait 1.5s after speech</option>
            <option value="TIME_OPERATED">TIME-OPERATED (TO) - Pause 5s then resume</option>
            <option value="SEEK_HOLD">SEEK &amp; HOLD - Stop on first carrier</option>
          </select>
        </div>

        {/* Dwell Speed Slider */}
        <div className="md:col-span-3 text-xs">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>DWELL TIME</span>
            <span className="text-amber-400 font-bold">{dwellMs} ms ({Math.round(1000 / dwellMs)} ch/s)</span>
          </div>
          <input
            type="range"
            min={40}
            max={500}
            step={20}
            value={dwellMs}
            onChange={(e) => setDwellMs(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 mt-1.5 cursor-pointer"
          />
        </div>
      </div>

      {/* Memory Bank Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2.5">
        {banks.map((bank) => (
          <button
            key={bank.id}
            onClick={() => handleBankChange(bank.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeBankId === bank.id
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {bank.name} ({bank.channels.length})
          </button>
        ))}
      </div>

      {/* Channel Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-black/40 border-b border-zinc-800 text-zinc-400 text-[11px] font-mono font-bold uppercase tracking-wider">
              <th className="py-3 px-4">CH</th>
              <th className="py-3 px-4">LABEL</th>
              <th className="py-3 px-4">FREQUENCY</th>
              <th className="py-3 px-4">MODE</th>
              <th className="py-3 px-4">CTCSS / OFFSET</th>
              <th className="py-3 px-4">ALPHA TAG</th>
              <th className="py-3 px-4 text-center">LOCKOUT</th>
              <th className="py-3 px-4 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {activeBank.channels.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 px-4 text-center text-zinc-500 font-mono text-xs">
                  No channels in this memory bank. Click &ldquo;ADD CHANNEL&rdquo; above to program.
                </td>
              </tr>
            ) : (
              activeBank.channels.map((chan) => {
                const isTuned = Math.abs(currentFreqMhz - chan.frequencyMhz) < 0.0005;
                return (
                  <tr
                    key={chan.id}
                    className={`border-b border-zinc-800/40 transition-colors ${
                      isTuned
                        ? 'bg-amber-500/10 text-amber-300 font-bold'
                        : chan.skip
                        ? 'opacity-40 text-zinc-600'
                        : 'hover:bg-zinc-900/60 text-zinc-300'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono">{chan.channelNumber}</td>
                    <td className="py-3 px-4 font-bold">{chan.label}</td>
                    <td className="py-3 px-4 font-mono text-amber-400">
                      {chan.frequencyMhz.toFixed(4)} MHz
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-3.5 py-1.5 rounded-lg bg-zinc-800 text-[10px] text-zinc-300 font-bold inline-block border border-zinc-700/60 leading-none">
                        {chan.mode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {chan.ctcssToneHz ? `${chan.ctcssToneHz} Hz` : 'CSQ'}
                      {chan.repeaterOffsetMhz !== 0 && (
                        <span className="ml-1 text-cyan-400">
                          ({chan.repeaterOffsetMhz > 0 ? '+' : ''}{chan.repeaterOffsetMhz}M)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 text-[11px] truncate max-w-xs">
                      {chan.alphaTag}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleSkip(chan.id)}
                        className={`p-1.5 rounded cursor-pointer ${
                          chan.skip
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        title={chan.skip ? 'Channel Locked Out from Scan' : 'Channel Active in Scan'}
                      >
                        {chan.skip ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => onTuneChannel(chan)}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/30 text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        TUNE
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(chan.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 text-[10px] cursor-pointer transition-colors border border-red-800/40"
                        title="Delete Memory"
                      >
                        <Trash2 className="w-3 h-3 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Channel Modal */}
      <TacticalModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`ADD MEMORY CHANNEL TO ${activeBank.name}`}
        icon={<Plus className="w-4 h-4 text-amber-400" />}
      >
        <form onSubmit={handleAddChannel} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-zinc-400 text-[11px]">CHANNEL LABEL</label>
              <input
                type="text"
                placeholder="e.g. CH 21 / TACOMA RPT"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full bg-black/60 border border-zinc-700 rounded-lg px-3.5 py-2 mt-1 text-white font-mono focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-zinc-400 text-[11px]">FREQUENCY (MHz)</label>
              <input
                type="number"
                step="0.0001"
                value={newFreq}
                onChange={(e) => setNewFreq(e.target.value)}
                className="w-full bg-black/60 border border-zinc-700 rounded-lg px-3.5 py-2 mt-1 text-amber-300 font-mono focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-zinc-400 text-[11px]">MODULATION MODE</label>
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as ModulationModeExtended)}
                className="w-full bg-black/60 border border-zinc-700 rounded-lg px-3.5 py-2 mt-1 text-white focus:outline-none cursor-pointer"
              >
                <option value="AM">AM (Amplitude Mod)</option>
                <option value="NFM">NFM (Narrowband FM)</option>
                <option value="WFM">WFM (Broadcast FM)</option>
                <option value="USB">USB (Upper Sideband)</option>
                <option value="LSB">LSB (Lower Sideband)</option>
                <option value="CW">CW (Continuous Wave)</option>
              </select>
            </div>

            <div>
              <label className="text-zinc-400 text-[11px]">ALPHA TAG / DESCRIPTION</label>
              <input
                type="text"
                placeholder="e.g. Local Club Net / Highway"
                value={newAlpha}
                onChange={(e) => setNewAlpha(e.target.value)}
                className="w-full bg-black/60 border border-zinc-700 rounded-lg px-3.5 py-2 mt-1 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs cursor-pointer shadow-md"
            >
              SAVE CHANNEL
            </button>
          </div>
        </form>
      </TacticalModal>
    </section>
  );
};
