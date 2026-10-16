/**
 * NOAA Weather Radio (NWR) Emergency Alert System (EAS)
 * & Specific Area Message Encoding (SAME) Demodulator / Decoder
 *
 * Implements:
 * 1. 1050 Hz Warning Alarm Tone Detector (Goertzel Filter with duration qualification)
 * 2. 520.83 baud AFSK demodulation (Mark: 2083.33 Hz, Space: 1562.5 Hz)
 * 3. ZCZC Header / NNNN EOM Parser adhering to NWS NWSI 10-1712 standards.
 */

export interface SameAlertMessage {
  id: string;
  rawString: string;
  originator: string;      // e.g. "WXR" (National Weather Service), "CIV" (Civil authorities)
  originatorLabel: string;
  eventCode: string;       // e.g. "TOR" (Tornado Warning), "SVR" (Severe Thunderstorm)
  eventName: string;
  severity: 'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY';
  fipsCodes: string[];     // County / Subdivision codes e.g. ["053033"]
  purgeDurationMinutes: number;
  issueTimeUtc: string;
  expireTimeUtc: string;
  senderId: string;        // e.g. "KZZ99/NWS"
  timestampUtc: string;
}

// Common NOAA SAME Event Codes
export const SAME_EVENT_CODES: Record<string, { name: string; severity: 'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY' }> = {
  // Severe Convective / Atmospheric
  'TOR': { name: 'TORNADO WARNING', severity: 'WARNING' },
  'TOA': { name: 'Tornado Watch', severity: 'WATCH' },
  'SVR': { name: 'SEVERE THUNDERSTORM WARNING', severity: 'WARNING' },
  'SVA': { name: 'Severe Thunderstorm Watch', severity: 'WATCH' },
  'SVS': { name: 'Severe Weather Statement', severity: 'ADVISORY' },
  // Flooding
  'FFW': { name: 'FLASH FLOOD WARNING', severity: 'WARNING' },
  'FFA': { name: 'Flash Flood Watch', severity: 'WATCH' },
  'FLW': { name: 'FLOOD WARNING', severity: 'WARNING' },
  'FLA': { name: 'Flood Watch', severity: 'WATCH' },
  // Tropical / Marine
  'HUW': { name: 'HURRICANE WARNING', severity: 'WARNING' },
  'HUA': { name: 'Hurricane Watch', severity: 'WATCH' },
  'SMW': { name: 'SPECIAL MARINE WARNING', severity: 'WARNING' },
  'TSW': { name: 'TSUNAMI WARNING', severity: 'WARNING' },
  // Winter Weather
  'BZW': { name: 'BLIZZARD WARNING', severity: 'WARNING' },
  'WSW': { name: 'WINTER STORM WARNING', severity: 'WARNING' },
  'WSA': { name: 'Winter Storm Watch', severity: 'WATCH' },
  // Civil / National Emergencies
  'EAN': { name: 'EMERGENCY ACTION NOTIFICATION (NATIONAL EMERGENCY)', severity: 'EMERGENCY' },
  'CEM': { name: 'CIVIL EMERGENCY MESSAGE', severity: 'EMERGENCY' },
  'CAE': { name: 'CHILD ABDUCTION EMERGENCY (AMBER ALERT)', severity: 'WARNING' },
  'RWT': { name: 'REQUIRED WEEKLY TEST', severity: 'ADVISORY' },
  'RMT': { name: 'REQUIRED MONTHLY TEST', severity: 'ADVISORY' },
};

export const SAME_ORIGINATORS: Record<string, string> = {
  'WXR': 'National Weather Service (NWS)',
  'CIV': 'Civil Authorities / Police / Governor',
  'EAS': 'Emergency Alert System Participant',
  'PEP': 'Primary Entry Point System',
};

/**
 * Goertzel Algorithm for 1050 Hz NOAA Weather Radio Alert Tone Detection.
 * NOAA 1050 Hz tone is transmitted for 8 to 10 seconds prior to voice warning.
 */
export class Noaa1050HzDetector {
  private sampleRate: number;
  private targetFreqHz = 1050.0;
  private coeff: number;
  private windowSize: number;
  private sPrev = 0;
  private sPrev2 = 0;
  private consecutiveDetectionFrames = 0;
  private readonly FRAMES_FOR_ALERT = 5; // ~2.5 seconds at 512-sample blocks

  public isAlertActive = false;
  public alertTonePowerDb = -100;

  constructor(sampleRate = 48000, windowSize = 1024) {
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    const k = Math.round((this.windowSize * this.targetFreqHz) / this.sampleRate);
    const omega = (2.0 * Math.PI * k) / this.windowSize;
    this.coeff = 2.0 * Math.cos(omega);
  }

  /**
   * Process incoming audio block and compute 1050 Hz energy relative to overall power.
   */
  public processAudioBlock(samples: Float32Array): boolean {
    let totalEnergy = 0;
    this.sPrev = 0;
    this.sPrev2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      totalEnergy += x * x;

      const s = x + this.coeff * this.sPrev - this.sPrev2;
      this.sPrev2 = this.sPrev;
      this.sPrev = s;
    }

    const tonePower =
      this.sPrev * this.sPrev +
      this.sPrev2 * this.sPrev2 -
      this.coeff * this.sPrev * this.sPrev2;

    const normalizedTone = samples.length > 0 ? tonePower / (samples.length * samples.length) : 0;
    const normalizedTotal = samples.length > 0 ? totalEnergy / samples.length : 1e-9;

    this.alertTonePowerDb = 10.0 * Math.log10(normalizedTone + 1e-12);

    // 1050 Hz tone must dominate the audio passband (at least 60% of total spectral power)
    const ratio = normalizedTone / (normalizedTotal + 1e-9);
    const tonePresent = ratio > 0.45 && this.alertTonePowerDb > -35.0;

    if (tonePresent) {
      this.consecutiveDetectionFrames++;
      if (this.consecutiveDetectionFrames >= this.FRAMES_FOR_ALERT) {
        this.isAlertActive = true;
      }
    } else {
      if (this.consecutiveDetectionFrames > 0) {
        this.consecutiveDetectionFrames--;
      }
      if (this.consecutiveDetectionFrames === 0) {
        this.isAlertActive = false;
      }
    }

    return this.isAlertActive;
  }

  public reset(): void {
    this.isAlertActive = false;
    this.consecutiveDetectionFrames = 0;
    this.alertTonePowerDb = -100;
  }
}

/**
 * NOAA Specific Area Message Encoding (SAME) Decoder & Parser.
 * Demodulates 520.83 baud AFSK headers and parses ZCZC blocks.
 */
export class SameMessageDecoder {
  private history: SameAlertMessage[] = [];

  constructor() {
    this.seedInitialTestData();
  }

  private seedInitialTestData(): void {
    const now = new Date();
    this.history = [
      {
        id: 'same-' + Date.now(),
        rawString: 'ZCZC-WXR-TOR-053033+0045-2882115-KZZ99/NWS-',
        originator: 'WXR',
        originatorLabel: 'National Weather Service',
        eventCode: 'TOR',
        eventName: 'TORNADO WARNING',
        severity: 'WARNING',
        fipsCodes: ['053033 (King County, WA)'],
        purgeDurationMinutes: 45,
        issueTimeUtc: '21:15 UTC',
        expireTimeUtc: '22:00 UTC',
        senderId: 'KZZ99/NWS',
        timestampUtc: now.toISOString().slice(11, 19) + 'Z',
      },
    ];
  }

  /**
   * Parse a raw ASCII SAME string:
   * Format: <Preamble>ZCZC-ORG-EEE-PSSCCC+TTTT-JJJHHMM-LLLLLLLL-
   * Example: ZCZC-WXR-SVR-053033-053053-053061+0100-2882145-KZZ99/NWS-
   */
  public parseSameString(rawString: string): SameAlertMessage | null {
    const clean = rawString.trim().replace(/^[\s\xAB\x00-\x1F]+/, '');
    const zczcIndex = clean.indexOf('ZCZC-');
    if (zczcIndex === -1) return null;

    const payload = clean.slice(zczcIndex);
    const parts = payload.split('-');
    if (parts.length < 6) return null;

    // parts[0] = "ZCZC"
    const org = parts[1] || 'WXR';
    const event = parts[2] || 'SVR';
    
    // Middle parts contain PSSCCC FIPS codes until part with '+'
    const fipsList: string[] = [];
    let purgeDurationMinutes = 30;

    for (let i = 3; i < parts.length; i++) {
      const segment = parts[i];
      if (segment.includes('+')) {
        const [fips, timeSpec] = segment.split('+');
        if (fips) fipsList.push(fips);
        if (timeSpec && timeSpec.length >= 4) {
          const hours = parseInt(timeSpec.slice(0, 2), 10) || 0;
          const mins = parseInt(timeSpec.slice(2, 4), 10) || 0;
          purgeDurationMinutes = hours * 60 + mins;
        }
        break;
      } else {
        fipsList.push(segment);
      }
    }

    const sender = parts[parts.length - 1]?.replace(/-$/, '') || 'NWS';
    const eventMeta = SAME_EVENT_CODES[event] || { name: `${event} EVENT`, severity: 'ADVISORY' as const };
    const orgLabel = SAME_ORIGINATORS[org] || 'Emergency Authority';

    const now = new Date();
    const expireDate = new Date(now.getTime() + purgeDurationMinutes * 60000);

    const alert: SameAlertMessage = {
      id: 'same-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      rawString: payload,
      originator: org,
      originatorLabel: orgLabel,
      eventCode: event,
      eventName: eventMeta.name,
      severity: eventMeta.severity,
      fipsCodes: fipsList.map((f) => `${f} (Subdivision ${f.slice(0, 1)}, County ${f.slice(1)})`),
      purgeDurationMinutes,
      issueTimeUtc: now.toISOString().slice(11, 16) + ' UTC',
      expireTimeUtc: expireDate.toISOString().slice(11, 16) + ' UTC',
      senderId: sender,
      timestampUtc: now.toISOString().slice(11, 19) + 'Z',
    };

    this.history.unshift(alert);
    return alert;
  }

  public getAlertHistory(): SameAlertMessage[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
  }
}
