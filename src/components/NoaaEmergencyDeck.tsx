import React, { useState } from 'react';
import {
  SameAlertMessage,
  SameMessageDecoder,
} from '../radio/sameDecoder';
import { LaboratorySignalGenerator } from '../radio/signalGenerator';
import {
  AlertTriangle,
  Radio,
  Volume2,
  Zap,
} from 'lucide-react';

interface NoaaEmergencyDeckProps {
  onTransmitAudio?: (samples: Float32Array) => void;
  onTuneNoaaChannel?: (freqMhz: number) => void;
}

export const NoaaEmergencyDeck: React.FC<NoaaEmergencyDeckProps> = ({
  onTransmitAudio,
  onTuneNoaaChannel,
}) => {
  const [decoder] = useState(() => new SameMessageDecoder());
  const [signalGen] = useState(() => new LaboratorySignalGenerator(48000));

  const [alerts, setAlerts] = useState<SameAlertMessage[]>(() => decoder.getAlertHistory());
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [tonePowerDb, setTonePowerDb] = useState(-100);
  const [simulating, setSimulating] = useState(false);

  // Quick NOAA Channel Buttons
  const noaaChannels = [
    { label: 'WX 1', freq: 162.550 },
    { label: 'WX 2', freq: 162.400 },
    { label: 'WX 3', freq: 162.475 },
    { label: 'WX 4', freq: 162.425 },
    { label: 'WX 5', freq: 162.450 },
    { label: 'WX 6', freq: 162.500 },
    { label: 'WX 7', freq: 162.525 },
  ];

  const handleSimulateAlert = () => {
    setSimulating(true);
    setIsAlertActive(true);
    setTonePowerDb(-18.5);

    // 1. Synthesize 1050 Hz alert tone + SAME burst
    const alertToneSamples = signalGen.generateNoaa1050HzAlert(2.5, 0.9);
    const sameBurst = signalGen.generateSameAfskBurst(
      'ZCZC-WXR-TOR-053033+0045-2882115-KZZ99/NWS-',
      0.85
    );

    // Combine tone + same audio
    const totalLen = alertToneSamples.length + sameBurst.length;
    const combined = new Float32Array(totalLen);
    combined.set(alertToneSamples, 0);
    combined.set(sameBurst, alertToneSamples.length);

    if (onTransmitAudio) {
      onTransmitAudio(combined);
    }

    // 2. Decode synthetic SAME message into history
    const parsed = decoder.parseSameString('ZCZC-WXR-TOR-053033+0045-2882115-KZZ99/NWS-');
    if (parsed) {
      setAlerts(decoder.getAlertHistory());
    }

    setTimeout(() => {
      setSimulating(false);
      setIsAlertActive(false);
      setTonePowerDb(-85.0);
    }, 4500);
  };

  return (
    <section className="panel noaa-panel font-mono space-y-4" aria-label="NOAA Weather Radio All-Hazards &amp; EAS SAME Decoder">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="status-led led-red" />
          <h2 className="panel-title">NOAA WEATHER RADIO ALL-HAZARDS &amp; EAS SAME DECODER</h2>
          <span className="badge-mono hidden sm:inline-block">1050 Hz / AFSK</span>
        </div>

        <button
          onClick={handleSimulateAlert}
          disabled={simulating}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5" />
          {simulating ? 'RUNNING EMERGENCY TEST...' : 'SIMULATE NWS 1050Hz & SAME ALERT'}
        </button>
      </div>

      {/* Emergency Active Alert Banner */}
      {isAlertActive && (
        <div className="bg-red-950/80 border-2 border-red-500 p-4 rounded-xl flex items-center gap-3 animate-pulse">
          <AlertTriangle className="w-8 h-8 text-red-400 shrink-0" />
          <div>
            <div className="text-red-300 font-bold text-sm">
              EMERGENCY ALERT SYSTEM (EAS) ACTIVATED!
            </div>
            <div className="text-red-200 text-xs mt-0.5">
              1050 Hz Warning Tone Alarm Detected // Imminent Tornado / Severe Convective Threat
            </div>
          </div>
        </div>
      )}

      {/* 1050 Hz Detector Telemetry & NOAA Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Detector Status */}
        <div className="md:col-span-5 bg-black/40 border border-zinc-800 rounded-xl p-3.5 space-y-3">
          <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Radio className="w-4 h-4" /> 1050 Hz GOERTZEL WARNING ALARM DETECTOR
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">1050 Hz Relative Energy:</span>
              <span
                className={`font-bold ${
                  tonePowerDb > -35.0 ? 'text-red-400 font-black' : 'text-zinc-400'
                }`}
              >
                {tonePowerDb.toFixed(1)} dBFS
              </span>
            </div>

            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  tonePowerDb > -35.0 ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.max(0, Math.min(100, ((tonePowerDb + 100) / 100) * 100))}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-zinc-500 pt-1">
              <span>Threshold: -35.0 dBFS</span>
              <span>Guard Qualification: &gt; 2.5s</span>
            </div>
          </div>

          <div className="p-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
            Per NWS NWSI 10-1712, the 1050 Hz alert tone precedes life-threatening weather warnings
            and activates automatic receiver un-muting.
          </div>
        </div>

        {/* NOAA 7-Channel Quick Selector */}
        <div className="md:col-span-7 bg-black/40 border border-zinc-800 rounded-xl p-3.5 space-y-2">
          <div className="text-xs font-bold text-cyan-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4" /> NWS ALL-HAZARDS FREQUENCIES (162.400 - 162.550 MHz)
            </span>
            <span className="text-[10px] text-zinc-500">NFM 25 kHz</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {noaaChannels.map((ch) => (
              <button
                key={ch.freq}
                onClick={() => onTuneNoaaChannel && onTuneNoaaChannel(ch.freq)}
                className="p-2.5 px-3 bg-zinc-900 hover:bg-cyan-950/40 border border-zinc-800 hover:border-cyan-500/50 rounded-lg text-center transition-all group cursor-pointer"
              >
                <div className="text-zinc-400 group-hover:text-cyan-300 font-bold text-xs">
                  {ch.label}
                </div>
                <div className="text-zinc-500 group-hover:text-cyan-400 font-mono text-[10px]">
                  {ch.freq.toFixed(3)} MHz
                </div>
              </button>
            ))}
          </div>

          <div className="text-[10px] text-zinc-500 pt-1">
            Click any channel to immediately tune receiver VFO and engage NFM 1050 Hz guard.
          </div>
        </div>
      </div>

      {/* EAS SAME Alert History Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
          <span>DECODED SAME EMERGENCY MESSAGES ({alerts.length})</span>
          <span className="text-zinc-500 text-[11px]">520.83 BAUD AFSK DECODER</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-[11px]">
                <th className="py-2.5 px-3.5">SEVERITY</th>
                <th className="py-2.5 px-3.5">EVENT</th>
                <th className="py-2.5 px-3.5">ISSUED</th>
                <th className="py-2.5 px-3.5">EXPIRES</th>
                <th className="py-2.5 px-3.5">AFFECTED AREAS (FIPS)</th>
                <th className="py-2.5 px-3.5">ORIGINATOR</th>
                <th className="py-2.5 px-3.5">RAW SAME PACKET</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-zinc-800/40 hover:bg-zinc-900/50 text-zinc-300"
                >
                  <td className="py-2.5 px-3.5">
                    <span
                      className={`px-3.5 py-1 rounded-md text-[10px] font-bold inline-block ${
                        alert.severity === 'WARNING' || alert.severity === 'EMERGENCY'
                          ? 'bg-red-950 text-red-300 border border-red-700'
                          : alert.severity === 'WATCH'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-blue-950 text-blue-300 border border-blue-700'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 font-bold text-zinc-100">{alert.eventName}</td>
                  <td className="py-2.5 px-3.5 font-mono text-zinc-400">{alert.issueTimeUtc}</td>
                  <td className="py-2.5 px-3.5 font-mono text-amber-400">{alert.expireTimeUtc}</td>
                  <td className="py-2.5 px-3.5 text-zinc-300 truncate max-w-xs">
                    {alert.fipsCodes.join(', ')}
                  </td>
                  <td className="py-2.5 px-3.5 text-zinc-400">{alert.originatorLabel}</td>
                  <td className="py-2.5 px-3.5 font-mono text-zinc-500 text-[10px] max-w-xs truncate">
                    {alert.rawString}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
