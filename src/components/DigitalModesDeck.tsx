import React, { useEffect, useRef, useState } from 'react';
import {
  AprsPacket,
  Bell202AfskModulator,
  formatAprsLatitude,
  formatAprsLongitude,
  generateAprsPasscode,
} from '../radio/aprsPacket';
import {
  Ft8Message,
  Ft8ModemEngine,
} from '../radio/ft8Modem';
import {
  SstvEngine,
  SstvMode,
  SSTV_MODES,
} from '../radio/sstvEngine';
import {
  MapPin,
  Send,
  Zap,
  Image as ImageIcon,
  Play,
  Clock,
} from 'lucide-react';

interface DigitalModesDeckProps {
  myCallsign: string;
  myGridSquare: string;
  currentFreqMhz: number;
  onTransmitAudio: (samples: Float32Array) => void;
  onLogQso?: (contact: { call: string; band: string; freq: string; mode: string; rst: string; grid: string }) => void;
}

export const DigitalModesDeck: React.FC<DigitalModesDeckProps> = ({
  myCallsign,
  myGridSquare,
  currentFreqMhz,
  onTransmitAudio,
  onLogQso,
}) => {
  const [activeSubMode, setActiveSubMode] = useState<'APRS' | 'FT8' | 'SSTV'>('APRS');

  // APRS State
  const [aprsPackets, setAprsPackets] = useState<AprsPacket[]>([
    {
      id: 'p-1',
      sourceCall: 'W6XYZ-9',
      destCall: 'APRS',
      digipeaters: ['WIDE1-1', 'WIDE2-1'],
      payloadType: 'POSITION',
      latitude: 47.6062,
      longitude: -122.3321,
      comment: 'Mobile Kenwood TM-D710A // I-5 Northbound Corridor',
      rawAx25Text: 'W6XYZ-9>APRS,WIDE1-1,WIDE2-1:=4736.37N/12219.92W>Mobile Kenwood I-5',
      timestampUtc: '20:12:05Z',
    },
    {
      id: 'p-2',
      sourceCall: 'K7RPT',
      destCall: 'APRS',
      digipeaters: ['WIDE2-1'],
      payloadType: 'WEATHER',
      latitude: 47.5124,
      longitude: -122.1892,
      comment: 'Summit Repeater WX // Wind 18mph WNW Temp 58F Baro 30.08',
      rawAx25Text: 'K7RPT>APRS,WIDE2-1:_10152012c285s018g024t058r000p000P000h65b10185',
      timestampUtc: '20:13:30Z',
    },
    {
      id: 'p-3',
      sourceCall: 'TRUCKER-402',
      destCall: 'APRS',
      digipeaters: ['WIDE1-1'],
      payloadType: 'POSITION',
      latitude: 41.1399,
      longitude: -104.8202,
      comment: '18-Wheeler Kenworth // I-80 Cheyenne Yardstick 362',
      rawAx25Text: 'TRUCKER-402>APRS,WIDE1-1:=4108.39N/10449.21Wk18-Wheeler I-80 Cheyenne',
      timestampUtc: '20:14:15Z',
    },
  ]);
  const [aprsBeaconText, setAprsBeaconText] = useState('HeshRadio Tactical Node // Win + S26 Ultra');
  const [aprsPasscode, setAprsPasscode] = useState(() => generateAprsPasscode(myCallsign));

  // FT8 State
  const [ft8Cycle, setFt8Cycle] = useState(() => Ft8ModemEngine.getUtcSequenceStatus());
  const [ft8Messages, setFt8Messages] = useState<Ft8Message[]>([
    { id: 'f-1', utcTime: '201500', snrDb: -4, deltaFreqHz: 1250, message: 'CQ K1ABC CN87' },
    { id: 'f-2', utcTime: '201500', snrDb: -12, deltaFreqHz: 1680, message: 'JA1XYZ W6ABC -08' },
    { id: 'f-3', utcTime: '201515', snrDb: 2, deltaFreqHz: 1420, message: 'W6ABC JA1XYZ R-11' },
    { id: 'f-4', utcTime: '201530', snrDb: -6, deltaFreqHz: 1250, message: 'W6XYZ K1ABC -09' },
  ]);
  const [ft8SelectedTarget, setFt8SelectedTarget] = useState('W6XYZ');
  const [ft8AudioOffsetHz, setFt8AudioOffsetHz] = useState(1250);
  const ft8EngineRef = useRef(new Ft8ModemEngine());

  // SSTV State
  const [sstvMode, setSstvMode] = useState<SstvMode>('MARTIN_M1');
  const [sstvTransmitting, setSstvTransmitting] = useState(false);
  const [sstvProgressPct, setSstvProgressPct] = useState(0);
  const sstvCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Update APRS passcode on callsign change
  useEffect(() => {
    setAprsPasscode(generateAprsPasscode(myCallsign));
  }, [myCallsign]);

  // FT8 15-second UTC sequence timer
  useEffect(() => {
    const id = window.setInterval(() => {
      setFt8Cycle(Ft8ModemEngine.getUtcSequenceStatus());
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // Draw initial SSTV test pattern on canvas
  useEffect(() => {
    if (sstvCanvasRef.current) {
      SstvEngine.drawTestPattern(
        sstvCanvasRef.current,
        myCallsign,
        `${currentFreqMhz.toFixed(3)} MHz // ${SSTV_MODES[sstvMode].name}`
      );
    }
  }, [sstvMode, myCallsign, currentFreqMhz]);

  // APRS Beacon Transmission
  const handleSendAprsBeacon = () => {
    // Generate simulated coordinates near Seattle (CN87)
    const lat = 47.6062;
    const lon = -122.3321;
    const posPayload = `=${formatAprsLatitude(lat)}/${formatAprsLongitude(lon)}#${aprsBeaconText}`;

    // Synthesize Bell 202 AFSK audio
    const pcm = Bell202AfskModulator.encodeAx25Packet(myCallsign, 'APRS', posPayload);
    onTransmitAudio(pcm);

    const newPacket: AprsPacket = {
      id: 'tx-' + Date.now(),
      sourceCall: myCallsign,
      destCall: 'APRS',
      digipeaters: ['WIDE1-1', 'WIDE2-1'],
      payloadType: 'POSITION',
      latitude: lat,
      longitude: lon,
      comment: aprsBeaconText,
      rawAx25Text: `${myCallsign}>APRS,WIDE1-1,WIDE2-1:${posPayload}`,
      timestampUtc: new Date().toISOString().slice(11, 19) + 'Z',
    };
    setAprsPackets((prev) => [newPacket, ...prev]);
  };

  // FT8 Transmit Trigger
  const handleTransmitFt8Message = (customMsg?: string) => {
    const msg = customMsg || `CQ ${myCallsign} ${myGridSquare.slice(0, 4)}`;
    const pcm = ft8EngineRef.current.synthesizeFt8Audio(msg, ft8AudioOffsetHz);
    onTransmitAudio(pcm);

    const txMsg: Ft8Message = {
      id: 'tx-' + Date.now(),
      utcTime: new Date().toISOString().slice(11, 19).replace(/:/g, ''),
      snrDb: 0,
      deltaFreqHz: ft8AudioOffsetHz,
      message: msg,
      isTx: true,
    };
    setFt8Messages((prev) => [txMsg, ...prev]);

    if (onLogQso && ft8SelectedTarget) {
      onLogQso({
        call: ft8SelectedTarget,
        band: currentFreqMhz < 30 ? '20m' : '2m',
        freq: currentFreqMhz.toFixed(5),
        mode: 'FT8',
        rst: '-08',
        grid: 'CM87',
      });
    }
  };

  // SSTV Transmit Sequence
  const handleTransmitSstv = () => {
    setSstvTransmitting(true);
    setSstvProgressPct(0);

    const modeInfo = SSTV_MODES[sstvMode];
    // Generate VIS header audio
    const visPcm = SstvEngine.generateVisHeaderAudio(modeInfo.visCode);
    onTransmitAudio(visPcm);

    const startTime = Date.now();
    const durationMs = 12000; // Simulated high-speed line scan for UI preview

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setSstvProgressPct(pct);

      if (pct >= 100) {
        clearInterval(interval);
        setSstvTransmitting(false);
      }
    }, 150);
  };

  return (
    <section className="panel digital-panel space-y-4" aria-label="Digital Modes Modem Suite">
      {/* 1. Header & Digital Modes Sub-Nav */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="status-led led-purple" />
          <h2 className="panel-title">DIGITAL MODES MODEM SUITE</h2>
          <span className="badge-mono hidden sm:inline-block">
            APRS • FT8 / JS8 • SSTV
          </span>
        </div>

        {/* Submode Switcher Tabs */}
        <div className="flex gap-2 font-mono text-xs font-bold">
          <button
            onClick={() => setActiveSubMode('APRS')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeSubMode === 'APRS'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> APRS TACTICAL RADAR
          </button>
          <button
            onClick={() => setActiveSubMode('FT8')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeSubMode === 'FT8'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> FT8 / JS8 WEAK-SIGNAL
          </button>
          <button
            onClick={() => setActiveSubMode('SSTV')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeSubMode === 'SSTV'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> SSTV SLOW SCAN TV
          </button>
        </div>
      </div>

      {/* 2. SUBMODE 1: APRS TACTICAL RADAR & PACKET TRACKER */}
      {activeSubMode === 'APRS' && (
        <div className="space-y-4">
          {/* Tactical APRS Status & Beacon Control Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-black/50 p-2.5 rounded border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase">APRS Frequency</div>
              <div className="text-cyan-300 font-bold">144.390 MHz (NA Primary)</div>
            </div>
            <div className="bg-black/50 p-2.5 rounded border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase">APRS-IS Passcode</div>
              <div className="text-amber-300 font-bold">
                {myCallsign}: <span className="text-white font-mono">{aprsPasscode}</span>
              </div>
            </div>
            <div className="bg-black/50 p-2.5 rounded border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase">Modem Standard</div>
              <div className="text-zinc-200 font-bold">Bell 202 AFSK (1200 Baud)</div>
            </div>
            <div className="bg-black/50 p-2.5 rounded border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase">Path / Digipeaters</div>
              <div className="text-zinc-300 font-bold">WIDE1-1, WIDE2-1</div>
            </div>
          </div>

          {/* APRS Beacon Transmitter Form */}
          <div className="flex flex-wrap items-center gap-2.5 bg-black/40 p-3.5 rounded-lg border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-400 font-bold">BEACON COMMENT:</span>
            <input
              type="text"
              value={aprsBeaconText}
              onChange={(e) => setAprsBeaconText(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-100 px-3.5 py-2 rounded-lg focus:outline-none"
            />
            <button
              onClick={handleSendAprsBeacon}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-black font-bold rounded-lg flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> TRANSMIT 1200 BAUD BEACON
            </button>
          </div>

          {/* APRS Live Packet Monitor Table */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-zinc-400">
              <span className="font-bold">LIVE AX.25 APRS PACKET MONITOR</span>
              <span>{aprsPackets.length} PACKETS LOGGED</span>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {aprsPackets.map((pkt) => (
                <div
                  key={pkt.id}
                  className="bg-black/60 p-3 rounded-lg border border-zinc-800 text-xs font-mono space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-400">{pkt.sourceCall}</span>
                      <span className="text-zinc-500">▶ {pkt.destCall}</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-bold">
                        {pkt.payloadType}
                      </span>
                    </div>
                    <span className="text-zinc-500">{pkt.timestampUtc}</span>
                  </div>

                  {pkt.latitude !== undefined && pkt.longitude !== undefined && (
                    <div className="text-emerald-400 text-[11px] flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>
                        {pkt.latitude.toFixed(4)}°, {pkt.longitude.toFixed(4)}°
                      </span>
                      {pkt.comment && <span className="text-zinc-300 ml-2">"{pkt.comment}"</span>}
                    </div>
                  )}

                  <div className="text-[10px] text-zinc-500 font-mono truncate" title={pkt.rawAx25Text}>
                    RAW: {pkt.rawAx25Text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. SUBMODE 2: FT8 / JS8CALL WEAK-SIGNAL MODEM */}
      {activeSubMode === 'FT8' && (
        <div className="space-y-4 font-mono text-xs">
          {/* 15-Second UTC Sequence Progress Header */}
          <div className="bg-black/60 p-3 rounded-lg border border-amber-900/40 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-amber-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> FT8 15.0s UTC SEQUENCE TIMER
              </span>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-md text-[10px] font-bold ${
                    ft8Cycle.isTxWindow
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {ft8Cycle.isTxWindow ? 'TX WINDOW (0 - 12.64s)' : 'RX / DECODE WINDOW'}
                </span>
                <span className="text-zinc-300 font-bold">{ft8Cycle.secondsRemainingInCycle}s LEFT</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
              <div
                className={`h-full transition-all duration-100 ${
                  ft8Cycle.isTxWindow ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${ft8Cycle.progressPct}%` }}
              />
            </div>
          </div>

          {/* Quick Controls & Waterfall Pitch */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-black/40 p-3 rounded-lg border border-zinc-800 space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase">Audio Offset (Pitch)</div>
              <div className="flex items-center justify-between">
                <span className="text-amber-300 font-bold">{ft8AudioOffsetHz} Hz</span>
                <input
                  type="range"
                  min="400"
                  max="2400"
                  step="50"
                  value={ft8AudioOffsetHz}
                  onChange={(e) => setFt8AudioOffsetHz(parseInt(e.target.value, 10))}
                  className="w-28 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>

            <div className="bg-black/40 p-3 rounded-lg border border-zinc-800 space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase">Target Station</div>
              <input
                type="text"
                value={ft8SelectedTarget}
                onChange={(e) => setFt8SelectedTarget(e.target.value.toUpperCase())}
                className="w-full bg-zinc-900 border border-zinc-700 text-amber-300 px-3 py-1.5 rounded-md font-bold focus:outline-none"
              />
            </div>

            <div className="bg-black/40 p-3 rounded-lg border border-zinc-800 flex items-center justify-center gap-2">
              <button
                onClick={() => handleTransmitFt8Message(`CQ ${myCallsign} ${myGridSquare.slice(0, 4)}`)}
                className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg shadow-md transition-all text-center cursor-pointer"
              >
                CALL CQ
              </button>
              <button
                onClick={() =>
                  handleTransmitFt8Message(`${ft8SelectedTarget} ${myCallsign} -08`)
                }
                className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 font-bold rounded-lg text-center cursor-pointer"
              >
                SEND -08
              </button>
            </div>
          </div>

          {/* FT8 Band Activity Decode Stream */}
          <div className="space-y-1.5">
            <div className="text-xs text-zinc-400 font-bold">BAND DECODE STREAM (20m / 14.074 MHz)</div>
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {ft8Messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2.5 px-3 rounded-lg border flex items-center justify-between text-xs ${
                    msg.isTx
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold'
                      : 'bg-black/60 border-zinc-800 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">{msg.utcTime}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                        msg.snrDb >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {msg.snrDb >= 0 ? `+${msg.snrDb}` : msg.snrDb} dB
                    </span>
                    <span className="text-cyan-400">{msg.deltaFreqHz} Hz</span>
                    <span className="font-mono">{msg.message}</span>
                  </div>

                  {!msg.isTx && (
                    <button
                      onClick={() => {
                        const parts = msg.message.split(' ');
                        if (parts[1]) setFt8SelectedTarget(parts[1]);
                      }}
                      className="text-[10px] px-3 py-1 bg-zinc-800 hover:bg-amber-500/20 text-zinc-300 hover:text-amber-300 rounded-md border border-zinc-700 font-bold cursor-pointer transition-colors"
                    >
                      ANSWER
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. SUBMODE 3: SSTV SLOW SCAN TV IMAGE TRANSCEIVER */}
      {activeSubMode === 'SSTV' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 font-mono text-xs">
          {/* Left Canvas Preview */}
          <div className="md:col-span-7 flex flex-col items-center gap-2 bg-black/60 p-3.5 rounded-xl border border-zinc-800">
            <div className="flex justify-between w-full text-zinc-400 text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" /> SSTV SCANLINE MONITOR
              </span>
              <span>{SSTV_MODES[sstvMode].name}</span>
            </div>

            <canvas
              ref={sstvCanvasRef}
              width={320}
              height={240}
              className="rounded-lg border border-zinc-700 max-w-full shadow-inner"
            />

            {sstvTransmitting && (
              <div className="w-full space-y-1">
                <div className="flex justify-between text-[11px] text-emerald-400">
                  <span>TRANSMITTING LINE RASTER...</span>
                  <span>{sstvProgressPct}%</span>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-150"
                    style={{ width: `${sstvProgressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Controls */}
          <div className="md:col-span-5 flex flex-col gap-3 bg-black/40 p-3.5 rounded-xl border border-zinc-800">
            <div>
              <label className="text-zinc-400 text-[11px] block mb-1">SELECT SSTV PROTOCOL:</label>
              <div className="space-y-1.5">
                {(Object.keys(SSTV_MODES) as SstvMode[]).map((modeKey) => {
                  const m = SSTV_MODES[modeKey];
                  const active = sstvMode === modeKey;
                  return (
                    <button
                      key={modeKey}
                      onClick={() => setSstvMode(modeKey)}
                      className={`w-full text-left p-2.5 px-3 rounded-lg border transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 font-bold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span>{m.name}</span>
                        <span className="text-[10px] text-zinc-500">{m.durationSec}s</span>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {m.width}x{m.height} • VIS 0x{m.visCode.toString(16).toUpperCase()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800">
              <button
                onClick={handleTransmitSstv}
                disabled={sstvTransmitting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Play className="w-4 h-4" />
                {sstvTransmitting ? 'TRANSMITTING SSTV...' : 'TRANSMIT SSTV IMAGE'}
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 leading-relaxed">
              Standard SSTV generates a 1900 Hz leader tone, 1200 Hz break, followed
              by the VIS header code, before modulating scanline pixels (1500 Hz black to 2300 Hz white).
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
