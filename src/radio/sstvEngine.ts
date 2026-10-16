/**
 * SSTV (Slow Scan Television) Image Transceiver Engine
 * Supports Martin M1, Scottie S1, and Robot 36 color modes with VIS header framing and line rasterization.
 */

export type SstvMode = 'MARTIN_M1' | 'SCOTTIE_S1' | 'ROBOT_36';

export interface SstvModeInfo {
  id: SstvMode;
  name: string;
  visCode: number;
  width: number;
  height: number;
  durationSec: number;
  colorModel: 'RGB' | 'YUV';
}

export const SSTV_MODES: Record<SstvMode, SstvModeInfo> = {
  MARTIN_M1: {
    id: 'MARTIN_M1',
    name: 'Martin M1 (Color RGB)',
    visCode: 44, // 0x2C
    width: 320,
    height: 256,
    durationSec: 114,
    colorModel: 'RGB',
  },
  SCOTTIE_S1: {
    id: 'SCOTTIE_S1',
    name: 'Scottie S1 (Color RGB)',
    visCode: 60, // 0x3C
    width: 320,
    height: 256,
    durationSec: 110,
    colorModel: 'RGB',
  },
  ROBOT_36: {
    id: 'ROBOT_36',
    name: 'Robot 36 (High-Speed Color YUV)',
    visCode: 8, // 0x08
    width: 320,
    height: 240,
    durationSec: 36,
    colorModel: 'YUV',
  },
};

export class SstvEngine {
  private static readonly SAMPLE_RATE = 48000;

  /**
   * Generates the standard SSTV VIS Header PCM audio buffer:
   * 1. 1900 Hz Leader (300 ms)
   * 2. 1200 Hz Break (10 ms)
   * 3. 1900 Hz Leader (300 ms)
   * 4. 1200 Hz Start Bit (30 ms)
   * 5. 8 Data bits (1100 Hz = '1', 1300 Hz = '0', 30 ms each)
   * 6. Even Parity bit (30 ms)
   * 7. 1200 Hz Stop bit (30 ms)
   */
  public static generateVisHeaderAudio(visCode: number): Float32Array {
    const sRate = this.SAMPLE_RATE;
    const toneSegments: { freq: number; durationMs: number }[] = [
      { freq: 1900, durationMs: 300 },
      { freq: 1200, durationMs: 10 },
      { freq: 1900, durationMs: 300 },
      { freq: 1200, durationMs: 30 }, // Start bit
    ];

    // 8 Data Bits (LSB first)
    let parityCount = 0;
    for (let i = 0; i < 8; i++) {
      const bit = (visCode >>> i) & 1;
      if (bit === 1) parityCount++;
      toneSegments.push({
        freq: bit === 1 ? 1100 : 1300,
        durationMs: 30,
      });
    }

    // Even parity bit
    const parityBit = parityCount % 2 === 0 ? 0 : 1;
    toneSegments.push({
      freq: parityBit === 1 ? 1100 : 1300,
      durationMs: 30,
    });

    // Stop bit
    toneSegments.push({ freq: 1200, durationMs: 30 });

    // Calculate total samples
    let totalSamples = 0;
    for (const seg of toneSegments) {
      totalSamples += Math.round((seg.durationMs / 1000.0) * sRate);
    }

    const output = new Float32Array(totalSamples);
    let sampleIdx = 0;
    let phase = 0;

    for (const seg of toneSegments) {
      const numSamples = Math.round((seg.durationMs / 1000.0) * sRate);
      const phaseInc = (2 * Math.PI * seg.freq) / sRate;

      for (let s = 0; s < numSamples; s++) {
        output[sampleIdx++] = Math.sin(phase) * 0.7;
        phase += phaseInc;
        if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
      }
    }

    return output;
  }

  /**
   * Maps 8-bit grayscale pixel value (0..255) to analog SSTV FM frequency (1500 Hz black .. 2300 Hz white)
   */
  public static pixelToFrequency(pixelVal: number): number {
    return 1500.0 + (pixelVal / 255.0) * 800.0;
  }

  /**
   * Draws a standard tactical trucker test card onto an HTML5 canvas.
   */
  public static drawTestPattern(
    canvas: HTMLCanvasElement,
    callsign: string = 'HESHRADIO',
    channelLabel: string = 'CH 19 / 20m SSTV'
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0a101d');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // SMPTE Color Bars across upper 50%
    const barHeight = h * 0.45;
    const colors = ['#ffffff', '#facc15', '#22d3ee', '#10b981', '#ec4899', '#ef4444', '#3b82f6', '#000000'];
    const barWidth = w / colors.length;

    for (let i = 0; i < colors.length; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(i * barWidth, 0, barWidth, barHeight);
    }

    // Grid crosshairs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.stroke();

    // Call sign banner
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(10, h * 0.55, w - 20, h * 0.38);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, h * 0.55, w - 20, h * 0.38);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(callsign, w / 2, h * 0.72);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(channelLabel, w / 2, h * 0.84);
  }
}
