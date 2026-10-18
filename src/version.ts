/**
 * HeshRadio Version Tracking Engine
 *
 * Scheme: vX.YY.Z
 * - Starts at: v0.00.1
 * - Max: v9.99.9
 * - Rollover Rule: No single position or digit ever reaches 10.
 *   - Patch Z: 0–9 (starts at 1 in v0.00.1; rolls 9 -> 0 with Minor increment)
 *   - Minor YY: 00–99 (rolls 99 -> 00 with Major increment)
 *   - Major X: 0–9 (caps at 9; maximum absolute version is v9.99.9)
 */

export const CURRENT_VERSION = 'v0.00.4';
export const MAX_VERSION = 'v9.99.9';
export const MIN_VERSION = 'v0.00.1';

export interface SemVerHesh {
  major: number; // 0..9
  minor: number; // 0..99
  patch: number; // 0..9
}

/**
 * Parses a version string formatted as vX.YY.Z or X.YY.Z
 */
export function parseHeshVersion(versionStr: string): SemVerHesh {
  const clean = versionStr.trim().replace(/^v/i, '');
  const parts = clean.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid HeshRadio version string: "${versionStr}". Expected format vX.YY.Z`);
  }

  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10);

  if (isNaN(major) || major < 0 || major > 9) {
    throw new Error(`Invalid major version "${parts[0]}". Must be 0–9 (cannot reach 10).`);
  }
  if (isNaN(minor) || minor < 0 || minor > 99) {
    throw new Error(`Invalid minor version "${parts[1]}". Must be 00–99 (cannot reach 100).`);
  }
  if (isNaN(patch) || patch < 0 || patch > 9) {
    throw new Error(`Invalid patch version "${parts[2]}". Must be 0–9 (cannot reach 10).`);
  }

  return { major, minor, patch };
}

/**
 * Formats SemVerHesh into canonical 'vX.YY.Z' string with zero-padded 2-digit minor.
 */
export function formatHeshVersion(v: SemVerHesh): string {
  const clampedMajor = Math.max(0, Math.min(9, v.major));
  const clampedMinor = Math.max(0, Math.min(99, v.minor));
  const clampedPatch = Math.max(0, Math.min(9, v.patch));

  const minorPadded = clampedMinor.toString().padStart(2, '0');
  return `v${clampedMajor}.${minorPadded}.${clampedPatch}`;
}

/**
 * Increments the patch version adhering to the rule: no number reaches 10.
 * 9 rolls over to 0 and increments minor.
 * 99 minor rolls over to 00 and increments major.
 * Maximum clamped at v9.99.9.
 */
export function incrementPatch(versionStr: string = CURRENT_VERSION): string {
  const { major, minor, patch } = parseHeshVersion(versionStr);

  if (major === 9 && minor === 99 && patch === 9) {
    return MAX_VERSION;
  }

  if (patch < 9) {
    return formatHeshVersion({ major, minor, patch: patch + 1 });
  }

  // Patch rolls from 9 to 0, increment minor
  return incrementMinor(formatHeshVersion({ major, minor, patch: 0 }));
}

/**
 * Increments the minor version (00..99).
 * 99 rolls over to 00 and increments major.
 */
export function incrementMinor(versionStr: string = CURRENT_VERSION): string {
  const { major, minor, patch } = parseHeshVersion(versionStr);

  if (major === 9 && minor === 99) {
    return formatHeshVersion({ major: 9, minor: 99, patch });
  }

  if (minor < 99) {
    return formatHeshVersion({ major, minor: minor + 1, patch });
  }

  // Minor rolls from 99 to 00, increment major
  return incrementMajor(formatHeshVersion({ major, minor: 0, patch }));
}

/**
 * Increments major version (0..9). Clamped at 9 (never reaches 10).
 */
export function incrementMajor(versionStr: string = CURRENT_VERSION): string {
  const { major, minor, patch } = parseHeshVersion(versionStr);
  const nextMajor = Math.min(9, major + 1);
  return formatHeshVersion({ major: nextMajor, minor, patch });
}
