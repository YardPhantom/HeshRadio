/**
 * Standard EIA/TIA 50-Tone CTCSS (Continuous Tone-Coded Squelch System / PL Private Line)
 * Frequency Table (67.0 Hz to 254.1 Hz).
 */
export const CTCSS_TONES_HZ: readonly number[] = [
  67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5,
  94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
  131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9,
  171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8, 196.6, 199.5,
  203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1,
];

export interface CtcssDetectionResult {
  detectedToneHz: number | null;
  detectedToneConfidence: number; // 0.0 to 1.0
  tonePowers: Float32Array;       // 50 tone powers
  squelchMatches: boolean;        // True if detected tone matches expected CTCSS squelch tone
}

/**
 * High-Performance Zero-Allocation Goertzel CTCSS Tone Filter & Decoder.
 * Downsamples sub-300 Hz audio to 1000 Hz and processes 500-sample blocks (0.5s window)
 * yielding 2.0 Hz spectral bin resolution to accurately discriminate 67.0 vs 69.3 Hz.
 */
export class GoertzelCtcssDecoder {
  public static readonly SAMPLE_RATE_HZ = 1000;
  public static readonly BLOCK_SIZE = 500;

  private readonly coeffs: Float32Array;
  private readonly s1: Float32Array;
  private readonly s2: Float32Array;
  public readonly powers: Float32Array;

  private blockSampleCount = 0;
  private lastDetectedTone: number | null = null;
  private lastConfidence = 0;

  constructor() {
    const numTones = CTCSS_TONES_HZ.length;
    this.coeffs = new Float32Array(numTones);
    this.s1 = new Float32Array(numTones);
    this.s2 = new Float32Array(numTones);
    this.powers = new Float32Array(numTones);

    // Precompute 2 * cos(2 * pi * f_tone / f_s) coefficients
    for (let i = 0; i < numTones; i++) {
      const omega0 = (2 * Math.PI * CTCSS_TONES_HZ[i]) / GoertzelCtcssDecoder.SAMPLE_RATE_HZ;
      this.coeffs[i] = 2 * Math.cos(omega0);
    }
  }

  /**
   * Resets Goertzel state registers.
   */
  public reset(): void {
    this.s1.fill(0);
    this.s2.fill(0);
    this.powers.fill(0);
    this.blockSampleCount = 0;
    this.lastDetectedTone = null;
    this.lastConfidence = 0;
  }

  /**
   * Processes a slice of sub-audible audio samples (normalized -1.0 .. +1.0).
   * Typically fed from a 300 Hz low-pass decimation filter.
   */
  public processSamples(
    samples: Float32Array,
    expectedToneHz: number | null = null
  ): CtcssDetectionResult {
    const numTones = CTCSS_TONES_HZ.length;
    const len = samples.length;

    for (let n = 0; n < len; n++) {
      const x = samples[n];
      for (let t = 0; t < numTones; t++) {
        const s0 = x + this.coeffs[t] * this.s1[t] - this.s2[t];
        this.s2[t] = this.s1[t];
        this.s1[t] = s0;
      }
      this.blockSampleCount++;

      // Once full block is reached, compute powers and evaluate peak
      if (this.blockSampleCount >= GoertzelCtcssDecoder.BLOCK_SIZE) {
        let maxPower = 0;
        let maxIdx = -1;
        let sumPower = 0;

        for (let t = 0; t < numTones; t++) {
          const p =
            this.s1[t] * this.s1[t] +
            this.s2[t] * this.s2[t] -
            this.coeffs[t] * this.s1[t] * this.s2[t];
          this.powers[t] = p;
          sumPower += p;
          if (p > maxPower) {
            maxPower = p;
            maxIdx = t;
          }
          // Reset state variables for next block
          this.s1[t] = 0;
          this.s2[t] = 0;
        }

        const avgPower = sumPower / numTones;
        const snrRatio = avgPower > 1e-6 ? maxPower / avgPower : 0;

        // If dominant tone is > 10 dB above tone floor, declare valid CTCSS tone
        if (maxIdx >= 0 && snrRatio > 8.0 && maxPower > 12.0) {
          this.lastDetectedTone = CTCSS_TONES_HZ[maxIdx];
          this.lastConfidence = Math.min(1.0, snrRatio / 30.0);
        } else {
          this.lastDetectedTone = null;
          this.lastConfidence = 0;
        }

        this.blockSampleCount = 0;
      }
    }

    const squelchMatches =
      expectedToneHz === null ||
      (this.lastDetectedTone !== null &&
        Math.abs(this.lastDetectedTone - expectedToneHz) < 1.2);

    return {
      detectedToneHz: this.lastDetectedTone,
      detectedToneConfidence: this.lastConfidence,
      tonePowers: this.powers,
      squelchMatches,
    };
  }
}

/**
 * Real-time Sub-Audible CTCSS Tone Encoder / Synthesizer.
 * Generates continuous phase-continuous sine waves at the selected PL tone
 * for injection into the transmit audio pipeline.
 */
export class CtcssToneEncoder {
  private phase = 0;

  /**
   * Generates continuous CTCSS tone samples at the given sample rate and level.
   * Standard CTCSS injection depth is 15% of peak FM deviation (0.15 amplitude).
   */
  public generateToneBlock(
    output: Float32Array,
    toneHz: number,
    sampleRate: number,
    amplitude: number = 0.15
  ): void {
    const phaseInc = (2 * Math.PI * toneHz) / sampleRate;
    const len = output.length;
    for (let i = 0; i < len; i++) {
      output[i] = Math.sin(this.phase) * amplitude;
      this.phase += phaseInc;
      if (this.phase >= 2 * Math.PI) {
        this.phase -= 2 * Math.PI;
      }
    }
  }

  public reset(): void {
    this.phase = 0;
  }
}
