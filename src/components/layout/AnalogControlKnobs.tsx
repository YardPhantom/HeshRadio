import React from 'react';

export interface AnalogControlKnobsProps {
  masterVolume: number;
  onMasterVolumeChange: (val: number) => void;
  squelchDbm: number;
  onSquelchDbmChange: (val: number) => void;
  rfGainPct: number;
  onRfGainPctChange: (val: number) => void;
  dynamikePct: number;
  onDynamikePctChange: (val: number) => void;
}

export const AnalogControlKnobs: React.FC<AnalogControlKnobsProps> = ({
  masterVolume,
  onMasterVolumeChange,
  squelchDbm,
  onSquelchDbmChange,
  rfGainPct,
  onRfGainPctChange,
  dynamikePct,
  onDynamikePctChange,
}) => {
  return (
    <section className="panel knobs-panel" aria-label="Front-Panel Analog Audio and RF Controls">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="status-led led-cyan" />
          <h2 className="panel-title">FRONT-PANEL ANALOG &amp; DSP CONTROLS</h2>
        </div>
        <span className="badge-mono">4-CHANNEL ANALOG POTENTIOMETERS</span>
      </div>

      <div className="knobs-grid">
        {/* Knob 1: AF Volume */}
        <div className="knob-card">
          <div className="knob-header">
            <label htmlFor="vol-range">AF VOLUME</label>
            <span className="knob-val">{Math.round(masterVolume * 100)}%</span>
          </div>
          <input
            id="vol-range"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            className="tactical-slider"
          />
          <span className="knob-sub">Master Receiver Audio</span>
        </div>

        {/* Knob 2: Squelch Threshold */}
        <div className="knob-card">
          <div className="knob-header">
            <label htmlFor="sql-range">SQUELCH (3dB HYST)</label>
            <span className="knob-val">{squelchDbm} dBm</span>
          </div>
          <input
            id="sql-range"
            type="range"
            min={-125}
            max={-55}
            step={1}
            value={squelchDbm}
            onChange={(e) => onSquelchDbmChange(parseInt(e.target.value, 10))}
            className="tactical-slider"
          />
          <span className="knob-sub">
            {squelchDbm <= -114 ? 'OPEN (HEAR RF STATIC)' : 'GATED CARRIER THRESHOLD'}
          </span>
        </div>

        {/* Knob 3: RF Gain */}
        <div className="knob-card">
          <div className="knob-header">
            <label htmlFor="rfg-range">RF GAIN</label>
            <span className="knob-val">{rfGainPct}%</span>
          </div>
          <input
            id="rfg-range"
            type="range"
            min={20}
            max={100}
            step={2}
            value={rfGainPct}
            onChange={(e) => onRfGainPctChange(parseInt(e.target.value, 10))}
            className="tactical-slider"
          />
          <span className="knob-sub">Front-End LNA Attenuator</span>
        </div>

        {/* Knob 4: Dynamike Speech Compressor */}
        <div className="knob-card">
          <div className="knob-header">
            <label htmlFor="dyn-range">DYNAMIKE (4:1 COMP)</label>
            <span className="knob-val">{dynamikePct}%</span>
          </div>
          <input
            id="dyn-range"
            type="range"
            min={20}
            max={100}
            step={5}
            value={dynamikePct}
            onChange={(e) => onDynamikePctChange(parseInt(e.target.value, 10))}
            className="tactical-slider"
          />
          <span className="knob-sub">Speech Compressor &amp; Limiter</span>
        </div>
      </div>
    </section>
  );
};
