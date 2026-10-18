import React from 'react';
import {
  Radio,
  Music,
  FastForward,
  ShieldAlert,
  HardDrive,
  ListFilter,
  Activity,
  Sun,
  BookOpen,
  Cpu,
  Wrench,
} from 'lucide-react';

export type ViewTab =
  | 'VFO_SDR'
  | 'FM_RADIO'
  | 'SCANNER'
  | 'NOAA_EAS'
  | 'BLACK_BOX'
  | 'LAB_SUITE'
  | 'DIGITAL_MODES'
  | 'PROPAGATION'
  | 'ADIF_LOG'
  | 'HARDWARE_RIG'
  | 'TRAFFIC_LOG';

export type WorkspaceCategory =
  | 'TRANSCEIVER'
  | 'FM_BROADCAST'
  | 'SCAN_ALERTS'
  | 'VOICE_AUDIO'
  | 'DIGITAL_WX'
  | 'HARDWARE_LAB';

export function getCategoryForTab(tab: ViewTab): WorkspaceCategory {
  switch (tab) {
    case 'VFO_SDR':
      return 'TRANSCEIVER';
    case 'FM_RADIO':
      return 'FM_BROADCAST';
    case 'SCANNER':
    case 'NOAA_EAS':
      return 'SCAN_ALERTS';
    case 'BLACK_BOX':
    case 'TRAFFIC_LOG':
      return 'VOICE_AUDIO';
    case 'DIGITAL_MODES':
    case 'PROPAGATION':
    case 'ADIF_LOG':
      return 'DIGITAL_WX';
    case 'HARDWARE_RIG':
    case 'LAB_SUITE':
      return 'HARDWARE_LAB';
  }
}

export interface CategoryTabBarProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  frequencyMhz: number;
  mode: string;
  currentBandName: string;
  trafficSpotsCount: number;
}

export const CategoryTabBar: React.FC<CategoryTabBarProps> = ({
  activeTab,
  onSelectTab,
  frequencyMhz,
  mode,
  currentBandName,
  trafficSpotsCount,
}) => {
  const activeCategory = getCategoryForTab(activeTab);

  return (
    <nav className="panel nav-panel flex flex-col gap-2.5" aria-label="Tactical Workspace Navigation">
      {/* Tier 1: 6 Segmented Workspaces */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. TRANSCEIVER */}
          <button
            type="button"
            onClick={() => onSelectTab('VFO_SDR')}
            className={`px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
              activeCategory === 'TRANSCEIVER'
                ? 'bg-gradient-to-b from-amber-500/25 to-amber-600/10 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-500/15'
                : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
            }`}
          >
            <Radio
              className={`w-3.5 h-3.5 shrink-0 ${
                activeCategory === 'TRANSCEIVER' ? 'text-amber-400 animate-pulse' : 'text-zinc-500'
              }`}
            />
            <span>TRANSCEIVER</span>
          </button>

          {/* 2. FM & WORLDWIDE BROADCAST */}
          <button
            type="button"
            onClick={() => onSelectTab('FM_RADIO')}
            className={`px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
              activeCategory === 'FM_BROADCAST'
                ? 'bg-gradient-to-b from-pink-500/25 to-pink-600/10 text-pink-300 border-pink-500/60 shadow-lg shadow-pink-500/15'
                : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
            }`}
          >
            <Music
              className={`w-3.5 h-3.5 shrink-0 ${
                activeCategory === 'FM_BROADCAST' ? 'text-pink-400 animate-pulse' : 'text-zinc-500'
              }`}
            />
            <span>FM &amp; WEB STREAMS</span>
          </button>

          {/* 3. SCAN & ALERTS */}
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'SCANNER' && activeTab !== 'NOAA_EAS') {
                onSelectTab('SCANNER');
              }
            }}
            className={`px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
              activeCategory === 'SCAN_ALERTS'
                ? 'bg-gradient-to-b from-emerald-500/25 to-emerald-600/10 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-500/15'
                : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
            }`}
          >
            <FastForward
              className={`w-3.5 h-3.5 shrink-0 ${
                activeCategory === 'SCAN_ALERTS' ? 'text-emerald-400' : 'text-zinc-500'
              }`}
            />
            <span>SCAN &amp; ALERTS</span>
          </button>

          {/* 4. VOICE & SPOTS */}
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'BLACK_BOX' && activeTab !== 'TRAFFIC_LOG') {
                onSelectTab('BLACK_BOX');
              }
            }}
            className={`px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
              activeCategory === 'VOICE_AUDIO'
                ? 'bg-gradient-to-b from-orange-500/25 to-orange-600/10 text-orange-300 border-orange-500/60 shadow-lg shadow-orange-500/15'
                : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
            }`}
          >
            <HardDrive
              className={`w-3.5 h-3.5 shrink-0 ${
                activeCategory === 'VOICE_AUDIO' ? 'text-orange-400' : 'text-zinc-500'
              }`}
            />
            <span>VOICE &amp; SPOTS</span>
          </button>

          {/* 5. DIGITAL MODES */}
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'DIGITAL_MODES' && activeTab !== 'PROPAGATION' && activeTab !== 'ADIF_LOG') {
                onSelectTab('DIGITAL_MODES');
              }
            }}
            className={`px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
              activeCategory === 'DIGITAL_WX'
                ? 'bg-gradient-to-b from-purple-500/25 to-purple-600/10 text-purple-300 border-purple-500/60 shadow-lg shadow-purple-500/15'
                : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
            }`}
          >
            <Activity
              className={`w-3.5 h-3.5 shrink-0 ${
                activeCategory === 'DIGITAL_WX' ? 'text-purple-400' : 'text-zinc-500'
              }`}
            />
            <span>DIGITAL MODES</span>
          </button>

          {/* 6. RIG & LAB */}
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'HARDWARE_RIG' && activeTab !== 'LAB_SUITE') {
                onSelectTab('HARDWARE_RIG');
              }
            }}
            className={`px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none border active:scale-[0.98] ${
              activeCategory === 'HARDWARE_LAB'
                ? 'bg-gradient-to-b from-cyan-500/25 to-cyan-600/10 text-cyan-300 border-cyan-500/60 shadow-lg shadow-cyan-500/15'
                : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-zinc-800/80'
            }`}
          >
            <Cpu
              className={`w-3.5 h-3.5 shrink-0 ${
                activeCategory === 'HARDWARE_LAB' ? 'text-cyan-400' : 'text-zinc-500'
              }`}
            />
            <span>RIG &amp; LAB</span>
          </button>
        </div>

        {/* IARU Standard Calibration Reference Badge */}
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="text-zinc-500">IARU S9 REF:</span>
          <span className="text-amber-400 font-bold bg-amber-950/40 border border-amber-800/40 px-3.5 py-2 rounded-lg">
            {frequencyMhz > 30 ? '-93 dBm (VHF/UHF)' : '-73 dBm (HF)'}
          </span>
        </div>
      </div>

      {/* Tier 2: Sleek Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2.5 border-t border-zinc-800/60">
        {activeCategory === 'TRANSCEIVER' && (
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            <span className="px-4.5 py-2.5 rounded-lg bg-amber-500 text-black font-bold flex items-center gap-2 shadow-sm">
              <Radio className="w-3.5 h-3.5 shrink-0" /> VFO &amp; 120Hz WATERFALL
            </span>
            <span className="text-zinc-400 text-xs px-3.5 py-2 bg-zinc-900/60 rounded-lg border border-zinc-800">
              Tuned: <strong className="text-amber-300">{frequencyMhz.toFixed(4)} MHz</strong> ({mode}) •{' '}
              <span className="text-zinc-300">{currentBandName}</span>
            </span>
          </div>
        )}

        {activeCategory === 'FM_BROADCAST' && (
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            <span className="px-4.5 py-2.5 rounded-lg bg-pink-500 text-black font-bold flex items-center gap-2 shadow-sm">
              <Radio className="w-3.5 h-3.5 shrink-0" /> 87.5–108.0 MHz FM &amp; 40,000+ WORLDWIDE STREAMS
            </span>
            <span className="text-zinc-400 text-xs px-3.5 py-2 bg-zinc-900/60 rounded-lg border border-zinc-800">
              Sidechain S9 Auto-Ducker Active • Presets P1–P8
            </span>
          </div>
        )}

        {activeCategory === 'SCAN_ALERTS' && (
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => onSelectTab('SCANNER')}
              className={`px-4.5 py-2.5 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                activeTab === 'SCANNER'
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/30'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <FastForward className="w-3.5 h-3.5 shrink-0" /> TACTICAL SCANNER (100 ch/s)
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('NOAA_EAS')}
              className={`px-4.5 py-2.5 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                activeTab === 'NOAA_EAS'
                  ? 'bg-red-500 text-white border-red-400 shadow-md shadow-red-500/30'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> NOAA EAS SAME ALERTS
            </button>
          </div>
        )}

        {activeCategory === 'VOICE_AUDIO' && (
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => onSelectTab('BLACK_BOX')}
              className={`px-4.5 py-2.5 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                activeTab === 'BLACK_BOX'
                  ? 'bg-orange-500 text-black border-orange-400 shadow-md shadow-orange-500/30'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 shrink-0" /> 60s BLACK BOX REPLAY
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('TRAFFIC_LOG')}
              className={`px-4.5 py-2.5 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                activeTab === 'TRAFFIC_LOG'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5 shrink-0" /> HIGHWAY SPOTS ({trafficSpotsCount})
            </button>
          </div>
        )}

        {activeCategory === 'DIGITAL_WX' && (
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => onSelectTab('DIGITAL_MODES')}
              className={`px-4.5 py-2.5 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                activeTab === 'DIGITAL_MODES'
                  ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/30'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" /> APRS / FT8 / SSTV
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('PROPAGATION')}
              className={`px-4.5 py-2.5 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                activeTab === 'PROPAGATION'
                  ? 'bg-yellow-500 text-black border-yellow-400 shadow-md shadow-yellow-500/30'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <Sun className="w-3.5 h-3.5 shrink-0" /> SOLAR WX &amp; GREYLINE
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('ADIF_LOG')}
              className={`px-4.5 py-2.5 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                activeTab === 'ADIF_LOG'
                  ? 'bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-500/30'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" /> ADIF 3.1.4 LOGBOOK
            </button>
          </div>
        )}

        {activeCategory === 'HARDWARE_LAB' && (
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => onSelectTab('HARDWARE_RIG')}
              className={`px-4.5 py-2.5 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                activeTab === 'HARDWARE_RIG'
                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 shrink-0" /> RTL-SDR &amp; CAT RIG CONTROLLER
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('LAB_SUITE')}
              className={`px-4.5 py-2.5 rounded-lg font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                activeTab === 'LAB_SUITE'
                  ? 'bg-teal-500 text-black border-teal-400 shadow-md shadow-teal-500/30'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 shrink-0" /> CALIBRATION &amp; SIGNAL LAB
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
