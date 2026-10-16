import React, { useState } from 'react';
import {
  LaboratorySignalGenerator,
  LabSignalType,
} from '../radio/signalGenerator';
import {
  Wrench,
  Play,
} from 'lucide-react';

interface LaboratorySignalDeckProps {
  onPlayBuffer: (samples: Float32Array) => void;
}

export const LaboratorySignalDeck: React.FC<LaboratorySignalDeckProps> = ({
  onPlayBuffer,
}) => {
  const [signalGen] = useState(() => new LaboratorySignalGenerator(48000));
  const [activeSignal, setActiveSignal] = useState<LabSignalType | null>(null);

  // CTCSS test tone frequency selection
  const [ctcssFreqHz, setCtcssFreqHz] = useState<number>(141.3);

  const handlePlaySignal = (type: LabSignalType) => {
    setActiveSignal(type);
    let samples: Float32Array;

    switch (type) {
      case 'TWO_TONE_SSB_IMD':
        samples = signalGen.generateTwoToneImd(2.5, 0.85);
        break;
      case 'NOAA_1050HZ_ALERT':
        samples = signalGen.generateNoaa1050HzAlert(3.0, 0.90);
        break;
      case 'NOAA_SAME_AFSK_HEADER':
        samples = signalGen.generateSameAfskBurst('ZCZC-WXR-TOR-053033+0045-2882115-KZZ99/NWS-', 0.85);
        break;
      case 'S9_CALIBRATION_TONE':
        samples = signalGen.generateS9ReferenceTone(2.0, 0.70);
        break;
      case 'CTCSS_SUB_AUDIBLE':
        samples = signalGen.generateCtcssTone(ctcssFreqHz, 2.5, 0.20);
        break;
      case 'PINK_NOISE_SQUELCH_TAIL':
        samples = signalGen.generateSquelchTail(115, 0.60);
        break;
    }

    onPlayBuffer(samples);
    const durationMs = (samples.length / 48000) * 1000;
    setTimeout(() => {
      setActiveSignal(null);
    }, durationMs + 100);
  };

  return (
    <div className="bg-[#0b1017] border border-zinc-800 rounded-xl p-4 font-mono space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-zinc-100">
            RF &amp; AUDIO LABORATORY CALIBRATION SUITE
          </h2>
        </div>
        <span className="text-xs text-zinc-500">
          DETERMINISTIC TEST GENERATORS &bull; IARU &amp; FCC PART 95 ALIGNMENT
        </span>
      </div>

      {/* Signal Generator Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Signal 1: Two-Tone SSB IMD */}
        <div className="bg-black/40 border border-zinc-800 rounded-lg p-3 space-y-2 flex flex-col justify-between">
          <div>
            <div className="text-amber-400 font-bold text-xs flex items-center justify-between">
              <span>TWO-TONE SSB IMD SIGNAL</span>
              <span className="text-[10px] text-zinc-500">700 Hz + 1900 Hz</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Dual equal-amplitude non-harmonic tones for measuring transmitter speech compressor
              linearity, harmonic distortion, and intermodulation products without clipping.
            </p>
          </div>
          <button
            onClick={() => handlePlaySignal('TWO_TONE_SSB_IMD')}
            disabled={activeSignal !== null}
            className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeSignal === 'TWO_TONE_SSB_IMD'
                ? 'bg-amber-400 text-black animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {activeSignal === 'TWO_TONE_SSB_IMD' ? 'GENERATING...' : 'TEST TWO-TONE IMD'}
          </button>
        </div>

        {/* Signal 2: S9 IARU Calibration Tone */}
        <div className="bg-black/40 border border-zinc-800 rounded-lg p-3 space-y-2 flex flex-col justify-between">
          <div>
            <div className="text-emerald-400 font-bold text-xs flex items-center justify-between">
              <span>S9 IARU CALIBRATION TONE</span>
              <span className="text-[10px] text-zinc-500">1000 Hz (-73 dBm)</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Standard IARU HF reference tone (50 &mu;V into 50&Omega; = -73 dBm) for verifying S9
              meter calibration, AGC response, and analog audio chain alignment.
            </p>
          </div>
          <button
            onClick={() => handlePlaySignal('S9_CALIBRATION_TONE')}
            disabled={activeSignal !== null}
            className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeSignal === 'S9_CALIBRATION_TONE'
                ? 'bg-emerald-400 text-black animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {activeSignal === 'S9_CALIBRATION_TONE' ? 'GENERATING...' : 'TEST S9 REFERENCE'}
          </button>
        </div>

        {/* Signal 3: NOAA 1050 Hz Alert Tone */}
        <div className="bg-black/40 border border-zinc-800 rounded-lg p-3 space-y-2 flex flex-col justify-between">
          <div>
            <div className="text-red-400 font-bold text-xs flex items-center justify-between">
              <span>NOAA 1050 Hz WARNING TONE</span>
              <span className="text-[10px] text-zinc-500">NWS Siren</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Pure 1050 Hz warning alarm burst adhering to NWS NWSI 10-1712 for testing Goertzel tone
              detectors, emergency siren relays, and automatic receiver un-muting.
            </p>
          </div>
          <button
            onClick={() => handlePlaySignal('NOAA_1050HZ_ALERT')}
            disabled={activeSignal !== null}
            className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeSignal === 'NOAA_1050HZ_ALERT'
                ? 'bg-red-400 text-black animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {activeSignal === 'NOAA_1050HZ_ALERT' ? 'GENERATING...' : 'TEST 1050 Hz ALERT'}
          </button>
        </div>

        {/* Signal 4: NOAA SAME AFSK Header */}
        <div className="bg-black/40 border border-zinc-800 rounded-lg p-3 space-y-2 flex flex-col justify-between">
          <div>
            <div className="text-cyan-400 font-bold text-xs flex items-center justify-between">
              <span>NOAA SAME AFSK PACKET</span>
              <span className="text-[10px] text-zinc-500">520.83 Baud</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              520.83 baud continuous-phase AFSK preamble and ASCII ZCZC emergency alert header for
              testing Specific Area Message Encoding decoders.
            </p>
          </div>
          <button
            onClick={() => handlePlaySignal('NOAA_SAME_AFSK_HEADER')}
            disabled={activeSignal !== null}
            className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeSignal === 'NOAA_SAME_AFSK_HEADER'
                ? 'bg-cyan-400 text-black animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {activeSignal === 'NOAA_SAME_AFSK_HEADER' ? 'GENERATING...' : 'TEST SAME AFSK'}
          </button>
        </div>

        {/* Signal 5: CTCSS Sub-Audible Tone */}
        <div className="bg-black/40 border border-zinc-800 rounded-lg p-3 space-y-2 flex flex-col justify-between">
          <div>
            <div className="text-purple-400 font-bold text-xs flex items-center justify-between">
              <span>CTCSS SUB-AUDIBLE TONE</span>
              <select
                value={ctcssFreqHz}
                onChange={(e) => setCtcssFreqHz(parseFloat(e.target.value))}
                className="bg-[#121924] border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-purple-300"
              >
                <option value={67.0}>67.0 Hz (XZ)</option>
                <option value={88.5}>88.5 Hz (YB)</option>
                <option value={100.0}>100.0 Hz (1Z)</option>
                <option value={131.8}>131.8 Hz (3B)</option>
                <option value={141.3}>141.3 Hz (4A - GMRS)</option>
                <option value={250.3}>250.3 Hz</option>
              </select>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Continuous sub-audible sine wave tone at -12 dB relative level for testing repeater access,
              CTCSS squelch gates, and Goertzel tone decoders.
            </p>
          </div>
          <button
            onClick={() => handlePlaySignal('CTCSS_SUB_AUDIBLE')}
            disabled={activeSignal !== null}
            className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeSignal === 'CTCSS_SUB_AUDIBLE'
                ? 'bg-purple-400 text-black animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {activeSignal === 'CTCSS_SUB_AUDIBLE' ? 'GENERATING...' : `TEST ${ctcssFreqHz} Hz CTCSS`}
          </button>
        </div>

        {/* Signal 6: 115ms Pink Noise Squelch Tail */}
        <div className="bg-black/40 border border-zinc-800 rounded-lg p-3 space-y-2 flex flex-col justify-between">
          <div>
            <div className="text-zinc-300 font-bold text-xs flex items-center justify-between">
              <span>PINK NOISE SQUELCH TAIL</span>
              <span className="text-[10px] text-zinc-500">115 ms Burst</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Authentic band-limited pink noise burst with 10 ms cosine decay simulating the classic
              unkey &ldquo;ch-chhk&rdquo; squelch tail heard on analog CB transceivers.
            </p>
          </div>
          <button
            onClick={() => handlePlaySignal('PINK_NOISE_SQUELCH_TAIL')}
            disabled={activeSignal !== null}
            className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeSignal === 'PINK_NOISE_SQUELCH_TAIL'
                ? 'bg-zinc-200 text-black animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {activeSignal === 'PINK_NOISE_SQUELCH_TAIL' ? 'GENERATING...' : 'TEST SQUELCH TAIL'}
          </button>
        </div>
      </div>
    </div>
  );
};
