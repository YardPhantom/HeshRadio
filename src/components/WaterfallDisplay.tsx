import React, { useEffect, useRef, useState } from 'react';
import { BandPlan } from '../radio/bandPlans';
import { CB_CHANNELS, ModulationMode } from '../radio/cbChannels';
import { ModulationModeExtended } from '../radio/bandPlans';

export type WaterfallPalette = 'PHOSPHOR' | 'KIWISDR' | 'INFERNO' | 'MATRIX_CYAN';

interface WaterfallDisplayProps {
  spectrumDb: Float32Array;
  peakHoldDb: Float32Array;
  currentChannel?: number;
  frequencyMhz?: number;
  spanMhz?: number;
  band?: BandPlan;
  mode: ModulationModeExtended | ModulationMode;
  pttActive: boolean;
  squelchThresholdDbm: number;
  onSelectChannel?: (ch: number) => void;
  onFrequencyClick?: (freqMhz: number) => void;
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

    lut[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  return lut;
}

export const WaterfallDisplay: React.FC<WaterfallDisplayProps> = ({
  spectrumDb,
  peakHoldDb,
  currentChannel = 19,
  frequencyMhz,
  spanMhz,
  band,
  mode,
  pttActive,
  squelchThresholdDbm,
  onSelectChannel,
  onFrequencyClick,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [palette, setPalette] = useState<WaterfallPalette>('KIWISDR');
  const [showPeakHold, setShowPeakHold] = useState<boolean>(true);

  const lutRef = useRef<Uint32Array>(buildPaletteLut('KIWISDR'));
  const imageDataRef = useRef<ImageData | null>(null);
  const u32PixelsRef = useRef<Uint32Array | null>(null);

  // Determine center frequency and span
  const centerFreqMhz =
    frequencyMhz ??
    (currentChannel ? (CB_CHANNELS[currentChannel - 1] || CB_CHANNELS[18]).frequencyMhz : 27.185);
  const totalSpanMhz = spanMhz ?? (band ? band.frequencyMaxMhz - band.frequencyMinMhz : 0.470);
  const effectiveSpanMhz = Math.max(0.05, totalSpanMhz);
  const spanStartMhz = centerFreqMhz - effectiveSpanMhz / 2;

  useEffect(() => {
    lutRef.current = buildPaletteLut(palette);
  }, [palette]);

  useEffect(() => {
    let animId = 0;
    const width = 512;
    const specHeight = 145;
    const wfHeight = 175;

    const renderLoop = () => {
      const specCanvas = spectrumCanvasRef.current;
      const wfCanvas = waterfallCanvasRef.current;

      if (specCanvas && wfCanvas) {
        const sCtx = specCanvas.getContext('2d');
        const wCtx = wfCanvas.getContext('2d');

        if (sCtx && wCtx) {
          if (!imageDataRef.current || !u32PixelsRef.current) {
            imageDataRef.current = wCtx.createImageData(width, wfHeight);
            u32PixelsRef.current = new Uint32Array(imageDataRef.current.data.buffer);
            u32PixelsRef.current.fill(0xff100804);
          }

          const u32 = u32PixelsRef.current;
          const lut = lutRef.current;

          // Shift rows down by 1 row
          u32.copyWithin(width, 0, width * (wfHeight - 1));

          // Write newest FFT scanline into row 0
          for (let x = 0; x < width; x++) {
            const db = spectrumDb[x];
            const norm = Math.max(0, Math.min(255, Math.floor(((db - -122) / 85) * 255)));
            u32[x] = lut[norm];
          }
          wCtx.putImageData(imageDataRef.current, 0, 0);

          // Spectrum background
          sCtx.fillStyle = '#060a0f';
          sCtx.fillRect(0, 0, width, specHeight);

          // Graticule dBm lines
          const isVhf = centerFreqMhz > 30.0;
          const s9Value = isVhf ? -93 : -73;
          sCtx.lineWidth = 1;
          const dbLines = [
            { db: s9Value + 20, label: 'S9+20' },
            { db: s9Value, label: `S9 (${s9Value}dBm)` },
            { db: s9Value - 24, label: 'S5' },
            { db: s9Value - 42, label: 'NOISE' },
          ];

          for (const line of dbLines) {
            const y = specHeight - ((line.db - -125) / 90) * specHeight;
            if (y >= 0 && y <= specHeight) {
              sCtx.strokeStyle =
                line.db === s9Value ? 'rgba(245, 158, 11, 0.28)' : 'rgba(148, 163, 184, 0.11)';
              sCtx.beginPath();
              sCtx.moveTo(0, y);
              sCtx.lineTo(width, y);
              sCtx.stroke();

              sCtx.fillStyle = line.db === s9Value ? '#f59e0b' : '#64748b';
              sCtx.font = '600 9px "JetBrains Mono", monospace';
              sCtx.fillText(line.label, 6, Math.max(10, y - 3));
            }
          }

          // Squelch threshold dashed line
          const sqY = specHeight - ((squelchThresholdDbm - -125) / 90) * specHeight;
          sCtx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
          sCtx.setLineDash([4, 4]);
          sCtx.beginPath();
          sCtx.moveTo(0, sqY);
          sCtx.lineTo(width, sqY);
          sCtx.stroke();
          sCtx.setLineDash([]);

          // Landmarks / Presets Markers
          const landmarks =
            band?.presets?.slice(0, 8) ||
            [
              { name: 'CH1', frequencyMhz: 26.965 },
              { name: 'CH6', frequencyMhz: 27.025 },
              { name: 'CH9', frequencyMhz: 27.065 },
              { name: 'CH19', frequencyMhz: 27.185 },
              { name: 'CH23', frequencyMhz: 27.255 },
              { name: 'CH38', frequencyMhz: 27.385 },
            ];

          for (const lm of landmarks) {
            const lx = ((lm.frequencyMhz - spanStartMhz) / effectiveSpanMhz) * width;
            if (lx >= 0 && lx <= width) {
              const isCurrent = Math.abs(lm.frequencyMhz - centerFreqMhz) < 0.003;
              sCtx.strokeStyle = isCurrent
                ? 'rgba(16, 185, 129, 0.6)'
                : 'rgba(148, 163, 184, 0.13)';
              sCtx.beginPath();
              sCtx.moveTo(lx, 0);
              sCtx.lineTo(lx, specHeight);
              sCtx.stroke();

              sCtx.fillStyle = isCurrent ? '#10b981' : '#64748b';
              sCtx.font = '600 9px "JetBrains Mono", monospace';
              sCtx.fillText(lm.name, Math.max(4, lx - 14), 11);
            }
          }

          // Active Tuned Channel Passband Filter Curtain
          const centerX = ((centerFreqMhz - spanStartMhz) / effectiveSpanMhz) * width;
          let bwPixels = 8;
          if (mode === 'CW') bwPixels = 2;
          else if (mode === 'LSB' || mode === 'USB') bwPixels = 5;
          else if (mode === 'AM') bwPixels = 8;
          else if (mode === 'NFM' || mode === 'WX') bwPixels = 12;
          else if (mode === 'WFM') bwPixels = 36;

          sCtx.fillStyle = pttActive ? 'rgba(239, 68, 68, 0.22)' : 'rgba(16, 185, 129, 0.18)';
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
              const py = specHeight - ((peakHoldDb[x] - -125) / 90) * specHeight;
              if (x === 0) sCtx.moveTo(x, py);
              else sCtx.lineTo(x, py);
            }
            sCtx.stroke();
          }

          // Spectrum trace + gradient
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
            const y = specHeight - ((spectrumDb[x] - -125) / 90) * specHeight;
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
            const y = specHeight - ((spectrumDb[x] - -125) / 90) * specHeight;
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
  }, [
    spectrumDb,
    peakHoldDb,
    centerFreqMhz,
    effectiveSpanMhz,
    spanStartMhz,
    band,
    mode,
    pttActive,
    squelchThresholdDbm,
    showPeakHold,
  ]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const clickedFreqMhz = spanStartMhz + normX * effectiveSpanMhz;

    if (onFrequencyClick) {
      onFrequencyClick(parseFloat(clickedFreqMhz.toFixed(4)));
    } else if (onSelectChannel) {
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
    }
  };

  return (
    <section className="panel waterfall-panel" aria-label="RF Spectrum and Waterfall Analyzer">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="status-led led-cyan" />
          <h2 className="panel-title">
            {band?.name || 'WIDEBAND RF SPECTRUM'} // {(spanStartMhz).toFixed(3)} – {(spanStartMhz + effectiveSpanMhz).toFixed(3)} MHz
          </h2>
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

      <div className="waterfall-canvas-stack" title="Click anywhere on spectrum or waterfall to QSY (tune) frequency">
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
        <span>CLICK SPECTRUM OR WATERFALL TO TUNE</span>
        <span>
          PASSBAND: {mode === 'CW' ? '250 Hz CW' : mode === 'USB' || mode === 'LSB' ? '2.7 kHz SSB' : mode === 'WFM' ? '150 kHz WFM' : mode === 'AM' ? '6.0 kHz AM' : '12.5 kHz NFM'}
        </span>
        <span>IARU S9 = {centerFreqMhz > 30.0 ? '-93.0 dBm (VHF/UHF)' : '-73.0 dBm (HF)'}</span>
      </div>
    </section>
  );
};
