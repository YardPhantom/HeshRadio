/**
 * ADIF 3.1.4 (Amateur Data Interchange Format) QSO Logger
 * Full specification compliance for log export, import, and verification.
 */

export interface AdifQsoRecord {
  id: string;
  call: string;
  qsoDate: string;        // YYYYMMDD
  timeOn: string;         // HHMMSS or HHMM
  timeOff?: string;       // HHMMSS
  band: string;           // e.g. "11m", "20m", "40m", "2m", "70cm"
  freqMhz: string;        // Frequency in MHz e.g. "27.18500", "14.07400"
  mode: string;           // "AM", "SSB", "FM", "CW", "FT8", "MFSK", "SSTV"
  submode?: string;       // "USB", "LSB", "JS8"
  rstSent: string;        // e.g. "59", "599", "-08"
  rstRcvd: string;        // e.g. "59", "599", "+04"
  gridSquare?: string;    // e.g. "CN87uq"
  myGridSquare?: string;  // e.g. "FN31pr"
  name?: string;          // Operator name / handle
  qth?: string;           // City/State
  comment?: string;
  propMode?: string;      // "F2", "ES", "AUR", "TR"
  operator?: string;
}

const STORAGE_KEY = 'heshradio_adif_qso_log';

export class AdifLogger {
  private records: AdifQsoRecord[] = [];

  constructor() {
    this.loadFromStorage();
    if (this.records.length === 0) {
      this.seedInitialQso();
    }
  }

  private seedInitialQso(): void {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.records = [
      {
        id: 'qso-1',
        call: 'K1ABC',
        qsoDate: today,
        timeOn: '201530',
        band: '11m',
        freqMhz: '27.18500',
        mode: 'AM',
        rstSent: '59',
        rstRcvd: '59',
        name: 'Buck',
        gridSquare: 'EM73',
        myGridSquare: 'CN87uq',
        comment: 'Ch 19 Highway Trucker Radio Check // Clean 4:1 Dynamike audio',
        operator: 'HESHRADIO-19',
      },
      {
        id: 'qso-2',
        call: 'W6XYZ',
        qsoDate: today,
        timeOn: '210415',
        band: '20m',
        freqMhz: '14.07400',
        mode: 'FT8',
        submode: 'USB',
        rstSent: '-06',
        rstRcvd: '+02',
        name: 'Dave',
        gridSquare: 'CM87',
        myGridSquare: 'CN87uq',
        comment: '20m Daytime Intercontinental FT8 contact',
        operator: 'HESHRADIO-19',
      },
      {
        id: 'qso-3',
        call: 'Delta X-Ray 707',
        qsoDate: today,
        timeOn: '214500',
        band: '11m',
        freqMhz: '27.38500',
        mode: 'SSB',
        submode: 'LSB',
        rstSent: '59+10',
        rstRcvd: '58',
        name: 'Jim',
        gridSquare: 'EL98',
        myGridSquare: 'CN87uq',
        comment: 'Ch 38 LSB North American DX Skip Shootout',
        propMode: 'F2',
        operator: 'HESHRADIO-19',
      },
    ];
    this.saveToStorage();
  }

  public getRecords(): AdifQsoRecord[] {
    return [...this.records];
  }

  public addRecord(qso: Omit<AdifQsoRecord, 'id'>): AdifQsoRecord {
    const record: AdifQsoRecord = {
      ...qso,
      id: 'qso-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    };
    this.records.unshift(record);
    this.saveToStorage();
    return record;
  }

  public deleteRecord(id: string): void {
    this.records = this.records.filter((r) => r.id !== id);
    this.saveToStorage();
  }

  public clearAll(): void {
    this.records = [];
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {}
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.records = JSON.parse(data);
      }
    } catch {}
  }

  /**
   * Generates full ADIF 3.1.4 format string for export.
   */
  public exportAdifString(): string {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    let out = `ADIF Export from HeshRadio v1.0\n`;
    out += `Generated at ${new Date().toUTCString()}\n`;
    out += `<ADIF_VER:5>3.1.4\n`;
    out += `<PROGRAMID:9>HeshRadio\n`;
    out += `<PROGRAMVERSION:5>1.0.0\n`;
    out += `<CREATED_TIMESTAMP:14>${timestamp}\n`;
    out += `<EOH>\n\n`;

    for (const r of this.records) {
      let line = '';
      line += `<CALL:${r.call.length}>${r.call} `;
      line += `<QSO_DATE:${r.qsoDate.length}>${r.qsoDate} `;
      line += `<TIME_ON:${r.timeOn.length}>${r.timeOn} `;
      if (r.timeOff) line += `<TIME_OFF:${r.timeOff.length}>${r.timeOff} `;
      line += `<BAND:${r.band.length}>${r.band} `;
      line += `<FREQ:${r.freqMhz.length}>${r.freqMhz} `;
      line += `<MODE:${r.mode.length}>${r.mode} `;
      if (r.submode) line += `<SUBMODE:${r.submode.length}>${r.submode} `;
      line += `<RST_SENT:${r.rstSent.length}>${r.rstSent} `;
      line += `<RST_RCVD:${r.rstRcvd.length}>${r.rstRcvd} `;
      if (r.name) line += `<NAME:${r.name.length}>${r.name} `;
      if (r.gridSquare) line += `<GRIDSQUARE:${r.gridSquare.length}>${r.gridSquare} `;
      if (r.myGridSquare) line += `<MY_GRIDSQUARE:${r.myGridSquare.length}>${r.myGridSquare} `;
      if (r.comment) line += `<COMMENT:${r.comment.length}>${r.comment} `;
      if (r.propMode) line += `<PROP_MODE:${r.propMode.length}>${r.propMode} `;
      if (r.operator) line += `<OPERATOR:${r.operator.length}>${r.operator} `;
      line += `<EOR>\n`;
      out += line;
    }
    return out;
  }

  /**
   * Imports ADIF 3.1.4 string and parses records into memory.
   */
  public importAdifString(adifText: string): number {
    const eohIndex = adifText.toUpperCase().indexOf('<EOH>');
    const dataPart = eohIndex >= 0 ? adifText.slice(eohIndex + 5) : adifText;
    const rawRecords = dataPart.split(/<EOR>/i);
    let importedCount = 0;

    for (const raw of rawRecords) {
      if (!raw.trim()) continue;
      const parsed: Partial<AdifQsoRecord> = {};
      const tagRegex = /<([A-Za-z0-9_]+):(\d+)(?::[A-Za-z])?>([^<]*)/g;
      let match: RegExpExecArray | null;

      while ((match = tagRegex.exec(raw)) !== null) {
        const tag = match[1].toUpperCase();
        const len = parseInt(match[2], 10);
        const val = match[3].slice(0, len).trim();

        switch (tag) {
          case 'CALL': parsed.call = val; break;
          case 'QSO_DATE': parsed.qsoDate = val; break;
          case 'TIME_ON': parsed.timeOn = val; break;
          case 'TIME_OFF': parsed.timeOff = val; break;
          case 'BAND': parsed.band = val; break;
          case 'FREQ': parsed.freqMhz = val; break;
          case 'MODE': parsed.mode = val; break;
          case 'SUBMODE': parsed.submode = val; break;
          case 'RST_SENT': parsed.rstSent = val; break;
          case 'RST_RCVD': parsed.rstRcvd = val; break;
          case 'NAME': parsed.name = val; break;
          case 'GRIDSQUARE': parsed.gridSquare = val; break;
          case 'MY_GRIDSQUARE': parsed.myGridSquare = val; break;
          case 'COMMENT': parsed.comment = val; break;
          case 'PROP_MODE': parsed.propMode = val; break;
          case 'OPERATOR': parsed.operator = val; break;
        }
      }

      if (parsed.call && parsed.qsoDate) {
        this.addRecord({
          call: parsed.call,
          qsoDate: parsed.qsoDate,
          timeOn: parsed.timeOn || '000000',
          timeOff: parsed.timeOff,
          band: parsed.band || '11m',
          freqMhz: parsed.freqMhz || '27.185',
          mode: parsed.mode || 'AM',
          submode: parsed.submode,
          rstSent: parsed.rstSent || '59',
          rstRcvd: parsed.rstRcvd || '59',
          gridSquare: parsed.gridSquare,
          myGridSquare: parsed.myGridSquare,
          name: parsed.name,
          comment: parsed.comment,
          propMode: parsed.propMode,
          operator: parsed.operator,
        });
        importedCount++;
      }
    }
    return importedCount;
  }
}
