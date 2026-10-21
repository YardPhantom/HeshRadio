/**
 * Pure Mathematical Geodesy & Maidenhead Grid Locator Utilities
 * Computes exact Great Circle Distance (Haversine formula) and Forward
 * Azimuth / Beam Heading (degrees) between amateur radio Maidenhead grid locators.
 */

export interface LatLon {
  lat: number; // Decimal degrees (-90 to +90)
  lon: number; // Decimal degrees (-180 to +180)
}

export interface GeodesyResult {
  distanceKm: number;
  distanceMiles: number;
  bearingDeg: number;
  compassDir: string;
}

/**
 * Converts a 4- or 6-character Maidenhead locator (e.g. "CN87", "FN31pr")
 * into its center geographic latitude and longitude.
 */
export function maidenheadToLatLon(grid: string): LatLon | null {
  if (!grid || typeof grid !== 'string') return null;
  const clean = grid.trim().toUpperCase();
  if (clean.length < 4) return null;

  // Field (20° lon by 10° lat)
  const fLon = clean.charCodeAt(0) - 65;
  const fLat = clean.charCodeAt(1) - 65;
  if (fLon < 0 || fLon > 17 || fLat < 0 || fLat > 17) return null;

  // Square (2° lon by 1° lat)
  const sLon = parseInt(clean[2], 10);
  const sLat = parseInt(clean[3], 10);
  if (isNaN(sLon) || sLon < 0 || sLon > 9 || isNaN(sLat) || sLat < 0 || sLat > 9) return null;

  let lon = -180 + fLon * 20 + sLon * 2;
  let lat = -90 + fLat * 10 + sLat * 1;

  // Subsquare (5.0' lon by 2.5' lat = 1/12° by 1/24°), centered in the cell
  if (clean.length >= 6) {
    const subLon = clean.charCodeAt(4) - 65;
    const subLat = clean.charCodeAt(5) - 65;
    if (subLon >= 0 && subLon <= 23 && subLat >= 0 && subLat <= 23) {
      lon += (subLon + 0.5) * (1 / 12);
      lat += (subLat + 0.5) * (1 / 24);
      return { lat, lon };
    }
  }

  // Center of the 4-char square
  lon += 1.0;
  lat += 0.5;
  return { lat, lon };
}

/**
 * Computes great circle distance and forward azimuth heading
 * from origin locator to destination locator.
 */
export function calculateGeodesy(fromGrid: string, toGrid: string): GeodesyResult | null {
  const from = maidenheadToLatLon(fromGrid);
  const to = maidenheadToLatLon(toGrid);
  if (!from || !to) return null;

  const R = 6371.0; // Earth mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(from.lat);
  const lon1 = toRad(from.lon);
  const lat2 = toRad(to.lat);
  const lon2 = toRad(to.lon);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c);
  const distanceMiles = Math.round(distanceKm * 0.621371);

  // Forward azimuth (bearing)
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let bearingDeg = Math.round(toDeg(Math.atan2(y, x)));
  bearingDeg = (bearingDeg + 360) % 360;

  // 16-point compass heading
  const compassPoints = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];
  const compassIdx = Math.round(bearingDeg / 22.5) % 16;
  const compassDir = compassPoints[compassIdx];

  return {
    distanceKm,
    distanceMiles,
    bearingDeg,
    compassDir,
  };
}
