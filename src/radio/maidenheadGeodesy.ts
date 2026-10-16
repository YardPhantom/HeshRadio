/**
 * Maidenhead Grid Square Geodesy and Great Circle Spherical Trigonometry
 * Standards-compliant implementation for Amateur Radio & Tactical RF Systems.
 */

export interface LatLon {
  lat: number; // Degrees: -90.0 to +90.0
  lon: number; // Degrees: -180.0 to +180.0
}

export interface GreatCirclePath {
  distanceKm: number;
  distanceMiles: number;
  shortPathBearingDeg: number;
  longPathBearingDeg: number;
  longPathDistanceKm: number;
}

const EARTH_RADIUS_KM = 6371.0;
const EARTH_CIRCUMFERENCE_KM = 40030.17;

/**
 * Converts Latitude & Longitude to a precise 6-Character Maidenhead Grid Square (e.g. "CN87uq").
 */
export function latLonToMaidenhead(lat: number, lon: number): string {
  // Clamp lat [-90, +90], normalize lon [-180, +180]
  const phi = Math.max(-90.0, Math.min(90.0, lat));
  let lambda = lon;
  while (lambda < -180.0) lambda += 360.0;
  while (lambda > 180.0) lambda -= 360.0;

  const Lambda = lambda + 180.0;
  const Phi = phi + 90.0;

  // Field (Chars 1-2: A-R)
  const fLon = Math.floor(Lambda / 20.0);
  const fLat = Math.floor(Phi / 10.0);
  const c1 = String.fromCharCode(65 + Math.max(0, Math.min(17, fLon)));
  const c2 = String.fromCharCode(65 + Math.max(0, Math.min(17, fLat)));

  // Square (Chars 3-4: 0-9)
  const remLonField = Lambda % 20.0;
  const remLatField = Phi % 10.0;
  const sLon = Math.floor(remLonField / 2.0);
  const sLat = Math.floor(remLatField / 1.0);
  const c3 = String(Math.max(0, Math.min(9, sLon)));
  const c4 = String(Math.max(0, Math.min(9, sLat)));

  // Subsquare (Chars 5-6: a-x)
  const remLonSq = remLonField % 2.0;
  const remLatSq = remLatField % 1.0;
  const ssLon = Math.floor(remLonSq * 12.0);
  const ssLat = Math.floor(remLatSq * 24.0);
  const c5 = String.fromCharCode(97 + Math.max(0, Math.min(23, ssLon)));
  const c6 = String.fromCharCode(97 + Math.max(0, Math.min(23, ssLat)));

  return `${c1}${c2}${c3}${c4}${c5}${c6}`;
}

/**
 * Decodes 4 or 6-character Maidenhead locator to its center Latitude & Longitude.
 */
export function maidenheadToLatLon(grid: string): LatLon {
  const g = grid.trim().toUpperCase();
  if (g.length < 4) {
    return { lat: 0, lon: 0 };
  }

  const fLon = g.charCodeAt(0) - 65;
  const fLat = g.charCodeAt(1) - 65;
  const sLon = parseInt(g[2], 10) || 0;
  const sLat = parseInt(g[3], 10) || 0;

  let lon = fLon * 20.0 + sLon * 2.0 - 180.0;
  let lat = fLat * 10.0 + sLat * 1.0 - 90.0;

  if (g.length >= 6) {
    const ssLon = g.charCodeAt(4) - 65;
    const ssLat = g.charCodeAt(5) - 65;
    lon += (ssLon + 0.5) * (2.0 / 24.0);
    lat += (ssLat + 0.5) * (1.0 / 24.0);
  } else {
    // Center of 4-character square
    lon += 1.0;
    lat += 0.5;
  }

  return { lat, lon };
}

/**
 * Computes Great Circle Short-Path & Long-Path distance and true azimuth beam headings.
 */
export function calculateGreatCircle(from: LatLon, to: LatLon): GreatCirclePath {
  const toRad = Math.PI / 180.0;
  const toDeg = 180.0 / Math.PI;

  const phi1 = from.lat * toRad;
  const phi2 = to.lat * toRad;
  const deltaPhi = (to.lat - from.lat) * toRad;
  const deltaLambda = (to.lon - from.lon) * toRad;

  // Haversine formula
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const distanceKm = EARTH_RADIUS_KM * c;
  const distanceMiles = distanceKm * 0.621371;

  // Forward Short-Path Azimuth
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  let shortPathBearingDeg = Math.atan2(y, x) * toDeg;
  shortPathBearingDeg = (shortPathBearingDeg + 360.0) % 360.0;

  // Long-Path
  const longPathBearingDeg = (shortPathBearingDeg + 180.0) % 360.0;
  const longPathDistanceKm = Math.max(0, EARTH_CIRCUMFERENCE_KM - distanceKm);

  return {
    distanceKm: Math.round(distanceKm),
    distanceMiles: Math.round(distanceMiles),
    shortPathBearingDeg: Math.round(shortPathBearingDeg),
    longPathBearingDeg: Math.round(longPathBearingDeg),
    longPathDistanceKm: Math.round(longPathDistanceKm),
  };
}
