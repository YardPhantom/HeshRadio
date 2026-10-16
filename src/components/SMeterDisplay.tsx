import React from 'react';
import { SMeterReading } from '../radio/dspEngine';
import { ModulationMode } from '../radio/cbChannels';

interface SMeterDisplayProps {
  reading: SMeterReading;
  pttActive: boolean;
  squelchOpen: boolean;
  mode: ModulationMode;
}

export const SMeterDisplay: React.FC<SMeterDisplayProps> = ({
  reading,
  pttActive,
  squelchOpen,
  mode,
}) => {
  const segments = 24;
  const activeSegments = pttActive
    ? Math.round((Math.max(40, reading.modulationPct) / 100) * segments)
    : Math.round(reading.needleNormalized * segments);

  const txWatts =
    mode === 'LSB' || mode === 'USB'
      ? (12.0 * (0.35 + 0.65 * (reading.modulationPct / 100))).toFixed(1)
      : '4.0';

  return (
    <div className="smeter-housing" aria-label="Calibrated IARU S-Meter and RF Power/Modulation Meter">
      <div className="smeter-top-row">
        <div className="smeter-scale-labels">
          <span>S1</span>
          <span>3</span>
          <span>5</span>
          <span>7</span>
          <span className="s9-mark">S9</span>
          <span className="over-s9">+20</span>
          <span className="over-s9">+40</span>
          <span className="over-s9">+60dB</span>
        </div>
        <div className="smeter-digital-readout">
          {pttActive ? (
            <span className="tx-readout">
              TX {txWatts}W • MOD {reading.modulationPct}% • SWR {reading.swrRatio.toFixed(2)}:1
            </span>
          ) : (
            <span className="rx-readout">
              {reading.formatted} ({reading.powerDbm.toFixed(1)} dBm)
            </span>
          )}
        </div>
      </div>

      {/* Segmented Tactical LED Bar Graph */}
      <div className="smeter-led-bar">
        {Array.from({ length: segments }).map((_, idx) => {
          const isLit = idx < activeSegments;
          const isOverS9 = idx >= 15; // S9 threshold at segment 15
          let colorClass = 'seg-off';
          if (isLit) {
            if (pttActive) {
              colorClass = idx >= 20 ? 'seg-red' : 'seg-amber';
            } else if (isOverS9) {
              colorClass = 'seg-red';
            } else if (idx >= 10) {
              colorClass = 'seg-amber';
            } else {
              colorClass = squelchOpen ? 'seg-emerald' : 'seg-cyan';
            }
          }
          return <div key={idx} className={`smeter-seg ${colorClass}`} />;
        })}
      </div>

      <div className="smeter-bottom-scale">
        <span>RF PWR: 0W</span>
        <span>1W</span>
        <span>2W</span>
        <span>4W AM (FCC PT.95)</span>
        <span>12W PEP SSB</span>
        <span>MOD 100%</span>
      </div>
    </div>
  );
};
