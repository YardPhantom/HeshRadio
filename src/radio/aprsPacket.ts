/**
 * APRS (Automatic Packet Reporting System) & AX.25 / Bell 202 AFSK Protocol Engine
 * Standard-compliant packet generation, parsing, AFSK audio synthesis, and APRS-IS passcode calculation.
 */

export interface AprsPacket {
  id: string;
  sourceCall: string;
  destCall: string;
  digipeaters: string[];
  payloadType: 'POSITION' | 'MESSAGE' | 'WEATHER' | 'STATUS' | 'TELEMETRY';
  latitude?: number;
  longitude?: number;
  symbolTable?: string;
  symbolCode?: string;
  comment?: string;
  messageRecipient?: string;
  messageText?: string;
  rawAx25Text: string;
  timestampUtc: string;
}

/**
 * Standard 16-bit APRS-IS Passcode Generation Algorithm.
 * Authenticates callsign on rotate.aprs2.net:14580.
 */
export function generateAprsPasscode(callsign: string): number {
  const baseCall = callsign.split('-')[0].trim().toUpperCase();
  let hashVal = 0x73e2;
  const len = baseCall.length;

  for (let i = 0; i < len; i += 2) {
    hashVal ^= baseCall.charCodeAt(i) << 8;
    if (i + 1 < len) {
      hashVal ^= baseCall.charCodeAt(i + 1);
    }
  }
  return hashVal & 0x7fff;
}

/**
 * Converts decimal degrees to standard APRS latitude string: DDMM.hhN/S
 */
export function formatAprsLatitude(lat: number): string {
  const hemi = lat >= 0 ? 'N' : 'S';
  const absLat = Math.abs(lat);
  const deg = Math.floor(absLat);
  const min = (absLat - deg) * 60.0;
  return `${String(deg).padStart(2, '0')}${min.toFixed(2).padStart(5, '0')}${hemi}`;
}

/**
 * Converts decimal degrees to standard APRS longitude string: DDDMM.hhE/W
 */
export function formatAprsLongitude(lon: number): string {
  const hemi = lon >= 0 ? 'E' : 'W';
  const absLon = Math.abs(lon);
  const deg = Math.floor(absLon);
  const min = (absLon - deg) * 60.0;
  return `${String(deg).padStart(3, '0')}${min.toFixed(2).padStart(5, '0')}${hemi}`;
}

/**
 * CRC-16-CCITT calculation for AX.25 framing (Reflected polynomial 0x8408).
 */
export function calculateAx25Crc(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = (crc >>> 1) ^ 0x8408;
      } else {
        crc >>>= 1;
      }
    }
  }
  return crc ^ 0xffff;
}

/**
 * Real-Time Bell 202 AFSK Modulator (1200 baud, 1200 Hz Mark, 2200 Hz Space).
 * Generates continuous-phase audio PCM for physical VHF / 2m APRS (144.390 MHz).
 */
export class Bell202AfskModulator {
  private static readonly SAMPLE_RATE = 48000;
  private static readonly BAUD_RATE = 1200;
  private static readonly MARK_FREQ = 1200;
  private static readonly SPACE_FREQ = 2200;

  /**
   * Generates continuous-phase AFSK audio samples from raw bit array.
   */
  public static modulateBits(bits: number[]): Float32Array {
    const samplesPerBit = Math.round(this.SAMPLE_RATE / this.BAUD_RATE); // 40 samples/bit
    const totalSamples = bits.length * samplesPerBit;
    const output = new Float32Array(totalSamples);
    let phase = 0;

    let sampleIdx = 0;
    for (const bit of bits) {
      const freq = bit === 1 ? this.MARK_FREQ : this.SPACE_FREQ;
      const phaseInc = (2 * Math.PI * freq) / this.SAMPLE_RATE;

      for (let s = 0; s < samplesPerBit; s++) {
        output[sampleIdx++] = Math.sin(phase) * 0.75;
        phase += phaseInc;
        if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
      }
    }
    return output;
  }

  /**
   * Encodes text message into complete AX.25 NRZI bitstream with bit-stuffing and HDLC flags.
   */
  public static encodeAx25Packet(
    sourceCall: string,
    destCall: string,
    payload: string,
    digipeaters: string[] = ['WIDE1-1', 'WIDE2-1']
  ): Float32Array {
    const rawBits: number[] = [];

    // Pre-amble: 32 HDLC Flag bytes (0x7E = 01111110)
    for (let f = 0; f < 30; f++) {
      const flagBits = [0, 1, 1, 1, 1, 1, 1, 0];
      rawBits.push(...flagBits);
    }

    // Encode Payload into AX.25 UI Frame bytes
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payload);

    // Call sign address bytes (Shifted left by 1)
    const encodeCall = (c: string, isLast: boolean) => {
      const parts = c.split('-');
      const call = parts[0].padEnd(6, ' ').toUpperCase();
      const ssid = parseInt(parts[1], 10) || 0;
      const out = new Uint8Array(7);
      for (let i = 0; i < 6; i++) out[i] = call.charCodeAt(i) << 1;
      out[6] = 0x60 | ((ssid & 0x0f) << 1) | (isLast ? 0x01 : 0x00);
      return out;
    };

    const destBytes = encodeCall(destCall || 'APRS', false);
    const srcBytes = encodeCall(sourceCall, digipeaters.length === 0);
    const digiBytes = digipeaters.map((d, idx) =>
      encodeCall(d, idx === digipeaters.length - 1)
    );

    // Assemble frame: Dest | Src | Digis | Control (0x03 UI) | PID (0xF0 No layer 3) | Payload
    let totalLen = destBytes.length + srcBytes.length + 2 + payloadBytes.length;
    for (const d of digiBytes) totalLen += d.length;

    const frameBytes = new Uint8Array(totalLen);
    let offset = 0;
    frameBytes.set(destBytes, offset); offset += destBytes.length;
    frameBytes.set(srcBytes, offset); offset += srcBytes.length;
    for (const d of digiBytes) {
      frameBytes.set(d, offset); offset += d.length;
    }
    frameBytes[offset++] = 0x03; // UI Frame
    frameBytes[offset++] = 0xf0; // No Layer 3 protocol
    frameBytes.set(payloadBytes, offset);

    // Compute CRC-16
    const crc = calculateAx25Crc(frameBytes);
    const crcBytes = new Uint8Array([crc & 0xff, (crc >>> 8) & 0xff]);

    // Bit-Stuffing & NRZI Encoding:
    // Insert '0' after five consecutive '1's (except in flags)
    const unmodulatedBits: number[] = [];
    const pushByte = (b: number) => {
      for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
        const bit = (b >>> bitIdx) & 1;
        unmodulatedBits.push(bit);
      }
    };

    for (const b of frameBytes) pushByte(b);
    for (const b of crcBytes) pushByte(b);

    // Apply Bit-Stuffing
    const stuffedBits: number[] = [];
    let consecutiveOnes = 0;
    for (const bit of unmodulatedBits) {
      stuffedBits.push(bit);
      if (bit === 1) {
        consecutiveOnes++;
        if (consecutiveOnes === 5) {
          stuffedBits.push(0); // Insert stuffed 0
          consecutiveOnes = 0;
        }
      } else {
        consecutiveOnes = 0;
      }
    }

    // Apply NRZI: Invert state on '0', keep state on '1'
    let currentNrzi = 1;
    for (const bit of stuffedBits) {
      if (bit === 0) {
        currentNrzi = currentNrzi === 1 ? 0 : 1;
      }
      rawBits.push(currentNrzi);
    }

    // Post-amble: 10 HDLC flags
    for (let f = 0; f < 10; f++) {
      rawBits.push(...[0, 1, 1, 1, 1, 1, 1, 0]);
    }

    return this.modulateBits(rawBits);
  }
}
