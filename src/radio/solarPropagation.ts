/**
 * Solar Space Weather Telemetry, Ionospheric HF/11m Skip Prediction,
 * and Solar Greyline (Day/Night Terminator) Physics Engine.
 */

export interface SolarTelemetry {
  solarFluxIndex: number; // 10.7cm SFI (e.g. 155 sfu)
  kpIndex: number;        // Planetary Kp (0 to 9)
  aIndex: number;         // Planetary A-Index (0 to 400)
  sunspotNumber: number;  // SSN (e.g. 110)
  geomagneticStatus: 'QUIET' | 'UNSETTLED' | 'ACTIVE' | 'MINOR_STORM' | 'SEVERE_STORM';
  f2Skip11mStatus: 'CLOSED' | 'MARGINAL' | 'OPEN' | 'ROARING_SKIP';
  sporadicEStatus: 'LOW' | 'MODERATE' | 'HIGH';
  estimatedMufMhz: number; // Maximum Usable Frequency in MHz
  lastUpdatedUtc: string;
}

export interface GreylinePoint {
  lat: number;
  lon: number;
}

/**
 * Calculates current Sun position (Declination & Greenwich Hour Angle)
 * and generates the Day/Night Terminator (Solar Greyline) locus where zenith angle Z = 90 deg.
 */
export function calculateSolarTerminator(date: Date = new Date()): {
  solarDeclinationDeg: number;
  greenwichHourAngleDeg: number;
  greylinePoints: GreylinePoint[];
} {
  // Day of year
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;

  // Approximate Solar Declination (degrees)
  const declinationRad =
    -23.44 * (Math.PI / 180.0) * Math.cos(((2 * Math.PI) / 365.25) * (dayOfYear + 10));
  const solarDeclinationDeg = declinationRad * (180.0 / Math.PI);

  // Sun's Greenwich Hour Angle (GHA): 0° when the sun is over Greenwich
  // (≈12:00 UT), 180° at 00:00 UT — i.e. GHA = 15°/hr * UT + 180° (mod 360),
  // east longitude complemented by adding GHA (not subtracting it).
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60.0 + date.getUTCSeconds() / 3600.0;
  const greenwichHourAngleDeg = (utcHours * 15.0 + 180.0) % 360.0;

  // Generate 73 terminator points across longitude -180 to +180
  // Formula: tan(lat) = -cos(hourAngle) / tan(declination), hourAngle = lon + GHA
  const points: GreylinePoint[] = [];
  const tanDec = Math.tan(declinationRad);

  for (let lon = -180; lon <= 180; lon += 5) {
    const hourAngleRad = ((lon + greenwichHourAngleDeg) * Math.PI) / 180.0;
    let latRad = 0;
    if (Math.abs(tanDec) > 1e-4) {
      latRad = Math.atan(-Math.cos(hourAngleRad) / tanDec);
    }
    const latDeg = latRad * (180.0 / Math.PI);
    points.push({ lat: latDeg, lon });
  }

  return {
    solarDeclinationDeg: parseFloat(solarDeclinationDeg.toFixed(2)),
    greenwichHourAngleDeg: parseFloat(greenwichHourAngleDeg.toFixed(2)),
    greylinePoints: points,
  };
}

/**
 * Ionospheric Skip Predictor & Live Space Weather Manager
 */
export class SolarPropagationManager {
  private telemetry: SolarTelemetry = {
    solarFluxIndex: 162,
    kpIndex: 1.7,
    aIndex: 5,
    sunspotNumber: 124,
    geomagneticStatus: 'QUIET',
    f2Skip11mStatus: 'ROARING_SKIP',
    sporadicEStatus: 'HIGH',
    estimatedMufMhz: 31.4,
    lastUpdatedUtc: new Date().toISOString().slice(11, 19) + ' UTC',
  };

  constructor() {
    this.refreshTelemetry();
  }

  public getTelemetry(): SolarTelemetry {
    return { ...this.telemetry };
  }

  /**
   * Fetches latest NOAA Space Weather Prediction Center (SWPC) telemetry or evaluates models.
   */
  public async refreshTelemetry(): Promise<SolarTelemetry> {
    try {
      // Attempt live fetch from NOAA SWPC
      const res = await fetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const latest = data[data.length - 1];
          const kp = parseFloat(latest.kp_index) || 2.0;
          this.telemetry.kpIndex = kp;
        }
      }
    } catch {
      // Keep robust deterministic telemetry if offline or CORS-restricted
    }

    // Evaluate HF / 11m CB Skip & MUF using solar physics
    const sfi = this.telemetry.solarFluxIndex;
    const kp = this.telemetry.kpIndex;

    // Estimated Maximum Usable Frequency (MUF) for 3000 km path:
    // Base MUF roughly correlates with sqrt(SFI)
    const muf = Math.max(12.0, Math.min(45.0, 7.5 + Math.sqrt(sfi) * 1.88 - kp * 0.8));
    this.telemetry.estimatedMufMhz = parseFloat(muf.toFixed(1));

    // Geomagnetic classification
    if (kp < 2.0) this.telemetry.geomagneticStatus = 'QUIET';
    else if (kp < 4.0) this.telemetry.geomagneticStatus = 'UNSETTLED';
    else if (kp < 5.0) this.telemetry.geomagneticStatus = 'ACTIVE';
    else if (kp < 7.0) this.telemetry.geomagneticStatus = 'MINOR_STORM';
    else this.telemetry.geomagneticStatus = 'SEVERE_STORM';

    // 11-Meter (27 MHz CB) F2 Skywave Skip Prediction:
    // Opens when SFI > 110 and Kp <= 3, and estimated MUF > 27.0 MHz
    if (muf >= 29.5 && kp <= 2.5) {
      this.telemetry.f2Skip11mStatus = 'ROARING_SKIP';
    } else if (muf >= 27.0 && kp <= 3.5) {
      this.telemetry.f2Skip11mStatus = 'OPEN';
    } else if (muf >= 25.0) {
      this.telemetry.f2Skip11mStatus = 'MARGINAL';
    } else {
      this.telemetry.f2Skip11mStatus = 'CLOSED';
    }

    this.telemetry.lastUpdatedUtc = new Date().toISOString().slice(11, 19) + ' UTC';
    return this.getTelemetry();
  }
}
