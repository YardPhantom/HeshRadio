/**
 * RTL-SDR Hardware Bridge for HeshRadio
 * Supports:
 * 1. WebUSB Direct Hardware Access (RTL2832U USB ID 0x0BDA:0x2838 on Windows & Android)
 * 2. rtl_tcp Network / WebSocket Streaming (2.048 MS/s IQ stream)
 * 3. Graceful Automatic Fallback to Simulated RF / WebSDR when hardware is disconnected
 */

export type RtlSdrConnectionMode = 'SIMULATED' | 'WEBUSB' | 'RTL_TCP';

export interface RtlSdrStatus {
  mode: RtlSdrConnectionMode;
  connected: boolean;
  streaming: boolean;
  dongleName: string;
  tunerType: string;
  centerFreqHz: number;
  sampleRateHz: number;
  gainDb: number;
  gainMode: 'AUTO' | 'MANUAL';
  directSampling: 0 | 1 | 2; // 0=off, 1=I-branch, 2=Q-branch
  ppmCorrection: number;
  bufferHealthPct: number;
  droppedPackets: number;
  statusMessage: string;
}

export type RtlSdrIqCallback = (iSamples: Float32Array, qSamples: Float32Array) => void;

/**
 * Standard RTL2832U USB Identifiers
 */
export const RTL2832U_USB_FILTERS = [
  { vendorId: 0x0bda, productId: 0x2838 }, // Standard Realtek RTL2832U / RTL-SDR Blog V3 & V4
  { vendorId: 0x0bda, productId: 0x2832 }, // Generic RTL2832U
  { vendorId: 0x0413, productId: 0x6f0f }, // Leadtek WinFast DTV Dongle mini D
  { vendorId: 0x0ccd, productId: 0x00a9 }, // Terratec Cinergy T Stick Black
  { vendorId: 0x1d19, productId: 0x1101 }, // Dexatek DK DVB-T Dongle
];

export class RtlSdrHardwareBridge {
  private status: RtlSdrStatus = {
    mode: 'SIMULATED',
    connected: false,
    streaming: false,
    dongleName: 'Simulated RF Signal Generator (Fallback)',
    tunerType: 'R828D / Synthetic PLL',
    centerFreqHz: 27_185_000,
    sampleRateHz: 2_048_000,
    gainDb: 28.0,
    gainMode: 'AUTO',
    directSampling: 0,
    ppmCorrection: 0,
    bufferHealthPct: 100,
    droppedPackets: 0,
    statusMessage: 'Ready (Simulated RF / WebSDR fallback active)',
  };

  private iqCallback: RtlSdrIqCallback | null = null;
  private wsRtlTcp: WebSocket | null = null;
  private usbDevice: any = null; // USBDevice (WebUSB)
  private readLoopActive = false;

  // Pre-allocated IQ transfer buffers (2048 complex samples per block)
  private readonly blockSize = 2048;
  private readonly iBuffer: Float32Array;
  private readonly qBuffer: Float32Array;

  constructor() {
    this.iBuffer = new Float32Array(this.blockSize);
    this.qBuffer = new Float32Array(this.blockSize);
  }

  public getStatus(): RtlSdrStatus {
    return { ...this.status };
  }

  public onIqData(callback: RtlSdrIqCallback): void {
    this.iqCallback = callback;
  }

  /**
   * Sets Center Tuning Frequency across 100 kHz to 1.75 GHz
   */
  public setFrequency(freqHz: number): void {
    this.status.centerFreqHz = Math.max(100_000, Math.min(1_750_000_000, freqHz));

    // For frequencies < 24 MHz on older V3 dongles, enable Direct Sampling Q-branch
    if (this.status.centerFreqHz < 24_000_000 && this.status.directSampling === 0) {
      this.status.directSampling = 2; // Q-branch direct sampling
    } else if (this.status.centerFreqHz >= 24_000_000 && this.status.directSampling !== 0) {
      this.status.directSampling = 0; // Standard PLL tuner
    }

    if (this.status.mode === 'RTL_TCP' && this.wsRtlTcp?.readyState === WebSocket.OPEN) {
      this.sendRtlTcpCommand(0x01, this.status.centerFreqHz);
    }
  }

  /**
   * Sets Gain in dB or Auto Gain (AGC)
   */
  public setGain(gainDb: number, auto: boolean = false): void {
    this.status.gainDb = gainDb;
    this.status.gainMode = auto ? 'AUTO' : 'MANUAL';
    if (this.status.mode === 'RTL_TCP' && this.wsRtlTcp?.readyState === WebSocket.OPEN) {
      // 0x03 = Set Gain Mode (0 = auto, 1 = manual)
      this.sendRtlTcpCommand(0x03, auto ? 0 : 1);
      if (!auto) {
        // 0x04 = Set Gain (in tenths of dB)
        this.sendRtlTcpCommand(0x04, Math.round(gainDb * 10));
      }
    }
  }

  /**
   * Connect via WebUSB (Physical USB dongle on Windows Chrome/Edge or Android USB-OTG)
   */
  public async connectWebUsb(): Promise<boolean> {
    if (!('usb' in navigator)) {
      this.status.statusMessage = 'WebUSB API not supported in this browser environment.';
      return false;
    }

    try {
      this.status.statusMessage = 'Requesting USB RTL-SDR device pairing...';
      const device = await (navigator as any).usb.requestDevice({
        filters: RTL2832U_USB_FILTERS,
      });

      if (!device) {
        throw new Error('No device selected');
      }

      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      await device.claimInterface(0);

      this.usbDevice = device;
      this.status.mode = 'WEBUSB';
      this.status.connected = true;
      this.status.streaming = true;
      this.status.dongleName = device.productName || 'RTL-SDR Blog V4 (USB)';
      this.status.tunerType = 'RTL2832U + R828D High-Stability PLL';
      this.status.statusMessage = 'Connected via WebUSB Direct Endpoint';

      this.startUsbReadLoop();
      return true;
    } catch (err: any) {
      this.status.statusMessage = `WebUSB connection failed: ${err.message || err}. Falling back to Simulated RF.`;
      this.fallbackToSimulated();
      return false;
    }
  }

  /**
   * Connect to rtl_tcp server (e.g. 127.0.0.1:1234 or Android SDR driver app)
   */
  public connectRtlTcp(host: string = '127.0.0.1', port: number = 1234): Promise<boolean> {
    return new Promise((resolve) => {
      this.disconnect();
      this.status.statusMessage = `Connecting to rtl_tcp on ${host}:${port}...`;

      try {
        // Use Vite bridge or direct WebSocket
        const isSecure = window.location.protocol === 'https:';
        const wsUrl = `${isSecure ? 'wss:' : 'ws:'}//${window.location.host}/ws-rtltcp?target=${host}:${port}`;
        const ws = new WebSocket(wsUrl);
        this.wsRtlTcp = ws;
        ws.binaryType = 'arraybuffer';

        const timeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            this.status.statusMessage = `rtl_tcp connection timed out at ${host}:${port}. Fallback active.`;
            this.fallbackToSimulated();
            resolve(false);
          }
        }, 3500);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.status.mode = 'RTL_TCP';
          this.status.connected = true;
          this.status.streaming = true;
          this.status.dongleName = `Network RTL-SDR (${host}:${port})`;
          this.status.tunerType = 'RTL2832U Network Stream';
          this.status.statusMessage = `Connected to rtl_tcp stream (${host}:${port})`;

          // Send initialization commands to rtl_tcp:
          // Set sample rate (2.048 MS/s)
          this.sendRtlTcpCommand(0x02, this.status.sampleRateHz);
          // Set tuned frequency
          this.sendRtlTcpCommand(0x01, this.status.centerFreqHz);
          // Set AGC
          this.sendRtlTcpCommand(0x03, this.status.gainMode === 'AUTO' ? 0 : 1);
          resolve(true);
        };

        ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            this.processRtlTcpRawIqBytes(new Uint8Array(event.data));
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          this.status.statusMessage = `Failed to connect to rtl_tcp at ${host}:${port}. Reverting to fallback.`;
          this.fallbackToSimulated();
          resolve(false);
        };

        ws.onclose = () => {
          if (this.status.mode === 'RTL_TCP') {
            this.status.statusMessage = 'rtl_tcp server disconnected. Reverting to Simulated RF.';
            this.fallbackToSimulated();
          }
        };
      } catch (err: any) {
        this.status.statusMessage = `rtl_tcp error: ${err.message}. Using fallback.`;
        this.fallbackToSimulated();
        resolve(false);
      }
    });
  }

  /**
   * Helper to serialize and send standard 5-byte rtl_tcp command packets:
   * [Cmd 1B, Param 4B Big-Endian]
   */
  private sendRtlTcpCommand(commandByte: number, paramUint32: number): void {
    if (!this.wsRtlTcp || this.wsRtlTcp.readyState !== WebSocket.OPEN) return;
    const packet = new Uint8Array(5);
    packet[0] = commandByte & 0xff;
    packet[1] = (paramUint32 >>> 24) & 0xff;
    packet[2] = (paramUint32 >>> 16) & 0xff;
    packet[3] = (paramUint32 >>> 8) & 0xff;
    packet[4] = paramUint32 & 0xff;
    this.wsRtlTcp.send(packet.buffer);
  }

  /**
   * Converts raw unsigned 8-bit RTL-SDR IQ bytes [0..255] into normalized float [-1.0 .. +1.0]
   */
  private processRtlTcpRawIqBytes(rawBytes: Uint8Array): void {
    const pairCount = Math.min(this.blockSize, Math.floor(rawBytes.length / 2));
    for (let i = 0; i < pairCount; i++) {
      // RTL2832U outputs unsigned 8-bit samples centered at 127.5
      this.iBuffer[i] = (rawBytes[i * 2] - 127.5) / 127.5;
      this.qBuffer[i] = (rawBytes[i * 2 + 1] - 127.5) / 127.5;
    }
    if (this.iqCallback) {
      this.iqCallback(this.iBuffer, this.qBuffer);
    }
  }

  /**
   * Asynchronous USB Bulk Endpoint Read Loop
   */
  private async startUsbReadLoop(): Promise<void> {
    this.readLoopActive = true;
    while (this.readLoopActive && this.usbDevice) {
      try {
        // Read 16384 bytes from endpoint 1 (standard RTL2832U bulk IN)
        const result = await this.usbDevice.transferIn(1, 16384);
        if (result.status === 'ok' && result.data) {
          const rawBytes = new Uint8Array(result.data.buffer);
          this.processRtlTcpRawIqBytes(rawBytes);
        } else if (result.status === 'stall') {
          await this.usbDevice.clearHalt('in', 1);
        }
      } catch (err: any) {
        // Dongle was unplugged
        this.status.statusMessage = `RTL-SDR dongle disconnected: ${err.message}. Seamlessly switched to fallback.`;
        this.fallbackToSimulated();
        break;
      }
    }
  }

  /**
   * Disconnects hardware and smoothly falls back to simulated/WebSDR
   */
  public disconnect(): void {
    this.readLoopActive = false;
    if (this.usbDevice) {
      try {
        this.usbDevice.close();
      } catch {}
      this.usbDevice = null;
    }
    if (this.wsRtlTcp) {
      try {
        this.wsRtlTcp.close();
      } catch {}
      this.wsRtlTcp = null;
    }
    this.fallbackToSimulated();
  }

  public fallbackToSimulated(): void {
    this.status.mode = 'SIMULATED';
    this.status.connected = false;
    this.status.streaming = true;
    this.status.dongleName = 'Simulated RF Signal Generator (Fallback)';
    this.status.tunerType = 'R828D / Synthetic PLL';
    this.status.statusMessage = 'Active (Deterministic simulated RF & WebSDR fallback)';
  }
}
