/**
 * RF & Audio Laboratory Signal Generator & Self-Test Calibration Suite
 *
 * Implements:
 * 1. Two-Tone SSB IMD linearity generator (700 Hz + 1900 Hz).
 * 2. NOAA 1050 Hz Warning Tone synthesizer.
 * 3. NOAA SAME AFSK 520.83 baud header packet synthesizer.
 * 4. Calibrated S9 (-73 dBm / -93 dBm) reference test tone.
 * 5. EIA/TIA CTCSS sub-audible tone injector (67.0 - 254.1 Hz).
 * 6. Authentic 115 ms band-limited pink noise squelch tail burst.
 */

export type LabSignalType =
  | 'TWO_TONE_SSB_IMD'
  | 'NOAA_1050HZ_ALERT'
  | 'NOAA_SAME_AFSK_HEADER'
  | 'S9_CALIBRATION_TONE'
  | 'CTCSS_SUB_AUDIBLE'
  | 'PINK_NOISE_SQUELCH_TAIL';

export class LaboratorySignalGenerator {
  private sampleRate: number;

  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Generates a Two-Tone SSB IMD test signal (700 Hz + 1900 Hz).
   * Standard amateur & commercial test method for checking transmitter linearity.
   */
  public generateTwoToneImd(durationSeconds = 2.0, amplitude = 0.85): Float32Array {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const buffer = new Float32Array(numSamples);
    const f1 = 700.0;
    const f2 = 1900.0;
    const halfAmp = amplitude * 0.5;

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      buffer[i] = halfAmp * (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t));
    }
    return buffer;
  }

  /**
   * Generates a calibrated 1050 Hz NOAA Weather Radio Alert Tone burst.
   */
  public generateNoaa1050HzAlert(durationSeconds = 3.0, amplitude = 0.90): Float32Array {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const buffer = new Float32Array(numSamples);
    const f = 1050.0;

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      // Soft 20ms envelope ramp at start and end
      let env = 1.0;
      const rampSamples = Math.floor(this.sampleRate * 0.02);
      if (i < rampSamples) env = i / rampSamples;
      if (i > numSamples - rampSamples) env = (numSamples - i) / rampSamples;

      buffer[i] = amplitude * env * Math.sin(2 * Math.PI * f * t);
    }
    return buffer;
  }

  /**
   * Generates a calibrated 1 kHz S9 reference test tone.
   */
  public generateS9ReferenceTone(durationSeconds = 2.0, amplitude = 0.70): Float32Array {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const buffer = new Float32Array(numSamples);
    const f = 1000.0;

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      buffer[i] = amplitude * Math.sin(2 * Math.PI * f * t);
    }
    return buffer;
  }

  /**
   * Generates an EIA/TIA CTCSS sub-audible tone (67.0 Hz to 254.1 Hz).
   */
  public generateCtcssTone(toneHz = 141.3, durationSeconds = 2.0, amplitude = 0.15): Float32Array {
    const numSamples = Math.floor(this.sampleRate * durationSeconds);
    const buffer = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      buffer[i] = amplitude * Math.sin(2 * Math.PI * toneHz * t);
    }
    return buffer;
  }

  /**
   * Generates an authentic 115 ms band-limited pink noise squelch tail with 10 ms cosine fade.
   */
  public generateSquelchTail(durationMs = 115, amplitude = 0.50): Float32Array {
    const numSamples = Math.floor((this.sampleRate * durationMs) / 1000);
    const buffer = new Float32Array(numSamples);
    const fadeSamples = Math.floor((this.sampleRate * 10) / 1000);

    // Filtered pink noise approximation (Voss-McCartney simplified)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < numSamples; i++) {
      const white = (Math.random() * 2.0 - 1.0);
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      let pink = (b0 + b1 + b2 + white * 0.5362) * 0.18;

      // Soft cosine decay at tail end
      if (i > numSamples - fadeSamples) {
        const progress = (numSamples - i) / fadeSamples;
        pink *= 0.5 * (1 - Math.cos(Math.PI * progress));
      }
      buffer[i] = amplitude * pink;
    }
    return buffer;
  }

  /**
   * Synthesizes a valid NOAA SAME AFSK audio burst:
   * 520.83 baud (Mark: 2083.33 Hz, Space: 1562.5 Hz).
   * Preamble bytes (0xAB x 16) + ASCII Header string.
   */
  public generateSameAfskBurst(
    headerString = 'ZCZC-WXR-TOR-053033+0045-2882115-KZZ99/NWS-',
    amplitude = 0.85
  ): Float32Array {
    const baudRate = 520.833;
    const samplesPerBit = Math.round(this.sampleRate / baudRate);
    const markFreq = 2083.33;
    const spaceFreq = 1562.5;

    // Build raw byte stream: 16 preamble bytes (0xAB) + header ASCII
    const bytes: number[] = [];
    for (let i = 0; i < 16; i++) {
      bytes.push(0xab);
    }
    for (let i = 0; i < headerString.length; i++) {
      bytes.push(headerString.charCodeAt(i));
    }

    // Convert bytes to bits (LSB first per SAME specification)
    const bits: number[] = [];
    for (const byte of bytes) {
      for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
        bits.push((byte >> bitIndex) & 1);
      }
    }

    const totalSamples = bits.length * samplesPerBit;
    const buffer = new Float32Array(totalSamples);

    let phase = 0;
    let sampleIdx = 0;

    for (const bit of bits) {
      // In SAME: Mark (1) is 2083.33 Hz, Space (0) is 1562.5 Hz
      const freq = bit === 1 ? markFreq : spaceFreq;
      const phaseInc = (2 * Math.PI * freq) / this.sampleRate;

      for (let s = 0; s < samplesPerBit; s++) {
        buffer[sampleIdx++] = amplitude * Math.sin(phase);
        phase = (phase + phaseInc) % (2 * Math.PI);
      }
    }

    return buffer;
  }
}
