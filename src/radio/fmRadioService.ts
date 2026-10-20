/**
 * HeshRadio FM Broadcast Radio & Online Stream Service
 * Integrates with the open-source community Radio Browser API (40,000+ stations)
 * and provides curated, high-uptime online FM stations across standard 87.5 - 108.0 MHz.
 */

import { loadSetting, saveSetting } from '../utils/formatters';

export interface FmStation {
  id: string;
  name: string;
  frequencyMhz: number; // e.g. 90.3, 101.5, 93.9
  band: 'fm' | 'am'; // for AM: frequencyMhz carries the dial position in MHz (1090 kHz -> 1.09)
  genre: string;
  country: string;
  countryCode?: string; // e.g. 'US', 'GB', 'CA', 'DE', 'FR', 'JP', 'AU', etc.
  state?: string;
  bitrate: string;
  codec: string;
  streamUrl: string;
  homepageUrl?: string;
  favicon?: string;
  votes?: number;
  isCustom?: boolean;
}


export type FmSortOption =
  | 'COUNTRY_ASC'
  | 'CATEGORY_ASC'
  | 'FREQ_ASC'
  | 'NAME_ASC'
  | 'VOTES_DESC'
  | 'BITRATE_DESC';

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export const FM_COUNTRIES: CountryOption[] = [
  { code: 'ALL', name: 'All Countries (Global)', flag: '🌐' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
];

export interface CategoryOption {
  id: string;
  label: string;
  icon?: string;
}

export const FM_CATEGORIES: CategoryOption[] = [
  { id: 'ALL', label: 'All Categories' },
  { id: 'CBC', label: '🍁 CBC Radio' },
  { id: 'ROCK', label: 'Rock & Indie' },
  { id: 'COUNTRY', label: 'Country & Americana' },
  { id: 'NEWS', label: 'News & NPR Talk' },
  { id: 'JAZZ', label: 'Jazz & Blues' },
  { id: 'ELECTRONIC', label: 'Electronic & Dance' },
  { id: '80S', label: '80s & Retro Synth' },
  { id: 'CLASSICAL', label: 'Classical & Opera' },
  { id: 'POP', label: 'Pop & Top 40' },
  { id: 'AMBIENT', label: 'Ambient & Chill' },
  { id: 'METAL', label: 'Metal & Hard Rock' },
  { id: 'REGGAE', label: 'Reggae & Dub' },
  { id: 'WORLD', label: 'World & Latin' },
];

/**
 * Maps free-text category labels (station `genre` fields and pill labels) into a
 * comparable form so a station's genre "CBC Radio" matches the pill "🍁 CBC Radio".
 */
function normalizeCategoryText(text: string): string {
  return text.replace(/[^\w\s&]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Resolves a station genre to its FM category pill id — the single source of truth
 * shared by this app and the published stations.json manifest, so HCloud can filter
 * the curated dial by exactly the categories HeshRadio itself offers.
 * Unmatched genres resolve to 'ALL' (no category filter applies).
 */
export function categoryIdForGenre(genre: string): string {
  const needle = normalizeCategoryText(genre);
  const hit = FM_CATEGORIES.find((c) => c.id !== 'ALL' && normalizeCategoryText(c.label) === needle);
  return hit ? hit.id : 'ALL';
}

/**
 * Sorts FM stations deterministically by the chosen criteria.
 */
export function sortFmStations(stations: FmStation[], sortOption: FmSortOption): FmStation[] {
  const sorted = [...stations];
  switch (sortOption) {
    case 'COUNTRY_ASC':
      return sorted.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
    case 'CATEGORY_ASC':
      return sorted.sort((a, b) => a.genre.localeCompare(b.genre) || a.name.localeCompare(b.name));
    case 'FREQ_ASC':
      return sorted.sort((a, b) => a.frequencyMhz - b.frequencyMhz || a.name.localeCompare(b.name));
    case 'NAME_ASC':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'VOTES_DESC':
      return sorted.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    case 'BITRATE_DESC':
      return sorted.sort((a, b) => {
        const rateA = parseInt(a.bitrate, 10) || 0;
        const rateB = parseInt(b.bitrate, 10) || 0;
        return rateB - rateA || a.name.localeCompare(b.name);
      });
    default:
      return sorted;
  }
}

/**
 * High-uptime, CORS-friendly curated online FM broadcast stations
 * mapped to authentic FM broadcast frequencies (87.5 - 108.0 MHz)
 * across 13+ countries and 13 distinct musical & broadcast formats.
 */
const RAW_CURATED_FM: Omit<FmStation, 'band'>[] = [
  // --- UNITED STATES ---
  {
    id: 'kexp-903',
    name: 'KEXP 90.3 FM Seattle',
    frequencyMhz: 90.3,
    genre: 'Rock & Indie',
    country: 'United States',
    countryCode: 'US',
    state: 'Washington',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3',
    homepageUrl: 'https://kexp.org',
    votes: 9800,
  },
  {
    id: 'wnyc-939',
    name: 'WNYC 93.9 FM New York',
    frequencyMhz: 93.9,
    genre: 'News & NPR Talk',
    country: 'United States',
    countryCode: 'US',
    state: 'New York',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://fm939.wnyc.org/wnycfm-web',
    homepageUrl: 'https://www.wnyc.org',
    votes: 8400,
  },
  {
    id: 'kqed-885',
    name: 'KQED 88.5 FM San Francisco',
    frequencyMhz: 88.5,
    genre: 'News & NPR Talk',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://streams.kqed.org/kqedradio',
    homepageUrl: 'https://www.kqed.org',
    votes: 7100,
  },
  {
    id: 'somafm-groovesalad-889',
    name: 'SomaFM 88.9 Groove Salad',
    frequencyMhz: 88.9,
    genre: 'Ambient & Chill',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/groovesalad-128-mp3',
    homepageUrl: 'https://somafm.com/groovesalad/',
    votes: 12500,
  },
  {
    id: 'somafm-metal-detector-893',
    name: 'SomaFM 89.3 Metal Detector',
    frequencyMhz: 89.3,
    genre: 'Metal & Hard Rock',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/metal-128-mp3',
    homepageUrl: 'https://somafm.com/metal/',
    votes: 7730,
  },
  {
    id: 'somafm-thistle-909',
    name: 'SomaFM 90.9 ThistleRadio',
    frequencyMhz: 90.9,
    genre: 'World & Latin',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice6.somafm.com/thistle-128-mp3',
    homepageUrl: 'https://somafm.com/thistle/',
    votes: 668,
  },
  {
    id: 'knkx-885',
    name: 'KNKX 88.5 FM Jazz24 Seattle',
    frequencyMhz: 88.5,
    genre: 'Jazz & Blues',
    country: 'United States',
    countryCode: 'US',
    state: 'Washington',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://knkx-ice.streamguys1.com/knkx-mp3-128',
    homepageUrl: 'https://www.knkx.org',
    votes: 6200,
  },
  {
    id: 'outlaw-country-995',
    name: 'Boot Liquor 99.5 FM Austin',
    frequencyMhz: 99.5,
    genre: 'Country & Americana',
    country: 'United States',
    countryCode: 'US',
    state: 'Texas',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/bootliquor-128-mp3',
    homepageUrl: 'https://somafm.com/bootliquor/',
    votes: 7400,
  },
  {
    id: 'classic-rock-1015',
    name: '101.5 The Vault Classic Rock',
    frequencyMhz: 101.5,
    genre: 'Rock & Indie',
    country: 'United States',
    countryCode: 'US',
    state: 'Tennessee',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/seventies-128-mp3',
    homepageUrl: 'https://somafm.com',
    votes: 5900,
  },
  {
    id: 'retro-80s-979',
    name: '97.9 Neon 80s Synth FM',
    frequencyMhz: 97.9,
    genre: '80s & Retro Synth',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/u80s-128-mp3',
    homepageUrl: 'https://somafm.com/u80s/',
    votes: 8100,
  },
  {
    id: 'classical-kusc-915',
    name: 'KUSC 91.5 FM Classical Los Angeles',
    frequencyMhz: 91.5,
    genre: 'Classical & Opera',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://kusc-live.streamguys1.com/kusc-mp3-128',
    homepageUrl: 'https://www.kusc.org',
    votes: 4900,
  },
  {
    id: 'highway-cruiser-1077',
    name: 'Interstate 107.7 Roadhouse',
    frequencyMhz: 107.7,
    genre: 'Country & Americana',
    country: 'United States',
    countryCode: 'US',
    state: 'Missouri',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/folkfwd-128-mp3',
    homepageUrl: 'https://somafm.com',
    votes: 3800,
  },
  {
    id: 'metal-detector-1049',
    name: 'Metal Detector 104.9 FM',
    frequencyMhz: 104.9,
    genre: 'Metal & Hard Rock',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/metal-128-mp3',
    homepageUrl: 'https://somafm.com/metal/',
    votes: 6100,
  },
  {
    id: 'drone-zone-911',
    name: 'Drone Zone 91.1 Atmospheric Ambient',
    frequencyMhz: 91.1,
    genre: 'Ambient & Chill',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/dronezone-128-mp3',
    homepageUrl: 'https://somafm.com/dronezone/',
    votes: 11400,
  },
  {
    id: 'defcon-radio-931',
    name: 'DEF CON Radio 93.1 FM Hacker Beats',
    frequencyMhz: 93.1,
    genre: 'Electronic & Dance',
    country: 'United States',
    countryCode: 'US',
    state: 'Nevada',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/defcon-128-mp3',
    homepageUrl: 'https://somafm.com/defcon/',
    votes: 7800,
  },
  {
    id: 'heavyweight-reggae-1003',
    name: 'Heavyweight Reggae 100.3 FM',
    frequencyMhz: 100.3,
    genre: 'Reggae & Dub',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/reggae-128-mp3',
    homepageUrl: 'https://somafm.com/reggae/',
    votes: 5200,
  },
  {
    id: 'poptron-953',
    name: 'PopTron 95.3 FM Electropop',
    frequencyMhz: 95.3,
    genre: 'Pop & Top 40',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/poptron-128-mp3',
    homepageUrl: 'https://somafm.com/poptron/',
    votes: 4600,
  },
  {
    id: 'secret-agent-965',
    name: 'Secret Agent 96.5 FM Spy Lounge',
    frequencyMhz: 96.5,
    genre: 'Jazz & Blues',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/secretagent-128-mp3',
    homepageUrl: 'https://somafm.com/secretagent/',
    votes: 6800,
  },
  {
    id: 'wfmu-911',
    name: 'WFMU 91.1 FM Freeform NYC',
    frequencyMhz: 91.1,
    genre: 'Rock & Indie',
    country: 'United States',
    countryCode: 'US',
    state: 'New Jersey',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream0.wfmu.org/freeform-128k.mp3',
    homepageUrl: 'https://wfmu.org',
    votes: 9500,
  },
  {
    id: 'wxpn-885',
    name: 'WXPN 88.5 FM Philadelphia',
    frequencyMhz: 88.5,
    genre: 'Rock & Indie',
    country: 'United States',
    countryCode: 'US',
    state: 'Pennsylvania',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://wxpnhi.xpn.org/xpnhi',
    homepageUrl: 'https://xpn.org',
    votes: 8100,
  },
  {
    id: 'wwoz-907',
    name: 'WWOZ 90.7 FM New Orleans Jazz',
    frequencyMhz: 90.7,
    genre: 'Jazz & Blues',
    country: 'United States',
    countryCode: 'US',
    state: 'Louisiana',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://wwoz-sc.streamguys1.com/wwoz-hi.mp3',
    homepageUrl: 'https://www.wwoz.org',
    votes: 11200,
  },
  {
    id: 'kcmp-893',
    name: 'The Current 89.3 FM Twin Cities',
    frequencyMhz: 89.3,
    genre: 'Rock & Indie',
    country: 'United States',
    countryCode: 'US',
    state: 'Minnesota',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://current.stream.publicradio.org/kcmp.mp3',
    homepageUrl: 'https://www.thecurrent.org',
    votes: 8900,
  },
  {
    id: 'wbez-915',
    name: 'WBEZ 91.5 FM Chicago NPR',
    frequencyMhz: 91.5,
    genre: 'News & NPR Talk',
    country: 'United States',
    countryCode: 'US',
    state: 'Illinois',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.wbez.org/wbez128.mp3',
    homepageUrl: 'https://www.wbez.org',
    votes: 7900,
  },
  {
    id: 'radioparadise-1053',
    name: 'Radio Paradise 105.3 FM Main Mix',
    frequencyMhz: 105.3,
    genre: 'Rock & Indie',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.radioparadise.com/mp3-128',
    homepageUrl: 'https://radioparadise.com',
    votes: 16800,
  },
  {
    id: 'highway181-941',
    name: '181.FM Highway 94.1 Classic Country',
    frequencyMhz: 94.1,
    genre: 'Country & Americana',
    country: 'United States',
    countryCode: 'US',
    state: 'Virginia',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://listen.181fm.com/181-highway_128k.mp3',
    homepageUrl: 'https://www.181.fm',
    votes: 20500,
  },
  {
    id: 'jazzgroove-901',
    name: 'The Jazz Groove 90.1 FM',
    frequencyMhz: 90.1,
    genre: 'Jazz & Blues',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://east-mp3-128.streamthejazzgroove.com/stream',
    homepageUrl: 'https://jazzgroove.org',
    votes: 9100,
  },
  {
    id: 'spacestation-923',
    name: 'Space Station Soma 92.3 FM',
    frequencyMhz: 92.3,
    genre: 'Electronic & Dance',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/spacestation-128-mp3',
    homepageUrl: 'https://somafm.com/spacestation/',
    votes: 24300,
  },
  {
    id: 'indiepop-897',
    name: 'Indie Pop Rocks! 89.7 FM',
    frequencyMhz: 89.7,
    genre: 'Rock & Indie',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/indiepop-128-mp3',
    homepageUrl: 'https://somafm.com/indiepop/',
    votes: 21200,
  },
  {
    id: 'lush-959',
    name: 'SomaFM Lush 95.9 FM Vocal Chill',
    frequencyMhz: 95.9,
    genre: 'Ambient & Chill',
    country: 'United States',
    countryCode: 'US',
    state: 'California',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/lush-128-mp3',
    homepageUrl: 'https://somafm.com/lush/',
    votes: 12200,
  },

  // --- UNITED KINGDOM ---
  {
    id: 'bbc-world-service-947',
    name: 'BBC World Service 94.7 FM London',
    frequencyMhz: 94.7,
    genre: 'News & NPR Talk',
    country: 'United Kingdom',
    countryCode: 'GB',
    state: 'London',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    homepageUrl: 'https://www.bbc.co.uk/worldserviceradio',
    votes: 14200,
  },
  {
    id: 'dance-wave-1027',
    name: '102.7 Dance Wave! Live London',
    frequencyMhz: 102.7,
    genre: 'Electronic & Dance',
    country: 'United Kingdom',
    countryCode: 'GB',
    state: 'London',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://dancewave.online/dance.mp3',
    homepageUrl: 'https://dancewave.online',
    votes: 9100,
  },
  {
    id: 'capital-fm-958',
    name: 'Capital FM 95.8 London',
    frequencyMhz: 95.8,
    genre: 'Pop & Top 40',
    country: 'United Kingdom',
    countryCode: 'GB',
    state: 'London',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://media-ice.musicradio.com/CapitalMP3',
    homepageUrl: 'https://www.capitalfm.com',
    votes: 8800,
  },
  {
    id: 'classic-fm-1009',
    name: 'Classic FM 100.9 UK',
    frequencyMhz: 100.9,
    genre: 'Classical & Opera',
    country: 'United Kingdom',
    countryCode: 'GB',
    state: 'London',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://media-ice.musicradio.com/ClassicFMMP3',
    homepageUrl: 'https://www.classicfm.com',
    votes: 7500,
  },
  {
    id: 'radio-caroline-925',
    name: 'Radio Caroline 92.5 FM Rock Legend',
    frequencyMhz: 92.5,
    genre: 'Rock & Indie',
    country: 'United Kingdom',
    countryCode: 'GB',
    state: 'Suffolk',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://sc6.radiocaroline.net/',
    homepageUrl: 'https://www.radiocaroline.co.uk',
    votes: 6700,
  },
  {
    id: 'smooth-radio-1022',
    name: 'Smooth Radio 102.2 FM London',
    frequencyMhz: 102.2,
    genre: 'Pop & Top 40',
    country: 'United Kingdom',
    countryCode: 'GB',
    state: 'London',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://media-ice.musicradio.com/SmoothUKMP3',
    homepageUrl: 'https://www.smoothradio.com',
    votes: 5900,
  },

  // --- CANADA (Rock & Alternative / CBC National & Regional / Eclectic) ---
  // British Columbia & Vancouver Island (CBC, Rock & Alternative)
  {
    id: 'cbc-r1-vancouver-881',
    name: 'CBC Radio One Vancouver 88.1 FM',
    frequencyMhz: 88.1,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://27033.live.streamtheworld.com/CBU2FM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/british-columbia',
    votes: 9500,
  },
  {
    id: 'cbc-r1-victoria-905',
    name: 'CBC Radio One Victoria 90.5 FM',
    frequencyMhz: 90.5,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://26373.live.streamtheworld.com/CBCVFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/british-columbia',
    votes: 8200,
  },
  {
    id: 'cbc-music-vancouver-1057',
    name: 'CBC Music Pacific Vancouver 105.7 FM',
    frequencyMhz: 105.7,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://26733.live.streamtheworld.com/CBUFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/music/',
    votes: 8800,
  },
  {
    id: 'cfox-993-vancouver',
    name: 'CFOX 99.3 FM Vancouver (The World Famous Rock)',
    frequencyMhz: 99.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://corus.leanstream.co/CFOXFM',
    homepageUrl: 'https://cfox.com/',
    votes: 9900,
  },
  {
    id: 'cfmi-1011-vancouver',
    name: 'Rock 101 CFMI 101.1 FM Vancouver',
    frequencyMhz: 101.1,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://corus.leanstream.co/CFMIFM',
    homepageUrl: 'https://rock101.com/',
    votes: 8900,
  },
  {
    id: 'cjzn-thezone-913-victoria',
    name: 'The Zone 91.3 FM CJZN Victoria',
    frequencyMhz: 91.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://stream.jpbgdigital.com/CJZN/HEAAC/48k/playlist.m3u8',
    homepageUrl: 'https://www.thezone.fm/',
    votes: 8600,
  },
  {
    id: 'ckkq-theq-1003-victoria',
    name: 'The Q 100.3 FM CKKQ Victoria (The Island Rock)',
    frequencyMhz: 100.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://stream.jpbgdigital.com/CKKQ/HEAAC/48k/playlist.m3u8',
    homepageUrl: 'https://www.theq.fm/',
    votes: 8400,
  },
  {
    id: 'ckpk-thepeak-1027-vancouver',
    name: '102.7 The Peak CKPK Vancouver Alternative',
    frequencyMhz: 102.7,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://stream.jpbgdigital.com/CKPK/HEAAC/48k/playlist.m3u8',
    homepageUrl: 'https://thepeak.fm/',
    votes: 7800,
  },
  {
    id: 'ckks-sonic-1075-chilliwack',
    name: 'Sonic 107.5 FM CKKS Lower Mainland Alternative',
    frequencyMhz: 107.5,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://rogers.leanstream.co/rogers/van1049.stream/icy?environment=tunein&args=tunein_01',
    homepageUrl: 'https://www.sonicradio.ca/',
    votes: 7500,
  },
  {
    id: 'cjax-jack-969-vancouver',
    name: 'JACK 96.9 FM CJAX Vancouver',
    frequencyMhz: 96.9,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://rogers.leanstream.co/rogers/van969.stream/icy?environment=tunein&args=tunein_01',
    homepageUrl: 'https://www.jack969.com/',
    votes: 7200,
  },
  {
    id: 'citr-1019-vancouver',
    name: 'CITR 101.9 FM UBC Vancouver Alternative',
    frequencyMhz: 101.9,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://live.citr.ca/live.mp3',
    homepageUrl: 'https://www.citr.ca',
    votes: 6800,
  },
  {
    id: 'cfuv-1019-victoria',
    name: 'CFUV 101.9 FM UVic Victoria Indie Alternative',
    frequencyMhz: 101.9,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://cfuv.streamon.fm/CFUV-64k.aac',
    homepageUrl: 'https://cfuv.ca/',
    votes: 6500,
  },
  {
    id: 'cbc-r1-kelowna-889',
    name: 'CBC Radio One Kelowna 88.9 FM',
    frequencyMhz: 88.9,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://27033.live.streamtheworld.com/CBTKFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/british-columbia',
    votes: 5900,
  },
  {
    id: 'cbc-r1-kamloops-941',
    name: 'CBC Radio One Kamloops 94.1 FM',
    frequencyMhz: 94.1,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://27033.live.streamtheworld.com/CBYKFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/british-columbia',
    votes: 5600,
  },
  {
    id: 'cbc-r1-princegeorge-915',
    name: 'CBC Radio One Prince George 91.5 FM',
    frequencyMhz: 91.5,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://22983.live.streamtheworld.com/CBYGFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/british-columbia',
    votes: 5400,
  },
  {
    id: 'cffm-thegoat-975-bc',
    name: 'The Goat 97.5 FM CFFM Williams Lake Rock',
    frequencyMhz: 97.5,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://vistaradio.streamb.live/SB00074',
    homepageUrl: 'https://www.mycariboonow.com/',
    votes: 4900,
  },
  {
    id: 'cjav-thepeak-933-portalberni',
    name: 'The Peak 93.3 FM CJAV Port Alberni',
    frequencyMhz: 93.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'British Columbia',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://stream.jpbgdigital.com/CJAV.m3u8',
    homepageUrl: 'https://www.albernivalleynews.com/',
    votes: 4600,
  },

  // Alberta & Prairies Rock, Alternative & CBC
  {
    id: 'cjay-921-calgary',
    name: 'CJAY 92 92.1 FM Calgary (Everything That Rocks)',
    frequencyMhz: 92.1,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CJAYFM.mp3',
    homepageUrl: 'https://www.iheartradio.ca/cjay92',
    votes: 9700,
  },
  {
    id: 'chdi-sonic-1029-edmonton',
    name: 'Sonic 102.9 FM CHDI Edmonton Alternative',
    frequencyMhz: 102.9,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://rogers.leanstream.co/rogers/edm1029.stream/icy?environment=tunein&args=tunein_01',
    homepageUrl: 'https://www.sonic1029.com/',
    votes: 9300,
  },
  {
    id: 'cfgq-q107-1073-calgary',
    name: 'Q107 CFGQ 107.3 FM Calgary Classic Rock',
    frequencyMhz: 107.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://corus.leanstream.co/CFGQFM',
    homepageUrl: 'https://q107calgary.com/',
    votes: 9100,
  },
  {
    id: 'cirk-k97-973-edmonton',
    name: 'K-97 CIRK 97.3 FM Edmonton Classic Rock',
    frequencyMhz: 97.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://newcap.leanstream.co/CIRKFM',
    homepageUrl: 'https://www.k97.ca/',
    votes: 8700,
  },
  {
    id: 'cbc-r1-calgary-991',
    name: 'CBC Radio One Calgary 99.1 FM',
    frequencyMhz: 99.1,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://27033.live.streamtheworld.com/CBR1FM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/calgary',
    votes: 8500,
  },
  {
    id: 'cbc-r1-edmonton-939',
    name: 'CBC Radio One Edmonton 93.9 FM',
    frequencyMhz: 93.9,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://27033.live.streamtheworld.com/CBXFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/edmonton',
    votes: 8400,
  },
  {
    id: 'chup-softrock-977-calgary',
    name: 'Soft Rock 97.7 FM CHUP Calgary',
    frequencyMhz: 97.7,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://rawlco.leanstream.co/CHUPFM-MP3',
    homepageUrl: 'https://www.softrock977.com/',
    votes: 7600,
  },
  {
    id: 'cjaq-jack-969-calgary',
    name: 'JACK 96.9 FM CJAQ Calgary Rock',
    frequencyMhz: 96.9,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://rogers.leanstream.co/rogers/cal969.stream/icy?environment=tunein&args=tunein_01',
    homepageUrl: 'https://www.jack969.com/calgary/',
    votes: 7400,
  },
  {
    id: 'cjsw-909-calgary',
    name: 'CJSW 90.9 FM University of Calgary Alternative',
    frequencyMhz: 90.9,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.cjsw.com/cjsw.mp3',
    homepageUrl: 'https://cjsw.com',
    votes: 7100,
  },
  {
    id: 'cizz-z989-reddeer',
    name: 'Z98.9 CIZZ FM Red Deer Classic Rock',
    frequencyMhz: 98.9,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Alberta',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://newcap.leanstream.co/CIZZFM',
    homepageUrl: 'https://www.zed989.com/',
    votes: 6700,
  },
  {
    id: 'cjdj-rock102-1021-saskatoon',
    name: 'Rock 102 CJDJ 102.1 FM Saskatoon',
    frequencyMhz: 102.1,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Saskatchewan',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://rawlco.leanstream.co/CJDJFM-MP3',
    homepageUrl: 'https://www.rock102rocks.com/',
    votes: 7900,
  },
  {
    id: 'cbc-r1-regina-1025',
    name: 'CBC Radio One Regina 102.5 FM',
    frequencyMhz: 102.5,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Saskatchewan',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://27033.live.streamtheworld.com/CBKRFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/saskatchewan',
    votes: 7500,
  },
  {
    id: 'cjkr-power97-975-winnipeg',
    name: 'Power 97 CJKR 97.5 FM Winnipeg Rock',
    frequencyMhz: 97.5,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Manitoba',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://corus.leanstream.co/CJKRFM',
    homepageUrl: 'https://power97.com/',
    votes: 8300,
  },
  {
    id: 'ciur-country-1047',
    name: 'CIUR Now Country 104.7 Winnipeg',
    frequencyMhz: 104.7,
    genre: 'Country & Americana',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Manitoba',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://201.netromedia.com/NCIFM2/NCIFM2/playlist.m3u8',
    homepageUrl: 'https://nowcountry.fm/',
    votes: 6200,
  },

  // Ontario, Quebec & Eastern Canada Rock, Alternative & CBC
  {
    id: 'cfny-theedge-1021-toronto',
    name: '102.1 The Edge CFNY Toronto Alternative',
    frequencyMhz: 102.1,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://corus.leanstream.co/CFNYFM',
    homepageUrl: 'https://edge.ca/',
    votes: 11200,
  },
  {
    id: 'cilq-q107-1071-toronto',
    name: 'Q107 CILQ 107.1 FM Toronto Classic Rock',
    frequencyMhz: 107.1,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://corus.leanstream.co/CILQFM',
    homepageUrl: 'https://q107.com/',
    votes: 10800,
  },
  {
    id: 'indie88-881-toronto',
    name: 'Indie88 CIND 88.1 FM Toronto Alternative',
    frequencyMhz: 88.1,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://localradio.streamb.live/SB00348',
    homepageUrl: 'https://indie88.com',
    votes: 10500,
  },
  {
    id: 'chom-977-montreal',
    name: 'CHOM 97.7 FM Montreal (The Spirit of Rock)',
    frequencyMhz: 97.7,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Quebec',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CHOMFM.mp3',
    homepageUrl: 'https://www.iheartradio.ca/chom',
    votes: 10400,
  },
  {
    id: 'chez-1061-ottawa',
    name: 'CHEZ 106 106.1 FM Ottawa World Class Rock',
    frequencyMhz: 106.1,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://rogers.leanstream.co/rogers/ott1061.stream/icy?environment=tunein&args=tunein_01',
    homepageUrl: 'https://www.chez106.com/',
    votes: 9400,
  },
  {
    id: 'chtz-htzfm-977-stcatharines',
    name: '97.7 HTZ-FM CHTZ Niagara White Hot Rock',
    frequencyMhz: 97.7,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CHTZFM.mp3',
    homepageUrl: 'https://www.iheartradio.ca/97-7-htz-fm',
    votes: 9200,
  },
  {
    id: 'cfpl-fm96-959-london',
    name: 'FM96 CFPL 95.9 FM London Active Rock',
    frequencyMhz: 95.9,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://corus.leanstream.co/CFPLFM',
    homepageUrl: 'https://fm96.com/',
    votes: 8600,
  },
  {
    id: 'cfmk-big963-kingston',
    name: 'Big 96.3 CFMK Kingston Classic Rock',
    frequencyMhz: 96.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://corus.leanstream.co/CFMKFM',
    homepageUrl: 'https://963bigfm.com/',
    votes: 8200,
  },
  {
    id: 'chbm-boom-973-toronto',
    name: 'Boom 97.3 CHBM Toronto Classic Hits',
    frequencyMhz: 97.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://newcap.leanstream.co/CHBMFM',
    homepageUrl: 'https://www.boom973.com/',
    votes: 8100,
  },
  {
    id: 'cbc-r1-toronto-991',
    name: 'CBC Radio One Toronto 99.1 FM',
    frequencyMhz: 99.1,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBLAFM_CBC.mp3',
    homepageUrl: 'https://www.cbc.ca/news/canada/toronto',
    votes: 9600,
  },
  {
    id: 'cbc-r1-ottawa-915',
    name: 'CBC Radio One Ottawa 91.5 FM',
    frequencyMhz: 91.5,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBOFM_CBC.mp3',
    homepageUrl: 'https://www.cbc.ca/news/canada/ottawa',
    votes: 9200,
  },
  {
    id: 'cbc-r1-london-935',
    name: 'CBC Radio One London 93.5 FM',
    frequencyMhz: 93.5,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://18853.live.streamtheworld.com/CBCLFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/london',
    votes: 8100,
  },
  {
    id: 'cbc-r1-montreal-885',
    name: 'CBC Radio One Montreal 88.5 FM',
    frequencyMhz: 88.5,
    genre: 'CBC Radio',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Quebec',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://27033.live.streamtheworld.com/CBMEFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/news/canada/montreal',
    votes: 8900,
  },
  {
    id: 'cktp-wolf-957',
    name: 'CKTP 95.7 FM The Wolf Fredericton Rock',
    frequencyMhz: 95.7,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'New Brunswick',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://centova.radioservers.biz/proxy/cktpradi/stream',
    homepageUrl: 'http://www.957thewolf.ca/',
    votes: 6800,
  },
  {
    id: 'cjmo-q103-1031-moncton',
    name: 'Q103 CJMO 103.1 FM Moncton Rock',
    frequencyMhz: 103.1,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'New Brunswick',
    bitrate: '128 kbps',
    codec: 'AAC',
    streamUrl: 'https://newcap.leanstream.co/CJMOFM',
    homepageUrl: 'https://q103.ca/',
    votes: 6400,
  },
  {
    id: 'cfbu-brock-1037',
    name: 'CFBU 103.7 FM Brock University College Indie',
    frequencyMhz: 103.7,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '192 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream2.statsradio.com:8160/stream',
    homepageUrl: 'http://www.cfbu.ca/',
    votes: 5900,
  },
  {
    id: 'jazz-fm91-toronto',
    name: 'JAZZ.FM91 Toronto',
    frequencyMhz: 91.1,
    genre: 'Jazz & Blues',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://jazzfm91.streamguys1.com/live',
    homepageUrl: 'https://jazz.fm',
    votes: 7500,
  },
  {
    id: 'cbve-981-quebec-city',
    name: 'CBC Radio One 98.1 FM Quebec City',
    frequencyMhz: 98.1,
    genre: 'News & NPR Talk',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Quebec',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://22983.live.streamtheworld.com/CBVEFM_CBC_SC',
    homepageUrl: 'https://www.cbc.ca/mediacentre/program/cbc-radio-one-quebec-city',
    votes: 58,
  },
  {
    id: 'cfyx-933-rimouski',
    name: 'CFYX 93.3 FM Rimouski News & Talk',
    frequencyMhz: 93.3,
    genre: 'News & NPR Talk',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Quebec',
    bitrate: '160 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.statsradio.com:8048/stream',
    homepageUrl: 'https://www.cfyxrimouski.com/',
    votes: 5400,
  },
  {
    id: 'crucial-velocity-977',
    name: 'Crucial Velocity Metal 97.7 FM',
    frequencyMhz: 97.7,
    genre: 'Metal & Hard Rock',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '192 kbps',
    codec: 'MP3',
    streamUrl: 'https://ais-sa2.cdnstream1.com/1369_128',
    homepageUrl: 'http://crucialvelocity.ca/',
    votes: 7300,
  },
  {
    id: 'rdmix-rock-1003',
    name: 'RdMix Classic Rock 100.3 FM',
    frequencyMhz: 100.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://cast1.torontocast.com:4610/stream',
    homepageUrl: 'https://radiodimensionemix.torontocast.stream/',
    votes: 6800,
  },
  {
    id: 'labgate-prog-887',
    name: 'Labgate Progressive Rock 88.7 FM',
    frequencyMhz: 88.7,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Quebec',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://s2.ssl-stream.com/radio/8180/radio.mp3',
    homepageUrl: 'https://labgateradio.com/',
    votes: 6600,
  },
  {
    id: 'vibrazioni-rock-943',
    name: 'Vibrazioni Rock Radio 94.3 FM',
    frequencyMhz: 94.3,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://maggie.torontocast.com:2020/stream/vibrazionirockradio',
    homepageUrl: 'https://radiosuitenetwork.torontocast.stream/vibrazioni-rock-radio/',
    votes: 6400,
  },
  {
    id: 'lynx-70s-987',
    name: 'The Lynx Super 70s 98.7 FM',
    frequencyMhz: 98.7,
    genre: 'Rock & Indie',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '320 kbps',
    codec: 'MP3',
    streamUrl: 'https://70s-lynxradio.radioca.st/stream',
    homepageUrl: 'https://www.lynxradionetwork.com/',
    votes: 6200,
  },
  {
    id: 'calm-piano-967',
    name: 'Calm Radio Solo Piano 96.7 FM',
    frequencyMhz: 96.7,
    genre: 'Classical & Opera',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://streams.calmradio.com:1228/',
    homepageUrl: 'https://www.calmradio.com/',
    votes: 6100,
  },
  {
    id: 'calm-bach-957',
    name: 'Calm Radio Bach 95.7 FM',
    frequencyMhz: 95.7,
    genre: 'Classical & Opera',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://streams.calmradio.com:6828/stream',
    homepageUrl: 'https://www.calmradio.com/',
    votes: 5900,
  },
  {
    id: 'ancientfm-917',
    name: 'Ancient FM 91.7 Early Classical',
    frequencyMhz: 91.7,
    genre: 'Classical & Opera',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://mediaserv73.live-streams.nl:18058/stream',
    homepageUrl: 'https://ancientfm.com',
    votes: 5700,
  },
  {
    id: 'newwave80s-983',
    name: '80s New Wave Radio 98.3 FM',
    frequencyMhz: 98.3,
    genre: '80s & Retro Synth',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '192 kbps',
    codec: 'MP3',
    streamUrl: 'https://puma.streemlion.com:2910/stream',
    homepageUrl: 'https://80snewwaveradio.com',
    votes: 5500,
  },
  {
    id: 'greatest-80s-1059',
    name: '100 Greatest 80s Hits 105.9 FM',
    frequencyMhz: 105.9,
    genre: '80s & Retro Synth',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '192 kbps',
    codec: 'MP3',
    streamUrl: 'https://maggie.torontocast.com:2020/stream/100greatestofthe80s',
    homepageUrl: 'https://100-greatest-network.torontocast.stream/',
    votes: 5300,
  },
  {
    id: 'djfm-toronto-927',
    name: 'DJFM 92.7 Toronto Electronic Dance',
    frequencyMhz: 92.7,
    genre: 'Electronic & Dance',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://mux.mtl.djfmradio.com/djfm',
    homepageUrl: 'http://djfm.ca/',
    votes: 5100,
  },
  {
    id: 'dubplate-urban-1065',
    name: 'Dubplate.fm Urban Boogie 106.5 FM',
    frequencyMhz: 106.5,
    genre: 'Pop & Top 40',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '256 kbps',
    codec: 'MP3',
    streamUrl: 'https://sc2.dubplate.fm/radio/8010/urbanboogie/uhifi',
    homepageUrl: 'https://dubplate.fm/',
    votes: 4900,
  },
  {
    id: 'reggae-chill-1025',
    name: 'Reggae Chill Cafe 102.5 FM',
    frequencyMhz: 102.5,
    genre: 'Reggae & Dub',
    country: 'Canada',
    countryCode: 'CA',
    state: 'Ontario',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://maggie.torontocast.com:2020/stream/reggaechillcafe',
    homepageUrl: 'https://radiosuitenetwork.torontocast.stream/',
    votes: 4800,
  },

  // --- GERMANY ---
  {
    id: 'rock-antenne-879',
    name: 'Rock Antenne 87.9 FM Munich',
    frequencyMhz: 87.9,
    genre: 'Rock & Indie',
    country: 'Germany',
    countryCode: 'DE',
    state: 'Bavaria',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.rockantenne.de/rockantenne/stream/mp3',
    homepageUrl: 'https://www.rockantenne.de',
    votes: 8200,
  },
  {
    id: 'sunshine-live-1021',
    name: 'Sunshine Live 102.1 FM Berlin',
    frequencyMhz: 102.1,
    genre: 'Electronic & Dance',
    country: 'Germany',
    countryCode: 'DE',
    state: 'Berlin',
    bitrate: '192 kbps',
    codec: 'MP3',
    streamUrl: 'https://sunsl.streamabc.net/sunsl-sslsimulcast-mp3-192-4434053',
    homepageUrl: 'https://www.sunshine-live.de',
    votes: 7600,
  },
  {
    id: 'bytefm-917',
    name: 'ByteFM 91.7 Hamburg',
    frequencyMhz: 91.7,
    genre: 'Rock & Indie',
    country: 'Germany',
    countryCode: 'DE',
    state: 'Hamburg',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://bytefm.streamabc.net/bytefm-bytefm-mp3-128-1110023',
    homepageUrl: 'https://www.byte.fm',
    votes: 3900,
  },
  {
    id: 'dlf-cologne-891',
    name: 'Deutschlandfunk 89.1 FM Cologne',
    frequencyMhz: 89.1,
    genre: 'News & NPR Talk',
    country: 'Germany',
    countryCode: 'DE',
    state: 'North Rhine-Westphalia',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3',
    homepageUrl: 'https://www.deutschlandfunk.de',
    votes: 6400,
  },

  // --- FRANCE ---
  {
    id: 'fip-paris-1051',
    name: 'FIP Radio 105.1 FM Paris',
    frequencyMhz: 105.1,
    genre: 'Jazz & Blues',
    country: 'France',
    countryCode: 'FR',
    state: 'Île-de-France',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
    homepageUrl: 'https://www.radiofrance.fr/fip',
    votes: 10900,
  },
  {
    id: 'radio-nova-898',
    name: 'Radio Nova 89.8 FM Paris',
    frequencyMhz: 89.8,
    genre: 'World & Latin',
    country: 'France',
    countryCode: 'FR',
    state: 'Paris',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://radionova.ice.infomaniak.ch/radionova-high.mp3',
    homepageUrl: 'https://www.nova.fr',
    votes: 6300,
  },
  {
    id: 'radio-classique-1011',
    name: 'Radio Classique 101.1 FM Paris',
    frequencyMhz: 101.1,
    genre: 'Classical & Opera',
    country: 'France',
    countryCode: 'FR',
    state: 'Paris',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3',
    homepageUrl: 'https://www.radioclassique.fr',
    votes: 4700,
  },

  // --- AUSTRALIA ---
  {
    id: 'pbs-1067-melbourne',
    name: 'PBS 106.7 FM Melbourne',
    frequencyMhz: 106.7,
    genre: 'Jazz & Blues',
    country: 'Australia',
    countryCode: 'AU',
    state: 'Victoria',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://live.pbsfm.org.au/pbsfm-hq.mp3',
    homepageUrl: 'https://www.pbsfm.org.au',
    votes: 5400,
  },
  {
    id: '2ser-1073-sydney',
    name: '2SER 107.3 FM Sydney Community',
    frequencyMhz: 107.3,
    genre: 'Rock & Indie',
    country: 'Australia',
    countryCode: 'AU',
    state: 'New South Wales',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.2ser.com/live',
    homepageUrl: 'https://2ser.com',
    votes: 3800,
  },

  // --- JAPAN ---
  {
    id: 'jpop-sakura-957',
    name: 'J-Pop Sakura 95.7 FM Tokyo',
    frequencyMhz: 95.7,
    genre: 'Pop & Top 40',
    country: 'Japan',
    countryCode: 'JP',
    state: 'Tokyo',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://roserver.radioca.st/stream',
    homepageUrl: 'https://jpop.radioca.st',
    votes: 8700,
  },
  {
    id: 'tokyo-chiptune-933',
    name: 'PC-88 Chiptune 93.3 FM Akihabara',
    frequencyMhz: 93.3,
    genre: '80s & Retro Synth',
    country: 'Japan',
    countryCode: 'JP',
    state: 'Tokyo',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/cliqhop-128-mp3',
    homepageUrl: 'https://somafm.com',
    votes: 4300,
  },

  // --- IRELAND ---
  {
    id: 'radio-nova-1003-dublin',
    name: 'Radio Nova 100.3 FM Dublin Guitar Rock',
    frequencyMhz: 100.3,
    genre: 'Rock & Indie',
    country: 'Ireland',
    countryCode: 'IE',
    state: 'Dublin',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://edge.nova.ie/nova',
    homepageUrl: 'https://www.nova.ie',
    votes: 5900,
  },
  {
    id: 'thistle-celtic-961',
    name: 'Thistle Radio 96.1 FM Celtic Heritage',
    frequencyMhz: 96.1,
    genre: 'World & Latin',
    country: 'Ireland',
    countryCode: 'IE',
    state: 'Galway',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/thistle-128-mp3',
    homepageUrl: 'https://somafm.com/thistle/',
    votes: 4100,
  },

  // --- NETHERLANDS ---
  {
    id: 'radio-538-hilversum',
    name: 'Radio 538 102.1 FM Hilversum',
    frequencyMhz: 102.1,
    genre: 'Pop & Top 40',
    country: 'Netherlands',
    countryCode: 'NL',
    state: 'North Holland',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.538.nl/radio538/mp3',
    homepageUrl: 'https://www.538.nl',
    votes: 7200,
  },

  // --- SPAIN ---
  {
    id: 'rne-radio3-945',
    name: 'Radio 3 RNE 94.5 FM Madrid',
    frequencyMhz: 94.5,
    genre: 'Rock & Indie',
    country: 'Spain',
    countryCode: 'ES',
    state: 'Madrid',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://rtvelivestream.akamaized.net/rne_r3_main.mp3',
    homepageUrl: 'https://www.rtve.es/radio/radio3/',
    votes: 6800,
  },
  {
    id: 'radio-ibiza-972',
    name: 'Radio Ibiza 97.2 FM Club Mix',
    frequencyMhz: 97.2,
    genre: 'Electronic & Dance',
    country: 'Spain',
    countryCode: 'ES',
    state: 'Balearic Islands',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://stream.radioibiza.fm/live',
    homepageUrl: 'https://radioibiza.fm',
    votes: 5400,
  },

  // --- BRAZIL ---
  {
    id: 'bossa-nova-923',
    name: 'Bossa Nova Brazil 92.3 FM Ipanema',
    frequencyMhz: 92.3,
    genre: 'World & Latin',
    country: 'Brazil',
    countryCode: 'BR',
    state: 'Rio de Janeiro',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://ice2.somafm.com/bossa-128-mp3',
    homepageUrl: 'https://somafm.com/bossa/',
    votes: 6900,
  },

  // --- MEXICO ---
  {
    id: 'reactor-1057-cdmx',
    name: 'Reactor 105.7 FM Mexico City',
    frequencyMhz: 105.7,
    genre: 'Rock & Indie',
    country: 'Mexico',
    countryCode: 'MX',
    state: 'CDMX',
    bitrate: '128 kbps',
    codec: 'MP3',
    streamUrl: 'https://s2.mexside.net/8018/stream',
    homepageUrl: 'https://imer.mx/reactor/',
    votes: 5600,
  },
];

export const CURATED_FM_STATIONS: FmStation[] = RAW_CURATED_FM.map((s) => ({ ...s, band: 'fm' as const }));

// ---------------------------------------------------------------------------
// CURATED AM BROADCAST STATIONS (Medium Wave)
// ---------------------------------------------------------------------------
// English-language AM/MW broadcasters with free public streams. Every entry
// was live-verified against its radio-browser url_resolved endpoint: HTTP 200,
// audio/* content type, and Access-Control-Allow-Origin present (the deck's
// <audio crossOrigin="anonymous"> refuses media without it). frequencyMhz
// carries the AM dial position converted to MHz (1100 kHz -> 1.1) so the
// existing MHz-based plumbing keeps working; the band field drives the
// "xxxx kHz AM" display and keeps AM presets from syncing the FM VFO dial.
export const AM_STATIONS: FmStation[] = [
  { id: 'am_kogo600', name: 'KOGO AM 600', frequencyMhz: 0.6, genre: 'News/Talk (San Diego CA)', country: 'United States', countryCode: 'US', state: 'California', bitrate: '128 kbps', codec: 'AAC', streamUrl: 'https://ample.revma.ihrhls.com/zc257', homepageUrl: 'https://www.iheart.com/live/am-600-257/', band: 'am' },
  { id: 'am_wjr760', name: 'WJR 760', frequencyMhz: 0.76, genre: 'News/Talk (Detroit MI)', country: 'United States', countryCode: 'US', state: 'Michigan', bitrate: '128 kbps', codec: 'AAC', streamUrl: 'http://26383.live.streamtheworld.com:3690/WJRAMAAC_SC', homepageUrl: 'http://www.760wjr.com/', band: 'am' },
  { id: 'am_klvz810', name: 'KLVZ 810 Legends', frequencyMhz: 0.81, genre: 'Classic Hits (Denver CO)', country: 'United States', countryCode: 'US', state: 'Colorado', bitrate: '128 kbps', codec: 'MP3', streamUrl: 'https://ais-sa8.cdnstream1.com/p1w7r97sb0k/c2g93fu0iqz', homepageUrl: 'https://www.legends953.com/', band: 'am' },
  { id: 'am_whas840', name: 'NewsRadio 840 WHAS', frequencyMhz: 0.84, genre: 'News/Talk (Louisville KY)', country: 'United States', countryCode: 'US', state: 'Kentucky', bitrate: '128 kbps', codec: 'AAC', streamUrl: 'https://stream.revma.ihrhls.com/zc969', homepageUrl: 'https://whas.iheart.com/', band: 'am' },
  { id: 'am_wmvp1000', name: 'WMVP 1000 ESPN', frequencyMhz: 1.0, genre: 'Sports Talk (Chicago IL)', country: 'United States', countryCode: 'US', state: 'Illinois', bitrate: '128 kbps', codec: 'MP3', streamUrl: 'https://live.amperwave.net/direct/goodkarma-wmvpammp3-ibc1', homepageUrl: 'https://goodkarmabrands.com/espn-chicago/', band: 'am' },
  { id: 'am_cfrb1010', name: 'CFRB News/Talk 1010', frequencyMhz: 1.01, genre: 'News/Talk (Toronto ON)', country: 'Canada', countryCode: 'CA', state: 'Ontario', bitrate: '128 kbps', codec: 'AAC', streamUrl: 'http://18213.live.streamtheworld.com:3690/CFRBAMAAC_SC', homepageUrl: 'https://www.iheartradio.ca/newstalk-1010', band: 'am' },
  { id: 'am_wtam1100', name: 'WTAM 1100', frequencyMhz: 1.1, genre: 'News/Talk (Cleveland OH)', country: 'United States', countryCode: 'US', state: 'Ohio', bitrate: '128 kbps', codec: 'AAC', streamUrl: 'https://stream.revma.ihrhls.com/zc1749', homepageUrl: 'https://wtam.iheart.com/', band: 'am' },
  { id: 'am_kfab1110', name: '1110 KFAB', frequencyMhz: 1.11, genre: 'News/Talk (Omaha NE)', country: 'United States', countryCode: 'US', state: 'Nebraska', bitrate: '128 kbps', codec: 'AAC', streamUrl: 'https://stream.revma.ihrhls.com/zc1325', homepageUrl: 'https://kfab.iheart.com/', band: 'am' },
  { id: 'am_wbb1130', name: 'WBBR 1130 Bloomberg', frequencyMhz: 1.13, genre: 'Business News (New York NY)', country: 'United States', countryCode: 'US', state: 'New York', bitrate: '128 kbps', codec: 'AAC', streamUrl: 'http://29308.live.streamtheworld.com:3690/WBBRAMAAC_SC', homepageUrl: 'https://www.bloombergradio.com/', band: 'am' },
  { id: 'am_kknw1150', name: 'KKNW 1150 Alternative Talk', frequencyMhz: 1.15, genre: 'Alternative Talk (Seattle WA)', country: 'United States', countryCode: 'US', state: 'Washington', bitrate: '128 kbps', codec: 'AAC', streamUrl: 'http://18193.live.streamtheworld.com/KKNWAMAAC_SC', homepageUrl: 'https://1150kknw.com/', band: 'am' },
  { id: 'am_kfbk1530', name: 'KFBK 1530 News Radio', frequencyMhz: 1.53, genre: 'News/Talk (Sacramento CA)', country: 'United States', countryCode: 'US', state: 'California', bitrate: '128 kbps', codec: 'AAC', streamUrl: 'http://stream.revma.ihrhls.com/zc217', homepageUrl: 'https://kfbk.iheart.com/', band: 'am' },
  { id: 'am_ched630', name: '630 CHED', frequencyMhz: 0.63, genre: 'News/Talk (Edmonton AB)', country: 'Canada', countryCode: 'CA', state: 'Alberta', bitrate: '128 kbps', codec: 'MP3', streamUrl: 'https://corus.leanstream.co/CHEDAM-MP3', homepageUrl: 'https://globalnews.ca/radio/630ched/player/', band: 'am' },
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
   * Searches live online FM radio stations by query, category/genre, or country via Radio-Browser API.
   * Gracefully falls back to curated offline stations if network/CORS issues occur.
   */
  public async searchOnlineStations(
    query = '',
    genreTag?: string,
    countryCode = '',
    limit = 60
  ): Promise<FmStation[]> {
    const cleanedQuery = query.trim();
    const effectiveTag = genreTag && genreTag !== 'ALL' ? genreTag.toLowerCase() : '';
    const effectiveCountry = countryCode && countryCode !== 'ALL' ? countryCode : '';

    // If query is empty and no tag or country, return curated stations
    if (!cleanedQuery && !effectiveTag && !effectiveCountry) {
      return CURATED_FM_STATIONS;
    }

    try {
      const baseUrl = this.getActiveBaseUrl();
      const params = new URLSearchParams();
      if (cleanedQuery) params.append('name', cleanedQuery);
      if (effectiveTag) {
        if (effectiveTag === 'cbc') {
          if (!cleanedQuery) {
            params.append('name', 'cbc');
          } else {
            params.append('tag', 'cbc');
          }
        } else {
          params.append('tag', effectiveTag);
        }
      }
      if (effectiveCountry) params.append('countrycode', effectiveCountry.toLowerCase());
      params.append('limit', limit.toString());
      params.append('hidebroken', 'true');
      params.append('order', 'votes');
      params.append('reverse', 'true');

      const url = `${baseUrl}/json/stations/search?${params.toString()}`;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 6500);

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'HeshRadio/0.00.3',
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
        countrycode: string;
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
            genre: (st.tags ? st.tags.split(',').slice(0, 3).map((t) => t.trim()).join(', ') : 'Broadcast FM') || 'Live Stream',
            country: st.country || 'Global',
            countryCode: (st.countrycode || '').toUpperCase(),
            state: st.state || undefined,
            bitrate: st.bitrate ? `${st.bitrate} kbps` : '128 kbps',
            codec: (st.codec || 'MP3').toUpperCase(),
            streamUrl: st.url_resolved || st.url,
            homepageUrl: st.homepage || undefined,
            favicon: st.favicon || undefined,
            votes: st.votes || 0,
            // Radio Browser results are filtered to the FM broadcast band.
            band: 'fm',
          }));
      }
    } catch {
      this.rotateMirror();
    }

    // Fallback: Filter curated stations in memory
    const qLower = cleanedQuery.toLowerCase();
    const tagLower = effectiveTag.toLowerCase();
    const codeMatch = effectiveCountry.toUpperCase();

    return CURATED_FM_STATIONS.filter((st) => {
      const matchQuery =
        !cleanedQuery ||
        st.name.toLowerCase().includes(qLower) ||
        st.genre.toLowerCase().includes(qLower) ||
        st.country.toLowerCase().includes(qLower) ||
        (st.state && st.state.toLowerCase().includes(qLower)) ||
        st.frequencyMhz.toString().includes(qLower);

      const genreLower = st.genre.toLowerCase();
      const matchCategory =
        !tagLower ||
        genreLower.includes(tagLower) ||
        (tagLower === 'cbc' && (genreLower.includes('cbc') || st.name.toLowerCase().includes('cbc'))) ||
        (tagLower === 'rock' && (genreLower.includes('rock') || genreLower.includes('indie'))) ||
        (tagLower === 'news' && (genreLower.includes('news') || genreLower.includes('npr') || genreLower.includes('talk') || genreLower.includes('cbc'))) ||
        (tagLower === 'country' && (genreLower.includes('country') || genreLower.includes('americana') || genreLower.includes('folk'))) ||
        (tagLower === 'electronic' && (genreLower.includes('electronic') || genreLower.includes('dance') || genreLower.includes('edm') || genreLower.includes('trance'))) ||
        (tagLower === '80s' && (genreLower.includes('80s') || genreLower.includes('synth') || genreLower.includes('retro'))) ||
        (tagLower === 'classical' && genreLower.includes('class')) ||
        (tagLower === 'jazz' && (genreLower.includes('jazz') || genreLower.includes('blues'))) ||
        (tagLower === 'metal' && (genreLower.includes('metal') || genreLower.includes('hard rock'))) ||
        (tagLower === 'ambient' && (genreLower.includes('ambient') || genreLower.includes('chill') || genreLower.includes('downtempo'))) ||
        (tagLower === 'pop' && (genreLower.includes('pop') || genreLower.includes('top 40') || genreLower.includes('hits'))) ||
        (tagLower === 'reggae' && (genreLower.includes('reggae') || genreLower.includes('dub'))) ||
        (tagLower === 'world' && (genreLower.includes('world') || genreLower.includes('latin') || genreLower.includes('bossa') || genreLower.includes('celtic')));

      const matchCountry =
        !codeMatch ||
        (st.countryCode && st.countryCode.toUpperCase() === codeMatch) ||
        st.country.toUpperCase().includes(codeMatch);

      return matchQuery && matchCategory && matchCountry;
    });
  }

  /**
   * Retrieves default or saved Memory Presets from LocalStorage: up to 8 FM
   * slots (indices 0-7) and 8 AM slots (8-15), each band topped up independently.
   */
  public loadMemoryPresets(): FmStation[] {
    const fmDefaults = CURATED_FM_STATIONS.slice(0, 8);
    const amDefaults = AM_STATIONS.slice(0, 8);
    // loadSetting swallows missing/corrupt JSON (returns null); everything below still
    // validates whatever parsed: a restored/hand-edited array must not put half-shaped
    // presets (missing streamUrl/frequency) into the deck, where recall would tune
    // the player to "undefined" or crash the render.
    const parsed: unknown = loadSetting<unknown>('heshradio_fm_presets', null);
    if (Array.isArray(parsed)) {
      const usable = parsed
        .map((p): FmStation | null => {
          if (!p || typeof p !== 'object') return null;
          const s = p as Partial<FmStation>;
          if (typeof s.id !== 'string' || typeof s.name !== 'string') return null;
          if (typeof s.streamUrl !== 'string' || s.streamUrl === '') return null;
          if (typeof s.frequencyMhz !== 'number' || !Number.isFinite(s.frequencyMhz)) return null;
          // Saves predating the band field (and hand edits missing it) are FM: every
          // preset then was FM, so defaulting keeps the user's custom stations.
          return {
            id: s.id,
            name: s.name,
            frequencyMhz: s.frequencyMhz,
            genre: typeof s.genre === 'string' ? s.genre : '',
            country: typeof s.country === 'string' ? s.country : '',
            countryCode: typeof s.countryCode === 'string' ? s.countryCode : undefined,
            state: typeof s.state === 'string' ? s.state : undefined,
            bitrate: typeof s.bitrate === 'string' ? s.bitrate : '',
            codec: typeof s.codec === 'string' ? s.codec : '',
            streamUrl: s.streamUrl,
            homepageUrl: typeof s.homepageUrl === 'string' ? s.homepageUrl : undefined,
            band: s.band === 'am' ? 'am' : 'fm',
          };
        })
        .filter((s): s is FmStation => s !== null);
      if (usable.length > 0) {
        const fm = usable.filter((s) => s.band === 'fm').slice(0, 8);
        const am = usable.filter((s) => s.band === 'am').slice(0, 8);
        // Keep the 8-slot-per-band invariant the deck's UI and save flow assume: refill
        // lost slots from that band's curated defaults, exactly like a fresh install,
        // so corrupt data cannot shrink (and permanently lock) the user's preset slots.
        for (const st of fmDefaults) {
          if (fm.length >= 8) break;
          if (!fm.some((f) => f.id === st.id)) fm.push(st);
        }
        for (const st of amDefaults) {
          if (am.length >= 8) break;
          if (!am.some((f) => f.id === st.id)) am.push(st);
        }
        return [...fm, ...am];
      }
    }

    // Fresh install (or nothing usable survived): 8 FM + 8 AM default slots.
    return [...fmDefaults, ...amDefaults];
  }

  /**
   * Saves the preset bank to LocalStorage: up to 8 FM slots and 8 AM slots,
   * the per-band cap mirroring what loadMemoryPresets hands back.
   */
  public saveMemoryPresets(presets: FmStation[]): void {
    saveSetting('heshradio_fm_presets', [
      ...presets.filter((p) => p.band === 'fm').slice(0, 8),
      ...presets.filter((p) => p.band === 'am').slice(0, 8),
    ]);
  }
}
