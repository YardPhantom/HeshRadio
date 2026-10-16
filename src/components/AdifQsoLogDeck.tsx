import React, { useRef, useState } from 'react';
import { AdifLogger, AdifQsoRecord } from '../radio/adifLogger';
import {
  BookOpen,
  Download,
  Upload,
  Plus,
  Trash2,
  Search,
  Radio,
} from 'lucide-react';

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
  const [newComment, setNewComment] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      comment: newComment.trim(),
      operator: operatorHandle,
    });

    setRecords(logger.getRecords());
    setNewCall('');
    setNewName('');
    setNewGrid('');
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
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HeshRadio_Log_${new Date().toISOString().slice(0, 10)}.adi`;
    link.click();
    URL.revokeObjectURL(url);
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

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.call.toLowerCase().includes(q) ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.gridSquare && r.gridSquare.toLowerCase().includes(q)) ||
      r.band.toLowerCase().includes(q) ||
      r.mode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-[#0b1017] border border-emerald-900/40 rounded-xl p-4 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-zinc-100 font-mono text-sm flex items-center gap-2">
            ADIF 3.1.4 ELECTRONIC QSO LOGBOOK
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {records.length} TOTAL QSOS
            </span>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded flex items-center gap-1 shadow-md transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> LOG QSO NOW
          </button>
          <button
            onClick={handleExportAdif}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold rounded flex items-center gap-1 transition-all"
            title="Export standard ADIF 3.1.4 file (.adi) for LoTW, QRZ, and eQSL"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> EXPORT .ADI
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold rounded flex items-center gap-1 transition-all"
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

      {/* Manual Quick Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddQso}
          className="bg-black/60 p-4 rounded-xl border border-emerald-500/40 space-y-3 font-mono text-xs"
        >
          <div className="font-bold text-emerald-400 flex items-center gap-1.5 border-b border-zinc-800 pb-2">
            <Radio className="w-4 h-4" /> LOG CURRENT CONTACT AT {currentFreqMhz.toFixed(3)} MHz ({currentMode})
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
                className="w-full bg-zinc-900 border border-zinc-700 text-amber-300 px-2 py-1 rounded font-bold uppercase"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">RST SENT / RCVD:</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newRstSent}
                  onChange={(e) => setNewRstSent(e.target.value)}
                  className="w-1/2 bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 rounded text-center"
                />
                <input
                  type="text"
                  value={newRstRcvd}
                  onChange={(e) => setNewRstRcvd(e.target.value)}
                  className="w-1/2 bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 rounded text-center"
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
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 rounded"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">MAIDENHEAD GRID:</label>
              <input
                type="text"
                placeholder="e.g. FN31pr"
                value={newGrid}
                onChange={(e) => setNewGrid(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 rounded uppercase"
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
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 rounded"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-4 py-1 bg-emerald-500 text-black font-bold rounded shadow-md"
            >
              RECORD QSO TO ADIF
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-mono">
        <Search className="w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Filter log by callsign, name, band, mode, or Maidenhead grid..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-zinc-200 flex-1 focus:outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        )}
      </div>

      {/* QSO Records Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800 font-mono text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-900/90 text-zinc-400 text-[11px] border-b border-zinc-800">
              <th className="p-2.5">UTC DATE / TIME</th>
              <th className="p-2.5">CALLSIGN</th>
              <th className="p-2.5">BAND / FREQ</th>
              <th className="p-2.5">MODE</th>
              <th className="p-2.5">RST (S/R)</th>
              <th className="p-2.5">GRID</th>
              <th className="p-2.5">NAME</th>
              <th className="p-2.5">COMMENT</th>
              <th className="p-2.5 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-zinc-500">
                  No QSO records found. Log your first contact or import an ADIF file!
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="p-2.5 text-zinc-400 text-[11px]">
                    {r.qsoDate.slice(0, 4)}-{r.qsoDate.slice(4, 6)}-{r.qsoDate.slice(6, 8)}{' '}
                    {r.timeOn.slice(0, 2)}:{r.timeOn.slice(2, 4)}Z
                  </td>
                  <td className="p-2.5 font-bold text-amber-300">{r.call}</td>
                  <td className="p-2.5 text-cyan-300">
                    {r.band} ({r.freqMhz} MHz)
                  </td>
                  <td className="p-2.5 text-emerald-400 font-bold">
                    {r.mode}
                    {r.submode ? `-${r.submode}` : ''}
                  </td>
                  <td className="p-2.5 text-zinc-300">
                    {r.rstSent} / {r.rstRcvd}
                  </td>
                  <td className="p-2.5 text-zinc-400">{r.gridSquare || '—'}</td>
                  <td className="p-2.5 text-zinc-300">{r.name || '—'}</td>
                  <td className="p-2.5 text-zinc-400 truncate max-w-xs">{r.comment || '—'}</td>
                  <td className="p-2.5 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                      title="Delete QSO"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
