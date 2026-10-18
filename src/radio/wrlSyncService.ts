/**
 * World Radio League (WRL) Cloud Sync Service
 * Integrates directly with the official World Radio League REST API (v1)
 * https://api.worldradioleague.com/v1/contacts
 * Provides secure client-side API key management, connection testing,
 * and ADIF-to-WRL contact synchronization.
 */

import { AdifQsoRecord } from './adifLogger';

const WRL_API_BASE = 'https://api.worldradioleague.com';
const WRL_KEY_STORAGE = 'heshradio_wrl_api_key';

export interface WrlUserProfile {
  callsign: string;
  name?: string;
  defaultLogbook?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
  };
}

export interface WrlSyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}

export class WrlSyncService {
  /**
   * Retrieves stored WRL API key from localStorage.
   */
  public static getApiKey(): string {
    try {
      return localStorage.getItem(WRL_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  }

  /**
   * Saves or clears the WRL API key in localStorage.
   */
  public static setApiKey(key: string): void {
    try {
      if (key.trim()) {
        localStorage.setItem(WRL_KEY_STORAGE, key.trim());
      } else {
        localStorage.removeItem(WRL_KEY_STORAGE);
      }
    } catch {}
  }

  /**
   * Tests the WRL API connection with the provided key via GET /v1/me.
   */
  public static async testConnection(apiKey?: string): Promise<{ ok: boolean; message: string; profile?: WrlUserProfile }> {
    const key = apiKey || this.getApiKey();
    if (!key) {
      return { ok: false, message: 'No WRL API key configured. Enter your key from World Radio League.' };
    }

    try {
      const response = await fetch(`${WRL_API_BASE}/v1/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
      });

      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: 'Authentication failed: Invalid WRL API key.' };
      }

      if (!response.ok) {
        return { ok: false, message: `WRL Server returned HTTP ${response.status}: ${response.statusText}` };
      }

      const json = await response.json();
      const data = json.data || {};

      return {
        ok: true,
        message: `Connected successfully to World Radio League (${data.callsign || 'Active Operator'})!`,
        profile: {
          callsign: data.callsign || 'OPERATOR',
          name: data.name,
          defaultLogbook: data.defaultLogbook,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Network error reaching api.worldradioleague.com: ${msg}` };
    }
  }

  /**
   * Syncs a single QSO record to World Radio League via POST /v1/contacts.
   */
  public static async syncContact(record: AdifQsoRecord, apiKey?: string): Promise<{ ok: boolean; error?: string }> {
    const key = apiKey || this.getApiKey();
    if (!key) {
      return { ok: false, error: 'WRL API key missing' };
    }

    // Build ISO UTC timestamp from qsoDate (YYYYMMDD) and timeOn (HHMMSS)
    let timestampIso = new Date().toISOString();
    if (record.qsoDate.length === 8 && record.timeOn.length >= 4) {
      const y = record.qsoDate.slice(0, 4);
      const m = record.qsoDate.slice(4, 6);
      const d = record.qsoDate.slice(6, 8);
      const hh = record.timeOn.slice(0, 2);
      const mm = record.timeOn.slice(2, 4);
      const ss = record.timeOn.length >= 6 ? record.timeOn.slice(4, 6) : '00';
      timestampIso = `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
    }

    // Build POTA / SOTA activities payload if present
    const myActivities: Array<{ type: string; ref: string; isPrimary: boolean }> = [];
    if (record.potaRef) {
      myActivities.push({ type: 'POTA', ref: record.potaRef, isPrimary: true });
    }
    if (record.sotaRef) {
      myActivities.push({ type: 'SOTA', ref: record.sotaRef, isPrimary: myActivities.length === 0 });
    }

    const payload: Record<string, unknown> = {
      programId: 'HeshRadio',
      call: record.call.toUpperCase(),
      timestamp: timestampIso,
      band: record.band,
      freq: parseFloat(record.freqMhz) || undefined,
      mode: record.submode || record.mode, // WRL uses single mode field with submode preference (e.g. "FT8", "JS8")
      rstSent: record.rstSent,
      rstRcvd: record.rstRcvd,
      gridsquare: record.gridSquare,
      myGridsquare: record.myGridSquare,
      name: record.name,
      comment: record.comment,
    };

    if (myActivities.length > 0) {
      payload.myActivities = myActivities;
    }

    try {
      const response = await fetch(`${WRL_API_BASE}/v1/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const errMessage = errorJson.error?.message || errorJson.error?.code || `HTTP ${response.status}`;
        return { ok: false, error: errMessage };
      }

      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Batch syncs all unsynced records to WRL.
   */
  public static async syncAllUnsynced(
    records: AdifQsoRecord[],
    onProgress?: (synced: number, total: number) => void
  ): Promise<WrlSyncResult> {
    const key = this.getApiKey();
    if (!key) {
      return { total: 0, synced: 0, failed: 0, errors: ['WRL API key not configured'] };
    }

    const unsynced = records.filter((r) => !r.wrlSynced);
    const result: WrlSyncResult = {
      total: unsynced.length,
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < unsynced.length; i++) {
      const rec = unsynced[i];
      const res = await this.syncContact(rec, key);
      if (res.ok) {
        rec.wrlSynced = true;
        result.synced++;
      } else {
        result.failed++;
        if (res.error && !result.errors.includes(res.error)) {
          result.errors.push(`${rec.call}: ${res.error}`);
        }
      }
      if (onProgress) {
        onProgress(i + 1, unsynced.length);
      }
    }

    return result;
  }
}
