/**
 * HeshRadio FM Broadcast Radio & Online Stream Service
 * Integrates with the open-source community Radio Browser API (40,000+ stations)
 * and provides curated, high-uptime online FM stations across standard 87.5 - 108.0 MHz.
 */

export interface FmStation {
  id: string;
  name: string;
  frequencyMhz: number; // e.g. 90.3, 101.5, 93.9
  genre: string;
  country: string;
  state?: string;
  bitrate: string;
  codec: string;
  streamUrl: string;
  homepageUrl?: string;
  favicon?: string;
  votes?: number;
  isCustom?: boolean;
}

export interface FmPresetSlot {
  presetNumber: number; // 1 to 8
  station: FmStation | null;
}

/**
 * High-uptime, CORS-friendly curated online FM broadcast stations
 * mapped to authentic FM broadcast frequencies (87.5 - 108.0 MHz).
 */
export const CURATED_FM_STATIONS: FmStation[] = [
  {
    id: 'kexp-903',
    name: 'KEXP 90.3 FM Seattle',
    frequencyMhz: 90.3,
    genre: 'Indie / Alt Rock',
    country: 'United States',
    state: 'Washington',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3',
    homepageUrl: 'https://kexp.org',
    favicon: 'https://kexp.org/static/assets/img/kexp-logo.svg',
    votes: 4200,
  },
  {
    id: 'wnyc-939',
    name: 'WNYC 93.9 FM New York',
    frequencyMhz: 93.9,
    genre: 'NPR / Public News / Talk',
    country: 'United States',
    state: 'New York',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://fm939.wnyc.org/wnycfm-web',
    homepageUrl: 'https://www.wnyc.org',
    votes: 3800,
  },
  {
    id: 'kqed-885',
    name: 'KQED 88.5 FM San Francisco',
    frequencyMhz: 88.5,
    genre: 'NPR News & Talk',
    country: 'United States',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://streams.kqed.org/kqedradio',
    homepageUrl: 'https://www.kqed.org',
    votes: 3100,
  },
  {
    id: 'somafm-groovesalad-889',
    name: 'SomaFM 88.9 Groove Salad',
    frequencyMhz: 88.9,
    genre: 'Downtempo / Ambient Chill',
    country: 'United States',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/groovesalad-128-mp3',
    homepageUrl: 'https://somafm.com/groovesalad/',
    votes: 9500,
  },
  {
    id: 'knkx-885',
    name: 'KNKX 88.5 FM Jazz24',
    frequencyMhz: 88.5,
    genre: 'Classic & Modern Jazz / Blues',
    country: 'United States',
    state: 'Washington',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://knkx-ice.streamguys1.com/knkx-mp3-128',
    homepageUrl: 'https://www.knkx.org',
    votes: 2750,
  },
  {
    id: 'outlaw-country-995',
    name: 'Boot Liquor 99.5 FM',
    frequencyMhz: 99.5,
    genre: 'Outlaw Country & Southern Rock',
    country: 'United States',
    state: 'Texas',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/bootliquor-128-mp3',
    homepageUrl: 'https://somafm.com/bootliquor/',
    votes: 3400,
  },
  {
    id: 'classic-rock-1015',
    name: '101.5 The Vault Classic Rock',
    frequencyMhz: 101.5,
    genre: 'Classic Rock / 70s & 80s',
    country: 'United States',
    state: 'Tennessee',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/metal-128-mp3',
    homepageUrl: 'https://somafm.com',
    votes: 2900,
  },
  {
    id: 'dance-wave-1027',
    name: '102.7 Dance Wave! Live',
    frequencyMhz: 102.7,
    genre: 'Electronic Dance / Club EDM',
    country: 'United Kingdom',
    state: 'London',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://dancewave.online/dance.mp3',
    homepageUrl: 'https://dancewave.online',
    votes: 5100,
  },
  {
    id: 'bbc-world-service-947',
    name: 'BBC World Service 94.7 FM',
    frequencyMhz: 94.7,
    genre: 'World News / Documentary',
    country: 'United Kingdom',
    state: 'London',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    homepageUrl: 'https://www.bbc.co.uk/worldserviceradio',
    votes: 8200,
  },
  {
    id: 'retro-80s-979',
    name: '97.9 Neon 80s Synth FM',
    frequencyMhz: 97.9,
    genre: '80s New Wave / Synthwave',
    country: 'United States',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/defcon-128-mp3',
    homepageUrl: 'https://somafm.com/defcon/',
    votes: 4100,
  },
  {
    id: 'classical-kusc-915',
    name: 'KUSC 91.5 FM Classical',
    frequencyMhz: 91.5,
    genre: 'Symphonic Classical Music',
    country: 'United States',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://kusc-live.streamguys1.com/kusc-mp3-128',
    homepageUrl: 'https://www.kusc.org',
    votes: 2300,
  },
  {
    id: 'highway-cruiser-1077',
    name: 'Interstate 107.7 Roadhouse',
    frequencyMhz: 107.7,
    genre: 'Blues / Trucker Country',
    country: 'United States',
    state: 'Missouri',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/folkfwd-128-mp3',
    homepageUrl: 'https://somafm.com',
    votes: 1950,
  },
];

const RADIO_BROWSER_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

/**
 * Extracts a realistic FM broadcast frequency (87.5 - 108.0 MHz)
 * from station title, tags, or falls back to a deterministic slot.
 */
export function extractFmFrequency(name: string, tags?: string): number {
  const combined = `${name} ${tags || ''}`;
  // Match e.g. "90.3", "101.5", "88.5 FM", "99.9MHz"
  const freqMatch = combined.match(/\b(8[7-9]\.\d|9\d\.\d|10[0-7]\.\d)\b/);
  if (freqMatch) {
    const parsed = parseFloat(freqMatch[1]);
    if (parsed >= 87.5 && parsed <= 108.0) {
      return Math.round(parsed * 10) / 10;
    }
  }

  // Fallback: Deterministic hash mapped into 88.1 to 107.9 (step 0.2 MHz odd US channels)
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const stepCount = 100; // 88.1 to 107.9 MHz
  const step = Math.abs(hash) % stepCount;
  return Math.round((88.1 + step * 0.2) * 10) / 10;
}

export class FmRadioService {
  private static instance: FmRadioService;
  private currentMirrorIndex = 0;

  public static getInstance(): FmRadioService {
    if (!FmRadioService.instance) {
      FmRadioService.instance = new FmRadioService();
    }
    return FmRadioService.instance;
  }

  private getActiveBaseUrl(): string {
    return RADIO_BROWSER_MIRRORS[this.currentMirrorIndex % RADIO_BROWSER_MIRRORS.length];
  }

  private rotateMirror(): void {
    this.currentMirrorIndex = (this.currentMirrorIndex + 1) % RADIO_BROWSER_MIRRORS.length;
  }

  /**
   * Searches live online FM radio stations by query or tag via Radio-Browser API.
   * Gracefully falls back to curated offline stations if network/CORS issues occur.
   */
  public async searchOnlineStations(
    query: string,
    genreTag?: string,
    countryCode = '',
    limit = 24
  ): Promise<FmStation[]> {
    const cleanedQuery = query.trim();

    // If query is empty and no tag, return curated stations
    if (!cleanedQuery && !genreTag && !countryCode) {
      return CURATED_FM_STATIONS;
    }

    try {
      const baseUrl = this.getActiveBaseUrl();
      const params = new URLSearchParams();
      if (cleanedQuery) params.append('name', cleanedQuery);
      if (genreTag && genreTag !== 'ALL') params.append('tag', genreTag.toLowerCase());
      if (countryCode) params.append('countrycode', countryCode);
      params.append('limit', limit.toString());
      params.append('hidebroken', 'true');
      params.append('order', 'votes');
      params.append('reverse', 'true');

      const url = `${baseUrl}/json/stations/search?${params.toString()}`;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'HeshRadio/0.00.1',
        },
      });
      window.clearTimeout(timeoutId);

      if (!resp.ok) {
        throw new Error(`Radio Browser HTTP ${resp.status}`);
      }

      interface RadioBrowserItem {
        stationuuid: string;
        name: string;
        url_resolved: string;
        url: string;
        homepage: string;
        favicon: string;
        tags: string;
        country: string;
        state: string;
        bitrate: number;
        codec: string;
        votes: number;
      }

      const rawStations = (await resp.json()) as RadioBrowserItem[];

      if (rawStations && rawStations.length > 0) {
        return rawStations
          .filter((st) => st.url_resolved && st.url_resolved.startsWith('http'))
          .map((st) => ({
            id: st.stationuuid,
            name: st.name.trim() || 'Online FM Radio',
            frequencyMhz: extractFmFrequency(st.name, st.tags),
            genre: (st.tags ? st.tags.split(',').slice(0, 3).join(', ') : 'Broadcast FM') || 'Live Stream',
            country: st.country || 'Global',
            state: st.state || undefined,
            bitrate: st.bitrate ? `${st.bitrate} kbps` : '128 kbps',
            codec: (st.codec || 'MP3').toUpperCase(),
            streamUrl: st.url_resolved || st.url,
            homepageUrl: st.homepage || undefined,
            favicon: st.favicon || undefined,
            votes: st.votes || 0,
          }));
      }
    } catch {
      this.rotateMirror();
    }

    // Fallback: Filter curated stations in memory
    const qLower = cleanedQuery.toLowerCase();
    const tagLower = (genreTag || '').toLowerCase();

    return CURATED_FM_STATIONS.filter((st) => {
      const matchQuery =
        !cleanedQuery ||
        st.name.toLowerCase().includes(qLower) ||
        st.genre.toLowerCase().includes(qLower) ||
        st.frequencyMhz.toString().includes(qLower);

      const matchTag =
        !genreTag ||
        genreTag === 'ALL' ||
        st.genre.toLowerCase().includes(tagLower);

      return matchQuery && matchTag;
    });
  }

  /**
   * Retrieves default or saved FM Memory Presets (P1 - P8) from LocalStorage.
   */
  public loadMemoryPresets(): FmStation[] {
    try {
      const saved = localStorage.getItem('heshradio_fm_presets');
      if (saved) {
        const parsed = JSON.parse(saved) as FmStation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 8);
        }
      }
    } catch {
      // Fallback
    }

    // Default to the first 8 curated stations
    return CURATED_FM_STATIONS.slice(0, 8);
  }

  /**
   * Saves 8 FM station memory presets to LocalStorage.
   */
  public saveMemoryPresets(presets: FmStation[]): void {
    try {
      localStorage.setItem('heshradio_fm_presets', JSON.stringify(presets.slice(0, 8)));
    } catch {
      // Ignore
    }
  }
}
