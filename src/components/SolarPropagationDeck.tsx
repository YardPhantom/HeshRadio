import React, { useEffect, useRef, useState } from 'react';
import {
  calculateGreatCircle,
  maidenheadToLatLon,
} from '../radio/maidenheadGeodesy';
import {
  calculateSolarTerminator,
  SolarPropagationManager,
  SolarTelemetry,
} from '../radio/solarPropagation';
import {
  Compass,
  Globe,
  RefreshCw,
} from 'lucide-react';

interface SolarPropagationDeckProps {
  myGridSquare: string;
  onMyGridChange?: (grid: string) => void;
}

export const SolarPropagationDeck: React.FC<SolarPropagationDeckProps> = ({
  myGridSquare,
  onMyGridChange,
}) => {
  const [manager] = useState(() => new SolarPropagationManager());
  const [telemetry, setTelemetry] = useState<SolarTelemetry>(() => manager.getTelemetry());
  const [refreshing, setRefreshing] = useState(false);

  // Great Circle Geodesy Tool State
  const [fromGrid, setFromGrid] = useState(myGridSquare || 'CN87uq');
  const [toGrid, setToGrid] = useState('FN31pr'); // New York / Boston
  const [greatCircle, setGreatCircle] = useState(() => {
    const fromLL = maidenheadToLatLon('CN87uq');
    const toLL = maidenheadToLatLon('FN31pr');
    return calculateGreatCircle(fromLL, toLL);
  });

  // Solar Greyline Map Canvas
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await manager.refreshTelemetry();
      setTelemetry(res);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCalculatePath = () => {
    const fromLL = maidenheadToLatLon(fromGrid);
    const toLL = maidenheadToLatLon(toGrid);
    setGreatCircle(calculateGreatCircle(fromLL, toLL));
  };

  // Render Solar Greyline Map
  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background deep oceanic blue
    ctx.fillStyle = '#060e1a';
    ctx.fillRect(0, 0, w, h);

    // Latitude & Longitude grid lines (30 deg intervals)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;

    for (let lon = -180; lon <= 180; lon += 30) {
      const x = ((lon + 180) / 360) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    for (let lat = -90; lat <= 90; lat += 30) {
      const y = h - ((lat + 90) / 180) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Equator line
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Calculate Solar Terminator Points
    const term = calculateSolarTerminator(new Date());

    // Draw Solar Greyline Twilight Enhancement Band (+/- 5 deg)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.beginPath();
    for (let i = 0; i < term.greylinePoints.length; i++) {
      const p = term.greylinePoints[i];
      const x = ((p.lon + 180) / 360) * w;
      const y = h - ((p.lat + 90) / 180) * h;
      if (i === 0) ctx.moveTo(x, y - 6);
      else ctx.lineTo(x, y - 6);
    }
    for (let i = term.greylinePoints.length - 1; i >= 0; i--) {
      const p = term.greylinePoints[i];
      const x = ((p.lon + 180) / 360) * w;
      const y = h - ((p.lat + 90) / 180) * h;
      ctx.lineTo(x, y + 6);
    }
    ctx.closePath();
    ctx.fill();

    // Draw Primary Greyline Center Trace
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < term.greylinePoints.length; i++) {
      const p = term.greylinePoints[i];
      const x = ((p.lon + 180) / 360) * w;
      const y = h - ((p.lat + 90) / 180) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plot My Station Location
    const myPos = maidenheadToLatLon(fromGrid);
    const myX = ((myPos.lon + 180) / 360) * w;
    const myY = h - ((myPos.lat + 90) / 180) * h;

    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(myX, myY, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText(`MY QTH (${fromGrid})`, myX + 6, myY + 3);

    // Plot Target Location & Great Circle Path
    const targetPos = maidenheadToLatLon(toGrid);
    const targetX = ((targetPos.lon + 180) / 360) * w;
    const targetY = h - ((targetPos.lat + 90) / 180) * h;

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillText(`TARGET (${toGrid})`, targetX + 6, targetY + 3);

    // Path Line
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(myX, myY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [fromGrid, toGrid]);

  return (
    <section className="panel solar-panel space-y-4" aria-label="Space Weather, Ionospheric Skip &amp; Geodesy">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="status-led led-amber" />
          <h2 className="panel-title">SPACE WEATHER, IONOSPHERIC SKIP &amp; GEODESY</h2>
          <span className="badge-mono hidden sm:inline-block">
            NOAA SWPC LIVE TELEMETRY
          </span>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 rounded-md font-mono font-bold border border-zinc-700 flex items-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'REFRESHING...' : 'POLL NOAA SWPC'}
        </button>
      </div>

      {/* 1. Solar Weather Telemetry Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-black/40 p-3.5 rounded-xl border border-zinc-800 space-y-1">
          <div className="text-[10px] text-zinc-500 uppercase">10.7cm Solar Flux (SFI)</div>
          <div className="text-xl font-bold text-amber-400">{telemetry.solarFluxIndex} sfu</div>
          <div className="text-[10px] text-emerald-400">Ionospheric F2 Energy High</div>
        </div>

        <div className="bg-black/40 p-3.5 rounded-xl border border-zinc-800 space-y-1">
          <div className="text-[10px] text-zinc-500 uppercase">Planetary Kp-Index</div>
          <div className="text-xl font-bold text-emerald-400">{telemetry.kpIndex} Kp</div>
          <div className="text-[10px] text-zinc-400">
            {telemetry.geomagneticStatus === 'QUIET' ? 'Geomagnetically Quiet' : 'Unsettled'}
          </div>
        </div>

        <div className="bg-black/40 p-3.5 rounded-xl border border-zinc-800 space-y-1">
          <div className="text-[10px] text-zinc-500 uppercase">11m CB (27 MHz) Skip Status</div>
          <div
            className={`text-base font-bold truncate ${
              telemetry.f2Skip11mStatus === 'ROARING_SKIP'
                ? 'text-red-400 animate-pulse'
                : telemetry.f2Skip11mStatus === 'OPEN'
                ? 'text-emerald-400'
                : 'text-zinc-400'
            }`}
          >
            {telemetry.f2Skip11mStatus}
          </div>
          <div className="text-[10px] text-zinc-400">Estimated MUF: {telemetry.estimatedMufMhz} MHz</div>
        </div>

        <div className="bg-black/40 p-3.5 rounded-xl border border-zinc-800 space-y-1">
          <div className="text-[10px] text-zinc-500 uppercase">Sunspot Number (SSN)</div>
          <div className="text-xl font-bold text-amber-300">{telemetry.sunspotNumber}</div>
          <div className="text-[10px] text-zinc-500">Cycle 25 Solar Peak</div>
        </div>
      </div>

      {/* 2. World Solar Greyline (Terminator) Canvas Map */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-mono text-zinc-400">
          <span className="font-bold flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-amber-400" /> REAL-TIME SOLAR GREYLINE (DAY/NIGHT TERMINATOR)
          </span>
          <span className="text-[11px] text-zinc-500">
            Amber band = ±5° Twilight Enhancement Corridor
          </span>
        </div>

        <div className="bg-black rounded-xl border border-zinc-800 p-2.5 overflow-hidden flex justify-center">
          <canvas
            ref={mapCanvasRef}
            width={640}
            height={320}
            className="w-full max-w-2xl h-auto rounded-lg"
          />
        </div>
      </div>

      {/* 3. Maidenhead Geodesy & Great Circle Beam Heading Calculator */}
      <div className="bg-black/40 p-4 rounded-xl border border-zinc-800 space-y-3 font-mono text-xs">
        <div className="text-zinc-300 font-bold flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-cyan-400" /> MAIDENHEAD GEODESY &amp; GREAT CIRCLE BEAM HEADINGS
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-zinc-500 text-[10px] block mb-1">MY QTH MAIDENHEAD GRID:</label>
            <input
              type="text"
              value={fromGrid}
              onChange={(e) => {
                const g = e.target.value.toUpperCase();
                setFromGrid(g);
                if (onMyGridChange) onMyGridChange(g);
              }}
              className="w-full bg-zinc-900 border border-zinc-700 text-cyan-300 px-3.5 py-2 rounded-lg font-bold uppercase focus:outline-none"
            />
          </div>

          <div>
            <label className="text-zinc-500 text-[10px] block mb-1">TARGET STATION GRID / DX:</label>
            <input
              type="text"
              value={toGrid}
              onChange={(e) => setToGrid(e.target.value.toUpperCase())}
              className="w-full bg-zinc-900 border border-zinc-700 text-emerald-300 px-3.5 py-2 rounded-lg font-bold uppercase focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCalculatePath}
              className="w-full py-2 px-3.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold rounded-lg shadow-md transition-all cursor-pointer"
            >
              CALCULATE BEAM HEADING
            </button>
          </div>
        </div>

        {/* Calculated Results */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-zinc-950 p-3 rounded-lg border border-zinc-800">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Distance</span>
            <span className="text-zinc-100 font-bold">
              {greatCircle.distanceKm} km ({greatCircle.distanceMiles} mi)
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Short-Path Azimuth</span>
            <span className="text-cyan-400 font-bold">{greatCircle.shortPathBearingDeg}° TRUE</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Long-Path Azimuth</span>
            <span className="text-amber-400 font-bold">{greatCircle.longPathBearingDeg}° TRUE</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Long-Path Distance</span>
            <span className="text-zinc-400 font-bold">{greatCircle.longPathDistanceKm} km</span>
          </div>
        </div>
      </div>
    </section>
  );
};
