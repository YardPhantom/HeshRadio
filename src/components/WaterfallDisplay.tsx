import React, { useEffect, useRef, useState } from 'react';
import { CB_CHANNELS, ModulationMode } from '../radio/cbChannels';

export type WaterfallPalette = 'PHOSPHOR' | 'KIWISDR' | 'INFERNO' | 'MATRIX_CYAN';

interface WaterfallDisplayProps {
  spectrumDb: Float32Array;
  peakHoldDb: Float32Array;
  currentChannel: number;
  mode: ModulationMode;
  pttActive: boolean;
  squelchThresholdDbm: number;
  onSelectChannel: (ch: number) => void;
}

/**
 * Precomputes a 256-entry packed 32-bit ABGR Color Look-Up Table (LUT)
 * for zero-allocation waterfall scanline rendering.
 */
function buildPaletteLut(palette: WaterfallPalette): Uint32Array {
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r = 0, g = 0, b = 0;

    if (palette === 'KIWISDR') {
      // Classic KiwiSDR / SDR# deep navy -> cyan -> green -> yellow -> red -> white
      if (t < 0.20) {
        const u = t / 0.20;
        r = Math.round(4 * u);
        g = Math.round(14 * u);
        b = Math.round(18 + 95 * u);
      } else if (t < 0.45) {
        const u = (t - 0.20) / 0.25;
        r = Math.round(4 + 12 * u);
        g = Math.round(14 + 195 * u);
        b = Math.round(113 + 120 * (1 - u));
      } else if (t < 0.70) {
        const u = (t - 0.45) / 0.25;
        r = Math.round(16 + 235 * u);
        g = Math.round(209 + 40 * u);
        b = Math.round(20 * (1 - u));
      } else if (t < 0.90) {
        const u = (t - 0.70) / 0.20;
        r = 255;
        g = Math.round(249 * (1 - u * 0.75));
        b = Math.round(35 * u);
      } else {
        const u = (t - 0.90) / 0.10;
        r = 255;
        g = Math.round(62 + 193 * u);
        b = Math.round(35 + 220 * u);
      }
    } else if (palette === 'PHOSPHOR') {
      // Tactical P1 CRT Phosphor Green + Amber Overdrive
      if (t < 0.75) {
        const u = t / 0.75;
        r = Math.round(8 + 38 * u * u);
        g = Math.round(12 + 235 * Math.pow(u, 1.15));
        b = Math.round(10 + 45 * u);
      } else {
        const u = (t - 0.75) / 0.25;
        r = Math.round(46 + 209 * u);
        g = 255;
        b = Math.round(55 + 160 * u);
      }
    } else if (palette === 'INFERNO') {
      // Thermal RF black -> purple -> crimson -> orange -> bright yellow
      if (t < 0.33) {
        const u = t / 0.33;
        r = Math.round(95 * u);
        g = Math.round(10 * u);
        b = Math.round(135 * u);
      } else if (t < 0.66) {
        const u = (t - 0.33) / 0.33;
        r = Math.round(95 + 150 * u);
        g = Math.round(10 + 95 * u);
        b = Math.round(135 * (1 - u));
      } else {
        const u = (t - 0.66) / 0.34;
        r = 255;
        g = Math.round(105 + 150 * u);
        b = Math.round(180 * u);
      }
    } else {
      // MATRIX_CYAN
      r = Math.round(220 * Math.pow(t, 3));
      g = Math.round(10 + 235 * Math.pow(t, 1.3));
      b = Math.round(22 + 233 * Math.pow(t, 0.85));
    }

    // Little-endian ABGR packing for Uint32Array -> ImageData
    lut[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  return lut;
}

export const WaterfallDisplay: React.FC<WaterfallDisplayProps> = ({
  spectrumDb,
  peakHoldDb,
  currentChannel,
  mode,
  pttActive,
  squelchThresholdDbm,
  onSelectChannel,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [palette, setPalette] = useState<WaterfallPalette>('KIWISDR');
  const [showPeakHold, setShowPeakHold] = useState<boolean>(true);

  const lutRef = useRef<Uint32Array>(buildPaletteLut('KIWISDR'));
  const imageDataRef = useRef<ImageData | null>(null);
  const u32PixelsRef = useRef<Uint32Array | null>(null);

  useEffect(() => {
    lutRef.current = buildPaletteLut(palette);
  }, [palette]);

  useEffect(() => {
    let animId = 0;
    const width = 512;
    const specHeight = 145;
    const wfHeight = 175;

    const spanStartMhz = 26.950;
    const spanWidthMhz = 0.470; // 26.950 - 27.420 MHz (full 11m CB 40-Ch + A-channels)

    const renderLoop = () => {
      const specCanvas = spectrumCanvasRef.current;
      const wfCanvas = waterfallCanvasRef.current;

      if (specCanvas && wfCanvas) {
        const sCtx = specCanvas.getContext('2d');
        const wCtx = wfCanvas.getContext('2d');

        if (sCtx && wCtx) {
          // Initialize zero-allocation ImageData & Uint32Array view once
          if (!imageDataRef.current || !u32PixelsRef.current) {
            imageDataRef.current = wCtx.createImageData(width, wfHeight);
            u32PixelsRef.current = new Uint32Array(imageDataRef.current.data.buffer);
            u32PixelsRef.current.fill(0xff100804);
          }

          const u32 = u32PixelsRef.current;
          const lut = lutRef.current;

          // 1. ZERO-ALLOCATION WATERFALL ROW SHIFT:
          // Shift rows [0 .. wfHeight-2] down by 1 row (width = 512 uint32s)
          u32.copyWithin(width, 0, width * (wfHeight - 1));

          // Write newest FFT scanline into row 0
          for (let x = 0; x < width; x++) {
            const db = spectrumDb[x];
            // Map [-120 dBm .. -35 dBm] -> [0 .. 255]
            const norm = Math.max(0, Math.min(255, Math.floor(((db - -120) / 85) * 255)));
            u32[x] = lut[norm];
          }
          wCtx.putImageData(imageDataRef.current, 0, 0);

          // 2. DRAW REAL-TIME SPECTRUM ANALYZER
          sCtx.fillStyle = '#060a0f';
          sCtx.fillRect(0, 0, width, specHeight);

          // Graticule dBm lines (-50, -73 S9, -90, -110 dBm)
          sCtx.lineWidth = 1;
          const dbLines = [
            { db: -53, label: 'S9+20' },
            { db: -73, label: 'S9 (-73dBm)' },
            { db: -97, label: 'S5' },
            { db: -115, label: 'NOISE' },
          ];

          for (const line of dbLines) {
            const y = specHeight - ((line.db - -122) / 90) * specHeight;
            sCtx.strokeStyle = line.db === -73 ? 'rgba(245, 158, 11, 0.28)' : 'rgba(148, 163, 184, 0.11)';
            sCtx.beginPath();
            sCtx.moveTo(0, y);
            sCtx.lineTo(width, y);
            sCtx.stroke();

            sCtx.fillStyle = line.db === -73 ? '#f59e0b' : '#64748b';
            sCtx.font = '600 9px "JetBrains Mono", monospace';
            sCtx.fillText(line.label, 6, Math.max(10, y - 3));
          }

          // Squelch threshold horizontal line
          const sqY = specHeight - ((squelchThresholdDbm - -122) / 90) * specHeight;
          sCtx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
          sCtx.setLineDash([4, 4]);
          sCtx.beginPath();
          sCtx.moveTo(0, sqY);
          sCtx.lineTo(width, sqY);
          sCtx.stroke();
          sCtx.setLineDash([]);

          // Key CB Channel vertical guide markers (Ch 1, Ch 6, Ch 9, Ch 19, Ch 23, Ch 38)
          const landmarks = [
            { ch: 1, freq: 26.965, tag: 'CH1' },
            { ch: 6, freq: 27.025, tag: 'CH6 SB' },
            { ch: 9, freq: 27.065, tag: 'CH9 EMG' },
            { ch: 19, freq: 27.185, tag: 'CH19 HWY' },
            { ch: 23, freq: 27.255, tag: 'CH23' },
            { ch: 38, freq: 27.385, tag: 'CH38 LSB' },
          ];

          for (const lm of landmarks) {
            const lx = ((lm.freq - spanStartMhz) / spanWidthMhz) * width;
            sCtx.strokeStyle =
              lm.ch === currentChannel ? 'rgba(16, 185, 129, 0.6)' : 'rgba(148, 163, 184, 0.13)';
            sCtx.beginPath();
            sCtx.moveTo(lx, 0);
            sCtx.lineTo(lx, specHeight);
            sCtx.stroke();

            sCtx.fillStyle = lm.ch === currentChannel ? '#10b981' : '#64748b';
            sCtx.font = '600 9px "JetBrains Mono", monospace';
            sCtx.fillText(lm.tag, lx - 14, 11);
          }

          // Active Tuned Channel Passband Filter Curtain
          const tunedInfo = CB_CHANNELS[currentChannel - 1] || CB_CHANNELS[18];
          const centerX = ((tunedInfo.frequencyMhz - spanStartMhz) / spanWidthMhz) * width;
          const bwPixels = mode === 'LSB' || mode === 'USB' ? 5 : 9;

          sCtx.fillStyle = pttActive
            ? 'rgba(239, 68, 68, 0.22)'
            : 'rgba(16, 185, 129, 0.18)';
          const curtainX =
            mode === 'LSB'
              ? centerX - bwPixels
              : mode === 'USB'
              ? centerX
              : centerX - bwPixels / 2;
          sCtx.fillRect(curtainX, 0, bwPixels, specHeight);

          // Center carrier line
          sCtx.strokeStyle = pttActive ? '#ef4444' : '#10b981';
          sCtx.lineWidth = 1.5;
          sCtx.beginPath();
          sCtx.moveTo(centerX, 0);
          sCtx.lineTo(centerX, specHeight);
          sCtx.stroke();

          // Peak Hold trace
          if (showPeakHold) {
            sCtx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
            sCtx.lineWidth = 1;
            sCtx.beginPath();
            for (let x = 0; x < width; x++) {
              const py = specHeight - ((peakHoldDb[x] - -122) / 90) * specHeight;
              if (x === 0) sCtx.moveTo(x, py);
              else sCtx.lineTo(x, py);
            }
            sCtx.stroke();
          }

          // Live FFT Spectrum Trace + Gradient Fill
          const grad = sCtx.createLinearGradient(0, 0, 0, specHeight);
          if (pttActive) {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
            grad.addColorStop(1, 'rgba(239, 68, 68, 0.03)');
          } else {
            grad.addColorStop(0, 'rgba(34, 211, 238, 0.52)');
            grad.addColorStop(0.6, 'rgba(16, 185, 129, 0.20)');
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
          }

          sCtx.beginPath();
          sCtx.moveTo(0, specHeight);
          for (let x = 0; x < width; x++) {
            const y = specHeight - ((spectrumDb[x] - -122) / 90) * specHeight;
            sCtx.lineTo(x, Math.max(2, Math.min(specHeight - 1, y)));
          }
          sCtx.lineTo(width, specHeight);
          sCtx.closePath();
          sCtx.fillStyle = grad;
          sCtx.fill();

          sCtx.strokeStyle = pttActive ? '#f87171' : '#22d3ee';
          sCtx.lineWidth = 1.5;
          sCtx.beginPath();
          for (let x = 0; x < width; x++) {
            const y = specHeight - ((spectrumDb[x] - -122) / 90) * specHeight;
            if (x === 0) sCtx.moveTo(x, Math.max(2, Math.min(specHeight - 1, y)));
            else sCtx.lineTo(x, Math.max(2, Math.min(specHeight - 1, y)));
          }
          sCtx.stroke();
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [spectrumDb, peakHoldDb, currentChannel, mode, pttActive, squelchThresholdDbm, showPeakHold]);

  /**
   * Click-to-Tune handler on Spectrum or Waterfall canvas:
   * Maps clicked X coordinate to the nearest FCC Part 95 CB channel (1-40).
   */
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const clickedFreqMhz = 26.950 + normX * 0.470;

    let closestCh = 19;
    let minDiff = Infinity;
    for (const ch of CB_CHANNELS) {
      const diff = Math.abs(ch.frequencyMhz - clickedFreqMhz);
      if (diff < minDiff) {
        minDiff = diff;
        closestCh = ch.channel;
      }
    }
    onSelectChannel(closestCh);
  };

  return (
    <section className="panel waterfall-panel" aria-label="11-Meter RF Spectrum and Waterfall Analyzer">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="status-led led-cyan" />
          <h2 className="panel-title">11M RF SPECTRUM &amp; WATERFALL // 26.950 – 27.420 MHz</h2>
          <span className="badge-mono">512-PT BLACKMAN-HARRIS FFT</span>
        </div>
        <div className="waterfall-controls">
          <button
            type="button"
            className={`chip-btn ${showPeakHold ? 'active' : ''}`}
            onClick={() => setShowPeakHold((v) => !v)}
          >
            PEAK HOLD
          </button>
          {(['KIWISDR', 'PHOSPHOR', 'INFERNO', 'MATRIX_CYAN'] as WaterfallPalette[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`chip-btn ${palette === p ? 'active' : ''}`}
              onClick={() => setPalette(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="waterfall-canvas-stack" title="Click anywhere on spectrum to QSY (tune) to nearest CB channel">
        <canvas
          ref={spectrumCanvasRef}
          width={512}
          height={145}
          className="rf-canvas spectrum-canvas"
          onClick={handleCanvasClick}
        />
        <canvas
          ref={waterfallCanvasRef}
          width={512}
          height={175}
          className="rf-canvas waterfall-canvas"
          onClick={handleCanvasClick}
        />
      </div>

      <div className="waterfall-footer">
        <span>CLICK SPECTRUM TO TUNE NEAREST CHANNEL</span>
        <span>PASSBAND: {mode === 'AM' ? '6.0 kHz AM' : mode === 'FM' ? '12.5 kHz NFM' : '2.7 kHz SSB'}</span>
        <span>IARU S9 = -73.0 dBm</span>
      </div>
    </section>
  );
};
