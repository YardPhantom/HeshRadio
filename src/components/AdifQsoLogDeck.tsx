import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdifLogger, AdifQsoRecord } from '../radio/adifLogger';
import { QslCardEngine } from '../radio/qslCardEngine';
import { calculateGeodesy } from '../radio/geodesy';
import { WrlSyncService } from '../radio/wrlSyncService';
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Search,
  Radio,
  Award,
  Trees,
  Compass,
  CheckCircle,
  Copy,
  Cloud,
  Zap,
  Activity,
  Globe,
} from 'lucide-react';
import { downloadTextFile } from '../utils/fileExport';
import { TacticalModal } from './common/TacticalModal';

interface AdifQsoLogDeckProps {
  currentFreqMhz: number;
  currentMode: string;
  myGridSquare: string;
  operatorHandle: string;
}

export const AdifQsoLogDeck: React.FC<AdifQsoLogDeckProps> = ({
  currentFreqMhz,
  currentMode,
  myGridSquare,
  operatorHandle,
}) => {
  const [logger] = useState(() => new AdifLogger());
  const [records, setRecords] = useState<AdifQsoRecord[]>(() => logger.getRecords());
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // New QSO Form State
  const [newCall, setNewCall] = useState('');
  const [newRstSent, setNewRstSent] = useState('59');
  const [newRstRcvd, setNewRstRcvd] = useState('59');
  const [newName, setNewName] = useState('');
  const [newGrid, setNewGrid] = useState('');
  const [newPota, setNewPota] = useState('');
  const [newSota, setNewSota] = useState('');
  const [newComment, setNewComment] = useState('');

  // AutoQSL Modal State
  const [selectedQsoForQsl, setSelectedQsoForQsl] = useState<AdifQsoRecord | null>(null);
  const qslCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // WRL Cloud Sync Modal & State
  const [showWrlModal, setShowWrlModal] = useState(false);
  const [wrlApiKey, setWrlApiKey] = useState(() => WrlSyncService.getApiKey());
  const [wrlStatusMsg, setWrlStatusMsg] = useState<string | null>(null);
  const [isSyncingWrl, setIsSyncingWrl] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  // Auto-Spot & General Toast Notification
  const [spotNotification, setSpotNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Render QSL card whenever selected record changes
  useEffect(() => {
    if (selectedQsoForQsl && qslCanvasRef.current) {
      QslCardEngine.renderCard(qslCanvasRef.current, selectedQsoForQsl, operatorHandle);
    }
  }, [selectedQsoForQsl, operatorHandle]);

  // Contest & Velocity HUD Calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todayQsoCount = records.filter((r) => r.qsoDate === todayStr).length;

    // Last 60 minutes velocity
    const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
    const hourQsoCount = records.filter((r) => {
      if (r.qsoDate !== todayStr || r.timeOn.length < 4) return false;
      const hh = parseInt(r.timeOn.slice(0, 2), 10);
      const mm = parseInt(r.timeOn.slice(2, 4), 10);
      const d = new Date();
      d.setUTCHours(hh, mm, 0, 0);
      return d.getTime() >= oneHourAgoMs;
    }).length;

    // Band breakdown
    const bands: Record<string, number> = {};
    records.forEach((r) => {
      bands[r.band] = (bands[r.band] || 0) + 1;
    });

    // Mode breakdown
    const modes: Record<string, number> = {};
    records.forEach((r) => {
      modes[r.mode] = (modes[r.mode] || 0) + 1;
    });

    // POTA Count
    const potaCount = records.filter((r) => Boolean(r.potaRef)).length;

    // WRL Sync status
    const unsyncedCount = records.filter((r) => !r.wrlSynced).length;

    return {
      todayQsoCount,
      hourQsoCount,
      bands,
      modes,
      potaCount,
      unsyncedCount,
    };
  }, [records]);

  const handleAddQso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCall.trim()) return;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');

    const bandStr =
      currentFreqMhz < 2.0
        ? '160m'
        : currentFreqMhz < 4.0
        ? '80m'
        : currentFreqMhz < 8.0
        ? '40m'
        : currentFreqMhz < 15.0
        ? '20m'
        : currentFreqMhz < 28.0
        ? '11m'
        : currentFreqMhz < 30.0
        ? '10m'
        : currentFreqMhz < 150.0
        ? '2m'
        : '70cm';

    logger.addRecord({
      call: newCall.trim().toUpperCase(),
      qsoDate: dateStr,
      timeOn: timeStr,
      band: bandStr,
      freqMhz: currentFreqMhz.toFixed(5),
      mode: currentMode === 'NFM' || currentMode === 'WFM' ? 'FM' : currentMode,
      submode: currentMode === 'USB' || currentMode === 'LSB' ? currentMode : undefined,
      rstSent: newRstSent.trim() || '59',
      rstRcvd: newRstRcvd.trim() || '59',
      name: newName.trim(),
      gridSquare: newGrid.trim().toUpperCase(),
      myGridSquare,
      potaRef: newPota.trim().toUpperCase() || undefined,
      sotaRef: newSota.trim().toUpperCase() || undefined,
      comment: newComment.trim(),
      operator: operatorHandle,
      wrlSynced: false,
    });

    setRecords(logger.getRecords());
    setNewCall('');
    setNewName('');
    setNewGrid('');
    setNewPota('');
    setNewSota('');
    setNewComment('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    logger.deleteRecord(id);
    setRecords(logger.getRecords());
  };

  // Export ADIF .adi file download
  const handleExportAdif = () => {
    const text = logger.exportAdifString();
    downloadTextFile(text, `HeshRadio_Log_${new Date().toISOString().slice(0, 10)}.adi`);
  };

  // Import ADIF file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const count = logger.importAdifString(text);
        setRecords(logger.getRecords());
        alert(`Successfully imported ${count} ADIF 3.1.4 QSO records!`);
      }
    };
    reader.readAsText(file);
  };

  // POTA Auto-Spot Generator (copies standard POTA format to clipboard)
  const handlePotaAutoSpot = (parkRef?: string) => {
    const ref = parkRef || newPota || 'US-0662';
    const spotText = `${ref} ${currentFreqMhz.toFixed(3)} ${currentMode} ${operatorHandle} [${myGridSquare}]`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(spotText);
    }
    setSpotNotification(`POTA Auto-Spot Copied: "${spotText}"`);
    setTimeout(() => setSpotNotification(null), 4000);
  };

  // Download QSL Card as PNG
  const handleDownloadQslPng = () => {
    if (!selectedQsoForQsl) return;
    const dataUrl = QslCardEngine.generateDataUrl(selectedQsoForQsl, operatorHandle);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QSL_${selectedQsoForQsl.call}_${selectedQsoForQsl.qsoDate}.png`;
    link.click();
  };

  // WRL Test Connection
  const handleTestWrlConnection = async () => {
    setWrlStatusMsg('Connecting to api.worldradioleague.com...');
    const res = await WrlSyncService.testConnection(wrlApiKey);
    setWrlStatusMsg(res.message);
  };

  // WRL Sync All Contacts
  const handleSyncToWrl = async () => {
    WrlSyncService.setApiKey(wrlApiKey);
    setIsSyncingWrl(true);
    setWrlStatusMsg('Synchronizing contacts with World Radio League...');

    const result = await WrlSyncService.syncAllUnsynced(records, (current, total) => {
      setSyncProgress({ current, total });
    });

    setRecords([...records]);
    setIsSyncingWrl(false);
    setSyncProgress(null);

    if (result.synced > 0) {
      setWrlStatusMsg(`Successfully synced ${result.synced} QSOs to World Radio League!`);
      setSpotNotification(`Synced ${result.synced} contacts to World Radio League cloud!`);
      setTimeout(() => setSpotNotification(null), 4000);
    } else if (result.failed > 0) {
      setWrlStatusMsg(`Sync completed with ${result.failed} issues: ${result.errors.join('; ')}`);
    } else {
      setWrlStatusMsg('All contacts are already synchronized with World Radio League.');
    }
  };

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.call.toLowerCase().includes(q) ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.gridSquare && r.gridSquare.toLowerCase().includes(q)) ||
      (r.potaRef && r.potaRef.toLowerCase().includes(q)) ||
      r.band.toLowerCase().includes(q) ||
      r.mode.toLowerCase().includes(q)
    );
  });

  return (
    <section className="panel adif-panel space-y-4" aria-label="ADIF 3.1.4 Electronic QSO Logbook">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="status-led led-emerald" />
          <h2 className="panel-title">ADIF 3.1.4 ELECTRONIC QSO LOGBOOK</h2>
          <span className="badge-mono hidden sm:inline-block">
            {records.length} TOTAL QSOS
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> LOG QSO NOW
          </button>
          <button
            onClick={() => setShowWrlModal(true)}
            className={`px-3.5 py-2 font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border ${
              stats.unsyncedCount > 0
                ? 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border-amber-700/60'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
            }`}
            title="Sync with World Radio League Cloud Logbook"
          >
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
            <span>WRL SYNC</span>
            {stats.unsyncedCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-amber-500 text-black rounded-full font-black font-mono">
                {stats.unsyncedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handlePotaAutoSpot()}
            className="px-3.5 py-2 bg-pink-900/60 hover:bg-pink-800/80 text-pink-300 border border-pink-700/50 font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Generate and copy POTA Auto-Spot text for parks on the air"
          >
            <Trees className="w-3.5 h-3.5 text-pink-400" /> POTA AUTO-SPOT
          </button>
          <button
            onClick={handleExportAdif}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Export standard ADIF 3.1.4 file (.adi) for LoTW, QRZ, and eQSL"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> EXPORT .ADI
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Import existing .adi logbook"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" /> IMPORT .ADI
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".adi,.txt"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Contest & Real-Time Rate HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 font-mono text-xs">
        {/* QSO Velocity / Hr */}
        <div className="bg-black/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 flex items-center gap-1 uppercase tracking-wider">
            <Zap className="w-3 h-3 text-amber-400" /> QSO Rate (1h)
          </div>
          <div className="text-xl font-black text-amber-300 mt-1">
            {stats.hourQsoCount} <span className="text-[11px] font-normal text-zinc-500">QSO/hr</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {stats.todayQsoCount} logged today
          </div>
        </div>

        {/* Total Contacts */}
        <div className="bg-black/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 flex items-center gap-1 uppercase tracking-wider">
            <Activity className="w-3 h-3 text-emerald-400" /> Total Logged
          </div>
          <div className="text-xl font-black text-emerald-400 mt-1">
            {records.length}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            ADIF 3.1.4 verified
          </div>
        </div>

        {/* POTA & SOTA Activities */}
        <div className="bg-black/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 flex items-center gap-1 uppercase tracking-wider">
            <Trees className="w-3 h-3 text-pink-400" /> POTA / SOTA
          </div>
          <div className="text-xl font-black text-pink-400 mt-1">
            {stats.potaCount}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Parks &amp; Summits
          </div>
        </div>

        {/* Top Band Share */}
        <div className="bg-black/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 flex items-center gap-1 uppercase tracking-wider">
            <Radio className="w-3 h-3 text-cyan-400" /> Band Activity
          </div>
          <div className="text-sm font-bold text-cyan-300 mt-1 truncate">
            {Object.entries(stats.bands)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([b, c]) => `${b} (${c})`)
              .join(', ') || 'None'}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {Object.keys(stats.bands).length} bands worked
          </div>
        </div>

        {/* Operating Modes */}
        <div className="bg-black/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 flex items-center gap-1 uppercase tracking-wider">
            <Globe className="w-3 h-3 text-purple-400" /> Modes
          </div>
          <div className="text-sm font-bold text-purple-300 mt-1 truncate">
            {Object.entries(stats.modes)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([m, c]) => `${m}:${c}`)
              .join(' ') || 'None'}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            SSB, FT8, AM, CW
          </div>
        </div>

        {/* Cloud Status */}
        <div className="bg-black/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 flex items-center gap-1 uppercase tracking-wider">
            <Cloud className="w-3 h-3 text-blue-400" /> WRL Cloud
          </div>
          <div className="text-sm font-bold mt-1">
            {stats.unsyncedCount === 0 ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> 100% Synced
              </span>
            ) : (
              <span className="text-amber-400">
                {stats.unsyncedCount} Pending
              </span>
            )}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            worldradioleague.com
          </div>
        </div>
      </div>

      {/* Spot Feedback Toast */}
      {spotNotification && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-3.5 py-2 rounded-lg font-mono text-xs flex items-center justify-between gap-2 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{spotNotification}</span>
          </div>
          <button
            onClick={() => setSpotNotification(null)}
            className="text-zinc-400 hover:text-white px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Manual Quick Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddQso}
          className="bg-black/60 p-4 rounded-xl border border-emerald-500/40 space-y-3 font-mono text-xs"
        >
          <div className="font-bold text-emerald-400 flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-1.5">
              <Radio className="w-4 h-4" /> LOG CURRENT CONTACT AT {currentFreqMhz.toFixed(3)} MHz ({currentMode})
            </div>
            <div className="text-[11px] text-zinc-400">
              QTH: <span className="text-cyan-400">{myGridSquare}</span> • OPERATOR: <span className="text-amber-300">{operatorHandle}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">CALLSIGN / HANDLE *:</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. W1AW or CB Handle"
                value={newCall}
                onChange={(e) => setNewCall(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-amber-300 px-3.5 py-2 rounded-lg font-bold uppercase focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">RST SENT / RCVD:</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newRstSent}
                  onChange={(e) => setNewRstSent(e.target.value)}
                  className="w-1/2 bg-zinc-900 border border-zinc-700 text-zinc-200 px-3.5 py-2 rounded-lg text-center focus:outline-none"
                />
                <input
                  type="text"
                  value={newRstRcvd}
                  onChange={(e) => setNewRstRcvd(e.target.value)}
                  className="w-1/2 bg-zinc-900 border border-zinc-700 text-zinc-200 px-3.5 py-2 rounded-lg text-center focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">NAME / OPERATOR:</label>
              <input
                type="text"
                placeholder="e.g. Bob"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3.5 py-2 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">MAIDENHEAD GRID:</label>
              <input
                type="text"
                placeholder="e.g. FN31pr"
                value={newGrid}
                onChange={(e) => setNewGrid(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3.5 py-2 rounded-lg uppercase focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">POTA PARK REF (PARKS ON THE AIR):</label>
              <input
                type="text"
                placeholder="e.g. US-0662 or K-1234"
                value={newPota}
                onChange={(e) => setNewPota(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-pink-300 px-3.5 py-2 rounded-lg uppercase focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">SOTA SUMMIT REF (SUMMITS ON THE AIR):</label>
              <input
                type="text"
                placeholder="e.g. W7W/RS-001"
                value={newSota}
                onChange={(e) => setNewSota(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-amber-300 px-3.5 py-2 rounded-lg uppercase focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-zinc-400 text-[10px] block mb-1">NOTES / COMMENT:</label>
            <input
              type="text"
              placeholder="e.g. 5x9 audio report on 40m LSB ragchew net"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3.5 py-2 rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-2 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg shadow-md cursor-pointer"
            >
              RECORD QSO TO ADIF
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-2.5 bg-black/40 px-3.5 py-2 rounded-lg border border-zinc-800 text-xs font-mono">
        <Search className="w-4 h-4 text-zinc-500 shrink-0" />
        <input
          type="text"
          placeholder="Filter log by callsign, name, POTA park, band, mode, or Maidenhead grid..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-zinc-200 flex-1 focus:outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-zinc-300 px-1">
            ✕
          </button>
        )}
      </div>

      {/* QSO Records Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800 font-mono text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-900/90 text-zinc-400 text-[11px] border-b border-zinc-800">
              <th className="px-3.5 py-2.5">UTC DATE / TIME</th>
              <th className="px-3.5 py-2.5">CALLSIGN</th>
              <th className="px-3.5 py-2.5">BAND / FREQ</th>
              <th className="px-3.5 py-2.5">MODE</th>
              <th className="px-3.5 py-2.5">RST (S/R)</th>
              <th className="px-3.5 py-2.5">GRID / BEARING</th>
              <th className="px-3.5 py-2.5">ACTIVITY</th>
              <th className="px-3.5 py-2.5">NAME / COMMENT</th>
              <th className="px-3.5 py-2.5 text-right">AUTO-QSL / ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-zinc-500">
                  No QSO records found. Log your first contact or import an ADIF file!
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => {
                // Geodesy derivation
                let distanceDisplay = '';
                if (r.distanceMiles && r.bearingDeg !== undefined) {
                  distanceDisplay = `${r.distanceMiles.toLocaleString()} mi @ ${r.bearingDeg}°`;
                } else if (r.myGridSquare && r.gridSquare) {
                  const geo = calculateGeodesy(r.myGridSquare, r.gridSquare);
                  if (geo) {
                    distanceDisplay = `${geo.distanceMiles.toLocaleString()} mi @ ${geo.bearingDeg}° ${geo.compassDir}`;
                  }
                }

                return (
                  <tr key={r.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-3.5 py-2.5 text-zinc-400 text-[11px]">
                      {r.qsoDate.slice(0, 4)}-{r.qsoDate.slice(4, 6)}-{r.qsoDate.slice(6, 8)}{' '}
                      {r.timeOn.slice(0, 2)}:{r.timeOn.slice(2, 4)}Z
                    </td>
                    <td className="px-3.5 py-2.5 font-bold text-amber-300">
                      <div className="flex items-center gap-1.5">
                        <span>{r.call}</span>
                        {r.wrlSynced && (
                          <span title="Synced to World Radio League Cloud">
                            <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-cyan-300">
                      {r.band} ({r.freqMhz} MHz)
                    </td>
                    <td className="px-3.5 py-2.5 text-emerald-400 font-bold">
                      {r.mode}
                      {r.submode ? `-${r.submode}` : ''}
                    </td>
                    <td className="px-3.5 py-2.5 text-zinc-300">
                      {r.rstSent} / {r.rstRcvd}
                    </td>
                    <td className="px-3.5 py-2.5 text-zinc-400">
                      <div>{r.gridSquare || '—'}</div>
                      {distanceDisplay && (
                        <div className="text-[10px] text-amber-400/90 flex items-center gap-1">
                          <Compass className="w-2.5 h-2.5" /> {distanceDisplay}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {r.potaRef ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-pink-950/80 text-pink-300 border border-pink-700/50">
                          <Trees className="w-3 h-3 text-pink-400" /> {r.potaRef}
                        </span>
                      ) : r.sotaRef ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/50">
                          ⛰️ {r.sotaRef}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-zinc-400 max-w-xs">
                      {r.name && <div className="text-zinc-200 font-bold">{r.name}</div>}
                      <div className="truncate text-[11px]">{r.comment || '—'}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedQsoForQsl(r)}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Generate graphical AutoQSL confirmation card"
                      >
                        <Award className="w-3 h-3 text-amber-400" /> AUTO-QSL
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-zinc-800 cursor-pointer align-middle"
                        title="Delete QSO"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* AutoQSL Card Modal */}
      <TacticalModal
        isOpen={Boolean(selectedQsoForQsl)}
        onClose={() => setSelectedQsoForQsl(null)}
        title={`AUTO-QSL POSTCARD CONFIRMATION // ${selectedQsoForQsl?.call || ''}`}
        icon={<Award className="w-5 h-5 text-amber-400" />}
        maxWidth="4xl"
        borderColorClass="border-amber-500/40"
      >
        {selectedQsoForQsl && (
          <>
            {/* Canvas Preview Container */}
            <div className="bg-black/60 rounded-xl p-2 border border-zinc-800 flex justify-center items-center overflow-hidden">
              <canvas
                ref={qslCanvasRef}
                className="w-full max-h-[55vh] object-contain rounded-lg shadow-xl"
              />
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-[11px] text-zinc-400">
                1200x750 High-DPI QSL Postcard Graphic • Ready for print, LoTW &amp; eQSL
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `${selectedQsoForQsl.call} QSO on ${selectedQsoForQsl.band} (${selectedQsoForQsl.mode}) confirmed by ${operatorHandle}`;
                    if (navigator.clipboard) navigator.clipboard.writeText(text);
                    setSpotNotification(`Copied QSO confirmation text to clipboard!`);
                    setTimeout(() => setSpotNotification(null), 3000);
                  }}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-cyan-400" /> COPY SUMMARY
                </button>
                <button
                  type="button"
                  onClick={handleDownloadQslPng}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" /> DOWNLOAD QSL CARD (.PNG)
                </button>
              </div>
            </div>
          </>
        )}
      </TacticalModal>

      {/* World Radio League Cloud Sync Modal */}
      <TacticalModal
        isOpen={showWrlModal}
        onClose={() => setShowWrlModal(false)}
        title="WORLD RADIO LEAGUE CLOUD SYNC"
        icon={<Cloud className="w-5 h-5 text-cyan-400" />}
        titleColorClass="text-cyan-400"
        borderColorClass="border-cyan-500/40"
        maxWidth="lg"
      >
        <p className="text-zinc-300 text-[11px] leading-relaxed">
          Connect HeshRadio directly to your free account on{' '}
          <a
            href="https://worldradioleague.com"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 underline"
          >
            WorldRadioLeague.com
          </a>{' '}
          to auto-sync contacts, track awards, and participate in live contesting.
        </p>

        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[10px] block font-bold">
            WRL DEVELOPER API KEY:
          </label>
          <input
            type="password"
            placeholder="wrl_live_..."
            value={wrlApiKey}
            onChange={(e) => setWrlApiKey(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 text-cyan-300 px-3.5 py-2.5 rounded-lg font-mono focus:outline-none focus:border-cyan-500"
          />
          <div className="text-[10px] text-zinc-500">
            Obtain your key in WRL under Integrations &gt; Developer API.
          </div>
        </div>

        {wrlStatusMsg && (
          <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-[11px] text-zinc-300 leading-relaxed">
            {wrlStatusMsg}
          </div>
        )}

        {syncProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Uploading contacts...</span>
              <span>{syncProgress.current} / {syncProgress.total}</span>
            </div>
            <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-200"
                style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={handleTestWrlConnection}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg cursor-pointer"
          >
            TEST CONNECTION
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowWrlModal(false)}
              className="px-3.5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg cursor-pointer"
            >
              CLOSE
            </button>
            <button
              type="button"
              disabled={isSyncingWrl}
              onClick={handleSyncToWrl}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-lg shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Cloud className="w-3.5 h-3.5" /> SYNC ALL QSOS
            </button>
          </div>
        </div>
      </TacticalModal>
    </section>
  );
};
