/**
 * Shared formatting utilities for RF frequencies, signals, timestamps, and callsigns.
 */

export function formatFrequency(
  mhz: number,
  options: { showUnit?: boolean; precision?: number } = {}
): string {
  const { showUnit = true, precision = 4 } = options;
  if (isNaN(mhz)) return showUnit ? '0.0000 MHz' : '0.0000';

  let formatted: string;
  if (mhz >= 1.0) {
    formatted = mhz.toFixed(precision);
    return showUnit ? `${formatted} MHz` : formatted;
  }

  // Under 1.0 MHz, express as kHz
  const khz = mhz * 1000;
  formatted = khz.toFixed(1);
  return showUnit ? `${formatted} kHz` : formatted;
}

export function formatUtcTimestamp(date = new Date()): string {
  return date.toISOString().slice(11, 19) + ' UTC';
}

export function formatUtcTimeShort(date = new Date()): string {
  return date.toISOString().slice(11, 19) + 'Z';
}

export function formatCallsign(call: string): string {
  return (call || '').trim().toUpperCase();
}
