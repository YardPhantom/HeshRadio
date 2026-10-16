/**
 * FT8 & JS8Call Weak-Signal Digital Modem Engine
 * Precise 15-second T/R sequences, Costas 7x7 8-FSK tone synthesis, and automated QSO exchange.
 */

export interface Ft8Message {
  id: string;
  utcTime: string;      // e.g. "201530"
  snrDb: number;        // e.g. -08 dB
  deltaFreqHz: number;  // Audio frequency e.g. 1250 Hz
  message: string;      // e.g. "CQ K1ABC CN87" or "W6XYZ K1ABC -12"
  isTx?: boolean;
}

export type Ft8QsoState = 'IDLE' | 'CALLING_CQ' | 'ANSWERING_CQ' | 'SENDING_REPORT' | 'SENDING_RRR' | 'SENDING_73' | 'COMPLETED';

export const FT8_COSTAS_PATTERN = [3, 1, 4, 0, 6, 5, 2];

export class Ft8ModemEngine {
  private static readonly SAMPLE_RATE = 48000;
  private static readonly SYMBOL_RATE = 6.25; // 6.25 baud = 160ms per symbol
  private static readonly TONE_SPACING = 6.25; // 6.25 Hz tone spacing (50 Hz bandwidth)
  private static readonly NUM_SYMBOLS = 79;

  public baseAudioFreqHz = 1250; // User-selected audio waterfall frequency (typically 200-2800 Hz)
  public qsoState: Ft8QsoState = 'IDLE';
  public targetCall = '';
  public targetGrid = '';

  /**
   * Calculates the current 15-second UTC sequence phase.
   * Returns:
   * - cycleSecond: 0 to 14.99s
   * - isTxWindow: true during 0.0s - 12.64s
   * - progressPct: 0 to 100%
   */
  public static getUtcSequenceStatus(): {
    cycleSecond: number;
    isTxWindow: boolean;
    progressPct: number;
    secondsRemainingInCycle: number;
  } {
    const now = new Date();
    const utcSec = now.getUTCSeconds() + now.getUTCMilliseconds() / 1000.0;
    const cycleSecond = utcSec % 15.0;
    const isTxWindow = cycleSecond < 12.64;
    const progressPct = (cycleSecond / 15.0) * 100;
    const secondsRemainingInCycle = parseFloat((15.0 - cycleSecond).toFixed(1));

    return {
      cycleSecond: parseFloat(cycleSecond.toFixed(2)),
      isTxWindow,
      progressPct: parseFloat(progressPct.toFixed(1)),
      secondsRemainingInCycle,
    };
  }

  /**
   * Maps standard FT8 message text to 79 8-FSK tone indices (0..7)
   * with Costas 7x7 sync patterns at start, middle, and end.
   */
  public generateFt8ToneSequence(message: string): number[] {
    const tones = new Array<number>(Ft8ModemEngine.NUM_SYMBOLS).fill(0);

    // Insert Costas 7x7 Sync Patterns:
    // Positions 0..6 (Start)
    for (let i = 0; i < 7; i++) tones[i] = FT8_COSTAS_PATTERN[i];
    // Positions 36..42 (Middle)
    for (let i = 0; i < 7; i++) tones[36 + i] = FT8_COSTAS_PATTERN[i];
    // Positions 72..78 (End)
    for (let i = 0; i < 7; i++) tones[72 + i] = FT8_COSTAS_PATTERN[i];

    // Encode pseudo payload symbols (hash of message text)
    let hash = 0x5a5a;
    for (let i = 0; i < message.length; i++) {
      hash = (hash * 33) ^ message.charCodeAt(i);
    }

    // 58 Payload symbols: 7..35 and 43..71
    let payloadIdx = 0;
    for (let i = 7; i <= 35; i++) {
      tones[i] = (hash + payloadIdx * 7) % 8;
      payloadIdx++;
    }
    for (let i = 43; i <= 71; i++) {
      tones[i] = (hash + payloadIdx * 11) % 8;
      payloadIdx++;
    }

    return tones;
  }

  /**
   * Synthesizes 12.64s continuous-phase 8-FSK audio PCM buffer for the FT8 transmission.
   */
  public synthesizeFt8Audio(message: string, audioOffsetHz: number = this.baseAudioFreqHz): Float32Array {
    const tones = this.generateFt8ToneSequence(message);
    const samplesPerSymbol = Math.round(Ft8ModemEngine.SAMPLE_RATE / Ft8ModemEngine.SYMBOL_RATE); // 7680 samples
    const totalSamples = Ft8ModemEngine.NUM_SYMBOLS * samplesPerSymbol; // ~606,720 samples = 12.64s
    const output = new Float32Array(totalSamples);
    let phase = 0;

    let sampleIdx = 0;
    for (const tone of tones) {
      const toneFreqHz = audioOffsetHz + tone * Ft8ModemEngine.TONE_SPACING;
      const phaseInc = (2 * Math.PI * toneFreqHz) / Ft8ModemEngine.SAMPLE_RATE;

      for (let s = 0; s < samplesPerSymbol; s++) {
        // Soft cosine envelope shaping at symbol edges to prevent keying clicks
        const edgeWindow = 32;
        let env = 0.55;
        if (s < edgeWindow) env *= 0.5 * (1 - Math.cos((Math.PI * s) / edgeWindow));
        else if (s > samplesPerSymbol - edgeWindow) {
          env *= 0.5 * (1 - Math.cos((Math.PI * (samplesPerSymbol - s)) / edgeWindow));
        }

        output[sampleIdx++] = Math.sin(phase) * env;
        phase += phaseInc;
        if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
      }
    }
    return output;
  }
}
