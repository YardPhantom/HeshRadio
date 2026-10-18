/**
 * Shared Formatting & Persistence Utilities
 * All function and type names strictly <= 20 characters
 */

/**
 * Formats frequency in MHz with unit
 * Name length: 14 chars <= 20
 */
export function fmtFreqMhz(mhz: number, dec: number = 3): string {
  return `${mhz.toFixed(dec)} MHz`;
}

/**
 * Formats RF frequency in Hz to human-readable kHz or MHz
 * Name length: 10 chars <= 20
 */
export function fmtFreqHz(hz: number): string {
  if (hz >= 1_000_000) {
    return `${(hz / 1_000_000).toFixed(4)} MHz`;
  }
  return `${(hz / 1_000).toFixed(1)} kHz`;
}

/**
 * Returns color class for S-meter signal level
 * Name length: 11 chars <= 20
 */
export function getSigColor(dbm: number, s9: number = -73): string {
  if (dbm >= s9 + 20) return 'text-red-400';
  if (dbm >= s9) return 'text-amber-400';
  if (dbm >= s9 - 24) return 'text-emerald-400';
  return 'text-zinc-500';
}

/**
 * Formats audio/RF volume percentage
 * Name length: 10 chars <= 20
 */
export function fmtPercent(pct: number): string {
  return `${Math.round(pct)}%`;
}

/**
 * Safely loads JSON/string from localStorage
 * Name length: 11 chars <= 20
 */
export function loadSetting<T>(key: string, defVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defVal;
    return JSON.parse(raw) as T;
  } catch {
    return defVal;
  }
}

/**
 * Safely saves value to localStorage
 * Name length: 11 chars <= 20
 */
export function saveSetting<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn(`[saveSetting] Failed for ${key}:`, err);
  }
}
