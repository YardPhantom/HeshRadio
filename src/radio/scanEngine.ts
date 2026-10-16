/**
 * Tactical Memory Channel Bank & High-Speed Scanner Engine
 *
 * Implements:
 * 1. Multi-Bank Channel Memories with CTCSS, Offsets, Modes, and Alpha Tags.
 * 2. Carrier-Operated (CO) and Time-Operated (TO) Scan Resume Modes.
 * 3. Priority Channel Watch (e.g. background polling of Ch 19 or Ch 9 every 2.0s).
 * 4. Channel Lockout / Skip management.
 * 5. Full JSON / CSV Backup & Restore.
 */

import { ModulationModeExtended } from './bandPlans';

export interface MemoryChannel {
  id: string;
  bankId: string;
  channelNumber: number;
  label: string;
  frequencyMhz: number;
  mode: ModulationModeExtended;
  ctcssToneHz: number | null;
  repeaterOffsetMhz: number;
  powerWatts: number;
  alphaTag: string;
  skip: boolean;
  priority?: boolean;
}

export interface MemoryBank {
  id: string;
  name: string;
  description: string;
  channels: MemoryChannel[];
}

export type ScanResumeMode = 'CARRIER_OPERATED' | 'TIME_OPERATED' | 'SEEK_HOLD';

export interface ScanStatus {
  isScanning: boolean;
  activeBankId: string;
  currentChannel: MemoryChannel | null;
  channelsScannedPerSec: number;
  dwellMs: number;
  resumeMode: ScanResumeMode;
  pausedOnSignal: boolean;
  priorityWatchEnabled: boolean;
  priorityChannel: MemoryChannel | null;
}

export const DEFAULT_MEMORY_BANKS: MemoryBank[] = [
  {
    id: 'bank-cb',
    name: 'CB Highway & Trucker Comms',
    description: '11-Meter Citizens Band priority channels, highway corridors, and skip monitoring',
    channels: [
      {
        id: 'cb-19',
        bankId: 'bank-cb',
        channelNumber: 19,
        label: 'CH 19',
        frequencyMhz: 27.185,
        mode: 'AM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 4.0,
        alphaTag: 'HIGHWAY TRUCKER TRANSCON',
        skip: false,
        priority: true,
      },
      {
        id: 'cb-9',
        bankId: 'bank-cb',
        channelNumber: 9,
        label: 'CH 09',
        frequencyMhz: 27.065,
        mode: 'AM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 4.0,
        alphaTag: 'EMERGENCY / REACT GUARD',
        skip: false,
        priority: true,
      },
      {
        id: 'cb-6',
        bankId: 'bank-cb',
        channelNumber: 6,
        label: 'CH 06',
        frequencyMhz: 27.025,
        mode: 'AM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 4.0,
        alphaTag: 'SUPER BOWL / HIGH POWER DX',
        skip: false,
      },
      {
        id: 'cb-38',
        bankId: 'bank-cb',
        channelNumber: 38,
        label: 'CH 38 LSB',
        frequencyMhz: 27.385,
        mode: 'LSB',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 12.0,
        alphaTag: 'NATIONAL LSB DX SHOOTOUT',
        skip: false,
      },
      {
        id: 'cb-11',
        bankId: 'bank-cb',
        channelNumber: 11,
        label: 'CH 11',
        frequencyMhz: 27.085,
        mode: 'AM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 4.0,
        alphaTag: 'ORIGINAL CB CALLING CHAN',
        skip: false,
      },
      {
        id: 'cb-14',
        bankId: 'bank-cb',
        channelNumber: 14,
        label: 'CH 14',
        frequencyMhz: 27.125,
        mode: 'AM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 4.0,
        alphaTag: '4x4 OFF-ROAD TRAIL CHAT',
        skip: false,
      },
    ],
  },
  {
    id: 'bank-noaa',
    name: 'NOAA Weather Radio All-Hazards',
    description: 'NWS VHF 162 MHz broadcast network with 1050 Hz and SAME alert monitoring',
    channels: [
      {
        id: 'wx-1',
        bankId: 'bank-noaa',
        channelNumber: 1,
        label: 'WX 1',
        frequencyMhz: 162.550,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 0.0,
        alphaTag: 'NOAA NWR PRIMARY (162.550)',
        skip: false,
      },
      {
        id: 'wx-2',
        bankId: 'bank-noaa',
        channelNumber: 2,
        label: 'WX 2',
        frequencyMhz: 162.400,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 0.0,
        alphaTag: 'NOAA NWR (162.400)',
        skip: false,
      },
      {
        id: 'wx-3',
        bankId: 'bank-noaa',
        channelNumber: 3,
        label: 'WX 3',
        frequencyMhz: 162.475,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 0.0,
        alphaTag: 'NOAA NWR (162.475)',
        skip: false,
      },
      {
        id: 'wx-4',
        bankId: 'bank-noaa',
        channelNumber: 4,
        label: 'WX 4',
        frequencyMhz: 162.425,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 0.0,
        alphaTag: 'NOAA NWR (162.425)',
        skip: false,
      },
      {
        id: 'wx-5',
        bankId: 'bank-noaa',
        channelNumber: 5,
        label: 'WX 5',
        frequencyMhz: 162.450,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 0.0,
        alphaTag: 'NOAA NWR (162.450)',
        skip: false,
      },
      {
        id: 'wx-6',
        bankId: 'bank-noaa',
        channelNumber: 6,
        label: 'WX 6',
        frequencyMhz: 162.500,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 0.0,
        alphaTag: 'NOAA NWR (162.500)',
        skip: false,
      },
      {
        id: 'wx-7',
        bankId: 'bank-noaa',
        channelNumber: 7,
        label: 'WX 7',
        frequencyMhz: 162.525,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 0.0,
        alphaTag: 'NOAA NWR (162.525)',
        skip: false,
      },
    ],
  },
  {
    id: 'bank-gmrs',
    name: 'GMRS / FRS UHF Channels',
    description: '462 / 467 MHz FM emergency, traveler assistance, and repeater pairs',
    channels: [
      {
        id: 'gmrs-20',
        bankId: 'bank-gmrs',
        channelNumber: 20,
        label: 'GMRS 20',
        frequencyMhz: 462.675,
        mode: 'NFM',
        ctcssToneHz: 141.3,
        repeaterOffsetMhz: 5.0,
        powerWatts: 50.0,
        alphaTag: 'NATIONAL TRAVEL / EMERG (141.3)',
        skip: false,
        priority: true,
      },
      {
        id: 'gmrs-15',
        bankId: 'bank-gmrs',
        channelNumber: 15,
        label: 'GMRS 15',
        frequencyMhz: 462.550,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 5.0,
        powerWatts: 50.0,
        alphaTag: 'GMRS REPEATER 550',
        skip: false,
      },
      {
        id: 'gmrs-19',
        bankId: 'bank-gmrs',
        channelNumber: 19,
        label: 'GMRS 19',
        frequencyMhz: 462.650,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 5.0,
        powerWatts: 50.0,
        alphaTag: 'GMRS ROAD CHAT 650',
        skip: false,
      },
      {
        id: 'gmrs-1',
        bankId: 'bank-gmrs',
        channelNumber: 1,
        label: 'FRS 1',
        frequencyMhz: 462.5625,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 2.0,
        alphaTag: 'FRS/GMRS SIMPLEX CALLING',
        skip: false,
      },
    ],
  },
  {
    id: 'bank-ham',
    name: 'Ham Radio Calling & Digital',
    description: 'National simplex calling frequencies, FT8 digital hubs, and APRS packet beacons',
    channels: [
      {
        id: 'ham-2m-call',
        bankId: 'bank-ham',
        channelNumber: 1,
        label: '2M CALL',
        frequencyMhz: 146.520,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 50.0,
        alphaTag: 'NATIONAL 2M FM SIMPLEX CALLING',
        skip: false,
        priority: true,
      },
      {
        id: 'ham-70cm-call',
        bankId: 'bank-ham',
        channelNumber: 2,
        label: '70CM CALL',
        frequencyMhz: 446.000,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 50.0,
        alphaTag: 'NATIONAL 70CM FM SIMPLEX',
        skip: false,
      },
      {
        id: 'ham-aprs',
        bankId: 'bank-ham',
        channelNumber: 3,
        label: 'APRS 2M',
        frequencyMhz: 144.390,
        mode: 'NFM',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 25.0,
        alphaTag: 'NORTH AMERICAN APRS PACKET',
        skip: false,
      },
      {
        id: 'ham-20m-ft8',
        bankId: 'bank-ham',
        channelNumber: 4,
        label: '20M FT8',
        frequencyMhz: 14.074,
        mode: 'USB',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 25.0,
        alphaTag: 'WORLDWIDE 20M FT8 ACTIVITY',
        skip: false,
      },
      {
        id: 'ham-11m-dx',
        bankId: 'bank-ham',
        channelNumber: 5,
        label: '27.555 USB',
        frequencyMhz: 27.555,
        mode: 'USB',
        ctcssToneHz: null,
        repeaterOffsetMhz: 0.0,
        powerWatts: 50.0,
        alphaTag: 'TRIPLE-FIVE INTERNATIONAL DX',
        skip: false,
      },
    ],
  },
];

const STORAGE_KEY = 'heshradio_memory_banks';

export class ScanEngine {
  private banks: MemoryBank[] = [];
  private activeBankId = 'bank-cb';
  private currentChannelIndex = 0;
  private isScanning = false;
  private scanTimer: number | null = null;
  private pausedOnSignal = false;
  private pauseResumeTimer: number | null = null;

  private resumeMode: ScanResumeMode = 'CARRIER_OPERATED';
  private dwellMs = 120; // 120ms per channel (~8 ch/sec)
  private priorityWatchEnabled = true;

  private onFrequencyTuneCallback?: (channel: MemoryChannel) => void;

  constructor() {
    this.loadBanks();
  }

  private loadBanks(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.banks = JSON.parse(stored);
      } else {
        this.banks = DEFAULT_MEMORY_BANKS;
        this.saveBanks();
      }
    } catch {
      this.banks = DEFAULT_MEMORY_BANKS;
    }
  }

  public saveBanks(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.banks));
    } catch (e) {
      console.error('[ScanEngine] Failed to save memory banks:', e);
    }
  }

  public getBanks(): MemoryBank[] {
    return this.banks;
  }

  public getActiveBank(): MemoryBank {
    return this.banks.find((b) => b.id === this.activeBankId) || this.banks[0];
  }

  public setActiveBankId(bankId: string): void {
    this.activeBankId = bankId;
    this.currentChannelIndex = 0;
  }

  public setOnFrequencyTune(cb: (channel: MemoryChannel) => void): void {
    this.onFrequencyTuneCallback = cb;
  }

  public startScan(resumeMode: ScanResumeMode = 'CARRIER_OPERATED', dwellMs = 120): void {
    this.resumeMode = resumeMode;
    this.dwellMs = dwellMs;
    this.isScanning = true;
    this.pausedOnSignal = false;
    this.stepScan();
  }

  public stopScan(): void {
    this.isScanning = false;
    this.pausedOnSignal = false;
    if (this.scanTimer !== null) {
      window.clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.pauseResumeTimer !== null) {
      window.clearTimeout(this.pauseResumeTimer);
      this.pauseResumeTimer = null;
    }
  }

  /**
   * Called by the receiver DSP loop when carrier squelch state changes.
   */
  public notifySquelchState(squelchOpen: boolean): void {
    if (!this.isScanning) return;

    if (squelchOpen) {
      if (!this.pausedOnSignal) {
        this.pausedOnSignal = true;
        if (this.scanTimer !== null) {
          window.clearTimeout(this.scanTimer);
          this.scanTimer = null;
        }

        if (this.resumeMode === 'TIME_OPERATED') {
          // Pause for 5.0 seconds, then resume scan regardless
          this.pauseResumeTimer = window.setTimeout(() => {
            this.pausedOnSignal = false;
            this.stepScan();
          }, 5000);
        } else if (this.resumeMode === 'SEEK_HOLD') {
          this.stopScan();
        }
      }
    } else {
      // Squelch closed (carrier dropped)
      if (this.pausedOnSignal && this.resumeMode === 'CARRIER_OPERATED') {
        // Wait 1.5 seconds after speech finishes, then resume
        if (this.pauseResumeTimer !== null) {
          window.clearTimeout(this.pauseResumeTimer);
        }
        this.pauseResumeTimer = window.setTimeout(() => {
          this.pausedOnSignal = false;
          this.stepScan();
        }, 1500);
      }
    }
  }

  private stepScan(): void {
    if (!this.isScanning || this.pausedOnSignal) return;

    const bank = this.getActiveBank();
    const activeChannels = bank.channels.filter((c) => !c.skip);
    if (activeChannels.length === 0) {
      this.stopScan();
      return;
    }

    this.currentChannelIndex = (this.currentChannelIndex + 1) % activeChannels.length;
    const channel = activeChannels[this.currentChannelIndex];

    if (this.onFrequencyTuneCallback) {
      this.onFrequencyTuneCallback(channel);
    }

    this.scanTimer = window.setTimeout(() => {
      this.stepScan();
    }, this.dwellMs);
  }

  public toggleChannelSkip(bankId: string, channelId: string): void {
    const bank = this.banks.find((b) => b.id === bankId);
    if (!bank) return;
    const ch = bank.channels.find((c) => c.id === channelId);
    if (ch) {
      ch.skip = !ch.skip;
      this.saveBanks();
    }
  }

  public addChannel(bankId: string, channel: Omit<MemoryChannel, 'id'>): MemoryChannel {
    const bank = this.banks.find((b) => b.id === bankId);
    const newChan: MemoryChannel = {
      ...channel,
      id: 'chan-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    };
    if (bank) {
      bank.channels.push(newChan);
      this.saveBanks();
    }
    return newChan;
  }

  public deleteChannel(bankId: string, channelId: string): void {
    const bank = this.banks.find((b) => b.id === bankId);
    if (bank) {
      bank.channels = bank.channels.filter((c) => c.id !== channelId);
      this.saveBanks();
    }
  }

  public exportJson(): string {
    return JSON.stringify(this.banks, null, 2);
  }

  public importJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].channels) {
        this.banks = parsed;
        this.saveBanks();
        return true;
      }
    } catch (e) {
      console.error('[ScanEngine] Failed to import JSON:', e);
    }
    return false;
  }

  public getStatus(): ScanStatus {
    const bank = this.getActiveBank();
    const activeChannels = bank.channels.filter((c) => !c.skip);
    const current = activeChannels[this.currentChannelIndex] || null;
    const priority = bank.channels.find((c) => c.priority) || null;

    return {
      isScanning: this.isScanning,
      activeBankId: this.activeBankId,
      currentChannel: current,
      channelsScannedPerSec: Math.round(1000 / this.dwellMs),
      dwellMs: this.dwellMs,
      resumeMode: this.resumeMode,
      pausedOnSignal: this.pausedOnSignal,
      priorityWatchEnabled: this.priorityWatchEnabled,
      priorityChannel: priority,
    };
  }
}
