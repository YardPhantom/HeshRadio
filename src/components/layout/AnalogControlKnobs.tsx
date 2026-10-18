import React from 'react';
import { DeckHeader } from '../common/DeckHeader';
import { TacticalSlider } from '../common/TacticalSlider';

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
      <DeckHeader
        statusLed="cyan"
        title="FRONT-PANEL ANALOG & DSP CONTROLS"
        badgeText="4-CHANNEL ANALOG POTENTIOMETERS"
        badgeVariant="cyan"
      />

      <div className="knobs-grid">
        <TacticalSlider
          id="vol-range"
          label="AF VOLUME"
          valueReadout={`${Math.round(masterVolume * 100)}%`}
          min={0}
          max={1}
          step={0.02}
          value={masterVolume}
          onChange={onMasterVolumeChange}
          subLabel="Master Receiver Audio"
          accentColor="cyan"
        />

        <TacticalSlider
          id="sql-range"
          label="SQUELCH (3dB HYST)"
          valueReadout={`${squelchDbm} dBm`}
          min={-125}
          max={-55}
          step={1}
          value={squelchDbm}
          onChange={(val) => onSquelchDbmChange(Math.round(val))}
          subLabel={squelchDbm <= -114 ? 'OPEN (HEAR RF STATIC)' : 'GATED CARRIER THRESHOLD'}
          accentColor="amber"
        />

        <TacticalSlider
          id="rfg-range"
          label="RF GAIN"
          valueReadout={`${rfGainPct}%`}
          min={20}
          max={100}
          step={2}
          value={rfGainPct}
          onChange={(val) => onRfGainPctChange(Math.round(val))}
          subLabel="Front-End LNA Attenuator"
          accentColor="emerald"
        />

        <TacticalSlider
          id="dyn-range"
          label="DYNAMIKE (4:1 COMP)"
          valueReadout={`${dynamikePct}%`}
          min={20}
          max={100}
          step={5}
          value={dynamikePct}
          onChange={(val) => onDynamikePctChange(Math.round(val))}
          subLabel="Speech Compressor & Limiter"
          accentColor="cyan"
        />
      </div>
    </section>
  );
};
