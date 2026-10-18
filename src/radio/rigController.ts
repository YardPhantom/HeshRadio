import { ModulationModeExtended } from './bandPlans';

export type CatProtocolType = 'KENWOOD' | 'YAESU' | 'ICOM_CIV' | 'HAMLIB_RIGCTLD';
export type HardwarePttMechanism = 'SERIAL_RTS' | 'SERIAL_DTR' | 'CM108_GPIO' | 'CAT_COMMAND' | 'VOX';
export type RepeaterOffsetMode = 'SIMPLEX' | 'PLUS_OFFSET' | 'MINUS_OFFSET' | 'SPLIT';

export interface RigStatus {
  connected: boolean;
  protocol: CatProtocolType;
  pttMechanism: HardwarePttMechanism;
  vfoAFreqHz: number;
  vfoBFreqHz: number;
  activeVfo: 'VFO_A' | 'VFO_B';
  mode: ModulationModeExtended;
  txActive: boolean;
  repeaterOffsetMode: RepeaterOffsetMode;
  repeaterOffsetHz: number;
  sMeterDbm: number;
  totRemainingSec: number;
  totConfiguredSec: number;
  portLabel: string;
  statusMessage: string;
}

export type RigUpdateCallback = (status: RigStatus) => void;

/**
 * Encodes frequency in Hz into 5-byte Little-Endian Packed BCD for Icom CI-V.
 * Example: 27,185,000 Hz -> [0x00, 0x50, 0x18, 0x27, 0x00]
 */
export function encodeIcomBcdFrequency(freqHz: number): Uint8Array {
  const bcd = new Uint8Array(5);
  let n = freqHz;
  for (let i = 0; i < 5; i++) {
    const low = n % 10;
    n = Math.floor(n / 10);
    const high = n % 10;
    n = Math.floor(n / 10);
    bcd[i] = (high << 4) | low;
  }
  return bcd;
}

/**
 * Decodes 5-byte Little-Endian Packed BCD into frequency in Hz.
 */
export function decodeIcomBcdFrequency(bytes: Uint8Array, offset: number = 0): number {
  let freqHz = 0;
  let mult = 1;
  for (let i = 0; i < 5; i++) {
    const b = bytes[offset + i];
    const low = b & 0x0f;
    const high = (b >>> 4) & 0x0f;
    freqHz += (low + high * 10) * mult;
    mult *= 100;
  }
  return freqHz;
}

/**
 * Unified RigController for Physical CB, GMRS, and Amateur Radio Transceivers.
 */
export class RigController {
  private status: RigStatus = {
    connected: false,
    protocol: 'KENWOOD',
    pttMechanism: 'SERIAL_RTS',
    vfoAFreqHz: 27_185_000,
    vfoBFreqHz: 27_185_000,
    activeVfo: 'VFO_A',
    mode: 'AM',
    txActive: false,
    repeaterOffsetMode: 'SIMPLEX',
    repeaterOffsetHz: 0,
    sMeterDbm: -105,
    totRemainingSec: 180,
    totConfiguredSec: 180,
    portLabel: 'Disconnected (Simulation / Direct SDR Mode)',
    statusMessage: 'Ready to connect CAT rig or Digirig interface',
  };

  private onUpdateCallback: RigUpdateCallback | null = null;
  private serialPort: any = null; // WebSerial SerialPort
  private serialWriter: any = null;
  private serialReader: any = null;

  private hidDevice: any = null; // WebHID Device for CM108 GPIO
  private wsRigctld: WebSocket | null = null; // Hamlib WebSocket bridge
  private totIntervalId: number | null = null;
  private pollIntervalId: number | null = null;

  // Icom CI-V Address (default 0x94 for IC-7300, 0x00 for broadcast)
  public icomCivAddress = 0x94;

  constructor() {
    this.installPanicUnkeySafetyWatchdog();
  }

  public getStatus(): RigStatus {
    return { ...this.status };
  }

  public onStatusUpdate(callback: RigUpdateCallback): void {
    this.onUpdateCallback = callback;
  }

  private notify(): void {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getStatus());
    }
  }

  /**
   * Fail-Safe Hardware Watchdog: Enforces panic-unkey on window blur,
   * tab switch, or communication disconnect so transmitters can NEVER get stuck keyed.
   */
  private installPanicUnkeySafetyWatchdog(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => {
        if (this.status.txActive) {
          console.warn('[RigController] Window blur detected! Activating PANIC UNKEY safety.');
          this.setTransmit(false, 'Panic Unkey (Window Focus Lost)');
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.status.txActive) {
          console.warn('[RigController] Page hidden! Activating PANIC UNKEY safety.');
          this.setTransmit(false, 'Panic Unkey (Page Hidden)');
        }
      });
    }
  }

  public setProtocol(protocol: CatProtocolType): void {
    this.status.protocol = protocol;
    this.notify();
  }

  public setPttMechanism(mech: HardwarePttMechanism): void {
    this.status.pttMechanism = mech;
    this.notify();
  }

  public setTotTimeout(seconds: number): void {
    this.status.totConfiguredSec = Math.max(10, Math.min(600, seconds));
    this.status.totRemainingSec = this.status.totConfiguredSec;
    this.notify();
  }

  public setRepeaterOffset(mode: RepeaterOffsetMode, offsetHz: number = 0): void {
    this.status.repeaterOffsetMode = mode;
    this.status.repeaterOffsetHz = offsetHz;
    this.notify();
  }

  public setFrequency(freqHz: number, vfo: 'VFO_A' | 'VFO_B' = this.status.activeVfo): void {
    if (vfo === 'VFO_A') {
      this.status.vfoAFreqHz = freqHz;
    } else {
      this.status.vfoBFreqHz = freqHz;
    }
    this.sendCatFrequency(freqHz);
    this.notify();
  }

  public setMode(mode: ModulationModeExtended): void {
    this.status.mode = mode;
    this.sendCatMode(mode);
    this.notify();
  }

  public switchActiveVfo(): void {
    this.status.activeVfo = this.status.activeVfo === 'VFO_A' ? 'VFO_B' : 'VFO_A';
    const targetFreq =
      this.status.activeVfo === 'VFO_A' ? this.status.vfoAFreqHz : this.status.vfoBFreqHz;
    this.sendCatFrequency(targetFreq);
    this.notify();
  }

  public copyVfoAtoB(): void {
    this.status.vfoBFreqHz = this.status.vfoAFreqHz;
    this.notify();
  }

  /**
   * Calculates actual Transmit Frequency considering Repeater Offset and Split VFO.
   */
  public getEffectiveTransmitFrequencyHz(): number {
    const rxFreq =
      this.status.activeVfo === 'VFO_A' ? this.status.vfoAFreqHz : this.status.vfoBFreqHz;

    switch (this.status.repeaterOffsetMode) {
      case 'PLUS_OFFSET':
        return rxFreq + this.status.repeaterOffsetHz;
      case 'MINUS_OFFSET':
        return rxFreq - this.status.repeaterOffsetHz;
      case 'SPLIT':
        return this.status.activeVfo === 'VFO_A'
          ? this.status.vfoBFreqHz
          : this.status.vfoAFreqHz;
      case 'SIMPLEX':
      default:
        return rxFreq;
    }
  }

  /**
   * Controls PTT State (Transmit On / Off) with Hardware Watchdog and TOT Timer.
   */
  public async setTransmit(active: boolean, reason?: string): Promise<boolean> {
    if (active) {
      const txFreq = this.getEffectiveTransmitFrequencyHz();
      this.status.txActive = true;
      this.status.totRemainingSec = this.status.totConfiguredSec;
      this.status.statusMessage = `TRANSMITTING on ${(txFreq / 1e6).toFixed(4)} MHz (${this.status.repeaterOffsetMode})`;

      // Start hardware Time-Out Timer countdown
      if (this.totIntervalId) clearInterval(this.totIntervalId);
      this.totIntervalId = window.setInterval(() => {
        if (this.status.totRemainingSec > 0) {
          this.status.totRemainingSec--;
          if (this.status.totRemainingSec === 0) {
            console.error('[RigController] Hardware Time-Out Timer (TOT) expired! Panicking unkey.');
            this.setTransmit(false, 'TOT Expired (Panic Unkey)');
          } else {
            this.notify();
          }
        }
      }, 1000);

      // Assert Hardware PTT
      await this.assertHardwarePtt(true);
    } else {
      this.status.txActive = false;
      this.status.totRemainingSec = this.status.totConfiguredSec;
      if (this.totIntervalId) {
        clearInterval(this.totIntervalId);
        this.totIntervalId = null;
      }
      this.status.statusMessage = reason ? `RX (${reason})` : 'RX Idle Standby';
      await this.assertHardwarePtt(false);
    }

    this.notify();
    return true;
  }

  /**
   * Asserts/De-asserts hardware lines (Serial RTS/DTR, CM108 GPIO, or CAT Command)
   */
  private async assertHardwarePtt(active: boolean): Promise<void> {
    // 1. WebSerial Control Lines (Digirig, SignaLink)
    if (this.serialPort) {
      try {
        if (this.status.pttMechanism === 'SERIAL_RTS') {
          await this.serialPort.setSignals({ requestToSend: active });
        } else if (this.status.pttMechanism === 'SERIAL_DTR') {
          await this.serialPort.setSignals({ dataTerminalReady: active });
        }
      } catch (err) {
        console.error('[RigController] Failed to set serial RTS/DTR:', err);
      }
    }

    // 2. CM108 / CM119 USB Audio HID GPIO3 (Bit 2)
    if (this.hidDevice) {
      try {
        // C-Media HID report format: [0x00, Bitmask, Value]
        // Bit 2 (0x04) controls GPIO3
        const reportData = new Uint8Array([0x00, 0x04, active ? 0x04 : 0x00, 0x00]);
        await this.hidDevice.sendFeatureReport(0x00, reportData);
      } catch (err) {
        console.error('[RigController] Failed to set CM108 HID GPIO:', err);
      }
    }

    // 3. CAT Command PTT
    if (this.status.pttMechanism === 'CAT_COMMAND') {
      this.sendCatPtt(active);
    }
  }

  /**
   * Connect via WebSerial API (Windows COM Port or Android USB Serial CDC/FTDI/CP210x/CH340)
   */
  public async connectSerial(baudRate: number = 38400): Promise<boolean> {
    if (!('serial' in navigator)) {
      this.status.statusMessage = 'WebSerial API not supported in this browser.';
      this.notify();
      return false;
    }

    try {
      this.status.statusMessage = 'Requesting Serial Port pairing...';
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });

      this.serialPort = port;
      this.status.connected = true;
      this.status.portLabel = `COM (Serial @ ${baudRate} baud)`;
      this.status.statusMessage = `Connected to serial CAT on ${this.status.portLabel}`;

      this.startSerialReadLoop();
      this.startRigPollingLoop();
      this.notify();
      return true;
    } catch (err: any) {
      this.status.statusMessage = `Serial connection error: ${err.message || err}`;
      this.status.connected = false;
      this.notify();
      return false;
    }
  }

  /**
   * Connect via WebHID API for CM108 / CM119 USB Audio GPIO PTT (Digirig / AllStar)
   */
  public async connectCm108Hid(): Promise<boolean> {
    if (!('hid' in navigator)) {
      this.status.statusMessage = 'WebHID API not supported in this browser.';
      this.notify();
      return false;
    }

    try {
      this.status.statusMessage = 'Requesting CM108 USB Audio HID device...';
      const devices = await (navigator as any).hid.requestDevice({
        filters: [
          { vendorId: 0x0d8c, productId: 0x000c }, // CM108
          { vendorId: 0x0d8c, productId: 0x013c }, // CM108B
          { vendorId: 0x0d8c, productId: 0x0012 }, // CM119
        ],
      });

      if (!devices || devices.length === 0) throw new Error('No CM108 HID selected');
      const dev = devices[0];
      await dev.open();
      this.hidDevice = dev;
      this.status.pttMechanism = 'CM108_GPIO';
      this.status.statusMessage = `Connected to CM108 HID GPIO PTT (${dev.productName})`;
      this.notify();
      return true;
    } catch (err: any) {
      this.status.statusMessage = `CM108 HID connection error: ${err.message || err}`;
      this.notify();
      return false;
    }
  }

  /**
   * Connect to Hamlib rigctld TCP server (default 127.0.0.1:4532 via WebSocket bridge)
   */
  public connectHamlibRigctld(host: string = '127.0.0.1', port: number = 4532): Promise<boolean> {
    return new Promise((resolve) => {
      this.status.statusMessage = `Connecting to Hamlib rigctld at ${host}:${port}...`;
      const isSecure = window.location.protocol === 'https:';
      const wsUrl = `${isSecure ? 'wss:' : 'ws:'}//${window.location.host}/ws-rigctld?target=${host}:${port}`;

      try {
        const ws = new WebSocket(wsUrl);
        this.wsRigctld = ws;

        const timeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            this.status.statusMessage = `rigctld connection timed out at ${host}:${port}`;
            this.notify();
            resolve(false);
          }
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.status.connected = true;
          this.status.protocol = 'HAMLIB_RIGCTLD';
          this.status.portLabel = `rigctld (${host}:${port})`;
          this.status.statusMessage = `Connected to Hamlib rigctld on ${host}:${port}`;
          this.startRigPollingLoop();
          this.notify();
          resolve(true);
        };

        ws.onmessage = (event) => {
          this.parseHamlibResponse(event.data);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          this.status.statusMessage = `Failed to connect to Hamlib rigctld at ${host}:${port}`;
          this.notify();
          resolve(false);
        };

        ws.onclose = () => {
          this.status.connected = false;
          this.status.statusMessage = 'rigctld server disconnected.';
          this.notify();
        };
      } catch (err: any) {
        this.status.statusMessage = `rigctld error: ${err.message}`;
        this.notify();
        resolve(false);
      }
    });
  }

  /**
   * Serial CAT Command Dispatcher
   */
  private async sendRawBytes(bytes: Uint8Array): Promise<void> {
    if (this.serialPort && this.serialPort.writable) {
      if (!this.serialWriter) {
        this.serialWriter = this.serialPort.writable.getWriter();
      }
      try {
        await this.serialWriter.write(bytes);
      } catch (err) {
        console.error('[RigController] Serial write error:', err);
      }
    }
  }

  private sendCatFrequency(freqHz: number): void {
    if (this.status.protocol === 'KENWOOD') {
      // Kenwood FA command: 11-digit Hz e.g. "FA00027185000;"
      const padded = String(freqHz).padStart(11, '0');
      const cmd = `FA${padded};`;
      this.sendRawBytes(new TextEncoder().encode(cmd));
    } else if (this.status.protocol === 'YAESU') {
      // Modern Yaesu FA command: 9-digit Hz e.g. "FA027185000;"
      const padded = String(freqHz).padStart(9, '0');
      const cmd = `FA${padded};`;
      this.sendRawBytes(new TextEncoder().encode(cmd));
    } else if (this.status.protocol === 'ICOM_CIV') {
      // Icom CI-V Set Frequency: 0xFE 0xFE <To> 0xE0 0x05 <5 bytes BCD> 0xFD
      const bcd = encodeIcomBcdFrequency(freqHz);
      const frame = new Uint8Array([0xfe, 0xfe, this.icomCivAddress, 0xe0, 0x05, ...bcd, 0xfd]);
      this.sendRawBytes(frame);
    } else if (this.status.protocol === 'HAMLIB_RIGCTLD' && this.wsRigctld?.readyState === WebSocket.OPEN) {
      this.wsRigctld.send(`F ${freqHz}\n`);
    }
  }

  private sendCatMode(mode: ModulationModeExtended): void {
    if (this.status.protocol === 'KENWOOD' || this.status.protocol === 'YAESU') {
      // 1=LSB, 2=USB, 3=CW, 4=FM, 5=AM
      let mCode = '5';
      if (mode === 'LSB') mCode = '1';
      else if (mode === 'USB') mCode = '2';
      else if (mode === 'CW') mCode = '3';
      else if (mode === 'NFM' || mode === 'WFM') mCode = '4';
      else if (mode === 'AM') mCode = '5';
      this.sendRawBytes(new TextEncoder().encode(`MD${mCode};`));
    } else if (this.status.protocol === 'ICOM_CIV') {
      // 00=LSB, 01=USB, 02=AM, 03=CW, 05=FM
      let mByte = 0x02;
      if (mode === 'LSB') mByte = 0x00;
      else if (mode === 'USB') mByte = 0x01;
      else if (mode === 'CW') mByte = 0x03;
      else if (mode === 'NFM') mByte = 0x05;
      const frame = new Uint8Array([0xfe, 0xfe, this.icomCivAddress, 0xe0, 0x06, mByte, 0x01, 0xfd]);
      this.sendRawBytes(frame);
    } else if (this.status.protocol === 'HAMLIB_RIGCTLD' && this.wsRigctld?.readyState === WebSocket.OPEN) {
      const hMode = mode === 'NFM' ? 'FM' : mode;
      this.wsRigctld.send(`M ${hMode} 3000\n`);
    }
  }

  private sendCatPtt(active: boolean): void {
    if (this.status.protocol === 'KENWOOD' || this.status.protocol === 'YAESU') {
      const cmd = active ? 'TX;' : 'RX;';
      this.sendRawBytes(new TextEncoder().encode(cmd));
    } else if (this.status.protocol === 'ICOM_CIV') {
      const frame = new Uint8Array([
        0xfe, 0xfe, this.icomCivAddress, 0xe0, 0x1c, 0x00, active ? 0x01 : 0x00, 0xfd,
      ]);
      this.sendRawBytes(frame);
    } else if (this.status.protocol === 'HAMLIB_RIGCTLD' && this.wsRigctld?.readyState === WebSocket.OPEN) {
      this.wsRigctld.send(`T ${active ? 1 : 0}\n`);
    }
  }

  /**
   * Periodic Rig Telemetry Poller (Queries VFO, Mode, S-meter at 5 Hz)
   */
  private startRigPollingLoop(): void {
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    this.pollIntervalId = window.setInterval(() => {
      if (!this.status.connected || this.status.txActive) return;

      if (this.status.protocol === 'KENWOOD' || this.status.protocol === 'YAESU') {
        this.sendRawBytes(new TextEncoder().encode('FA;MD;SM;\n'));
      } else if (this.status.protocol === 'ICOM_CIV') {
        // Query Freq (0x03), Mode (0x04), S-Meter (0x15 0x02)
        const qFreq = new Uint8Array([0xfe, 0xfe, this.icomCivAddress, 0xe0, 0x03, 0xfd]);
        this.sendRawBytes(qFreq);
      } else if (this.status.protocol === 'HAMLIB_RIGCTLD' && this.wsRigctld?.readyState === WebSocket.OPEN) {
        this.wsRigctld.send('f\nm\nl STRENGTH\n');
      }
    }, 250);
  }

  private parseHamlibResponse(data: string): void {
    const lines = data.trim().split('\n');
    for (const line of lines) {
      const num = parseInt(line, 10);
      if (!isNaN(num) && num > 100_000 && num < 2_000_000_000) {
        this.status.vfoAFreqHz = num;
      } else if (['AM', 'FM', 'USB', 'LSB', 'CW'].includes(line)) {
        this.status.mode = line === 'FM' ? 'NFM' : (line as ModulationModeExtended);
      }
    }
    this.notify();
  }

  private async startSerialReadLoop(): Promise<void> {
    while (this.serialPort && this.serialPort.readable) {
      try {
        this.serialReader = this.serialPort.readable.getReader();
        let buffer = '';
        while (true) {
          const { value, done } = await this.serialReader.read();
          if (done) break;
          if (value) {
            if (this.status.protocol === 'ICOM_CIV') {
              for (let i = 0; i < value.length - 6; i++) {
                if (value[i] === 0xfe && value[i + 1] === 0xfe) {
                  const cmd = value[i + 4];
                  if (cmd === 0x00 || cmd === 0x03) {
                    const freqHz = decodeIcomBcdFrequency(value, i + 5);
                    if (freqHz > 100_000 && freqHz < 2_000_000_000) {
                      this.status.vfoAFreqHz = freqHz;
                      this.notify();
                    }
                  }
                }
              }
            } else {
              buffer += new TextDecoder().decode(value);
              // Parse semicolons for Kenwood/Yaesu
              let semiIdx: number;
              while ((semiIdx = buffer.indexOf(';')) >= 0) {
                const cmd = buffer.slice(0, semiIdx);
                buffer = buffer.slice(semiIdx + 1);
                this.parseCatCommand(cmd);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[RigController] Serial read error or disconnect:', err);
        break;
      }
    }
  }

  private parseCatCommand(cmd: string): void {
    if (cmd.startsWith('FA')) {
      const hz = parseInt(cmd.slice(2), 10);
      if (!isNaN(hz) && hz > 0) {
        this.status.vfoAFreqHz = hz;
        this.notify();
      }
    } else if (cmd.startsWith('MD')) {
      const m = cmd.slice(2, 3);
      if (m === '1') this.status.mode = 'LSB';
      else if (m === '2') this.status.mode = 'USB';
      else if (m === '3') this.status.mode = 'CW';
      else if (m === '4') this.status.mode = 'NFM';
      else if (m === '5') this.status.mode = 'AM';
      this.notify();
    }
  }

  public disconnect(): void {
    if (this.status.txActive) {
      this.setTransmit(false, 'Disconnect');
    }
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    if (this.serialReader) {
      try { this.serialReader.releaseLock(); } catch {}
      this.serialReader = null;
    }
    if (this.serialWriter) {
      try { this.serialWriter.releaseLock(); } catch {}
      this.serialWriter = null;
    }
    if (this.serialPort) {
      try { this.serialPort.close(); } catch {}
      this.serialPort = null;
    }
    if (this.hidDevice) {
      try { this.hidDevice.close(); } catch {}
      this.hidDevice = null;
    }
    if (this.wsRigctld) {
      try { this.wsRigctld.close(); } catch {}
      this.wsRigctld = null;
    }
    this.status.connected = false;
    this.status.portLabel = 'Disconnected';
    this.status.statusMessage = 'Hardware disconnected.';
    this.notify();
  }
}
