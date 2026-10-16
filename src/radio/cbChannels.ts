export type ModulationMode = 'AM' | 'FM' | 'LSB' | 'USB' | 'WX';

export interface CbChannelInfo {
  channel: number;
  frequencyMhz: number;
  frequencyHz: number;
  defaultMode: ModulationMode;
  label: string;
  truckerUsage: string;
  priority?: 'HIGHWAY' | 'EMERGENCY' | 'SUPERBOWL' | 'SSB_DX' | 'FM_CALL' | 'SCALE';
  synthNote?: string;
}

/**
 * Exact FCC Part 95 40-Channel Citizens Band (11-Meter) Table.
 * Note:
 * - 5 R/C "A-Channels" (26.995, 27.045, 27.095, 27.145, 27.195 MHz) are skipped.
 * - Channels 23 (27.255 MHz), 24 (27.235 MHz), and 25 (27.245 MHz) are non-monotonic
 *   due to historical 23-channel crystal synthesizer architecture.
 */
export const CB_CHANNELS: CbChannelInfo[] = [
  { channel: 1, frequencyMhz: 26.965, frequencyHz: 26_965_000, defaultMode: 'AM', label: 'CH 01', truckerUsage: 'East Coast / Regional General' },
  { channel: 2, frequencyMhz: 26.975, frequencyHz: 26_975_000, defaultMode: 'AM', label: 'CH 02', truckerUsage: 'General Local' },
  { channel: 3, frequencyMhz: 26.985, frequencyHz: 26_985_000, defaultMode: 'AM', label: 'CH 03', truckerUsage: 'Prepper / Survivalist AM Net', synthNote: 'Next 10 kHz slot (26.995 MHz Ch 3A) skipped for R/C' },
  { channel: 4, frequencyMhz: 27.005, frequencyHz: 27_005_000, defaultMode: 'AM', label: 'CH 04', truckerUsage: '4x4 Off-Road & Trail Recovery ("4x4 = Ch 4")' },
  { channel: 5, frequencyMhz: 27.015, frequencyHz: 27_015_000, defaultMode: 'AM', label: 'CH 05', truckerUsage: 'General / Industrial Yard' },
  { channel: 6, frequencyMhz: 27.025, frequencyHz: 27_025_000, defaultMode: 'AM', label: 'CH 06', truckerUsage: '"THE SUPER BOWL" — High-Power AM Skip Shootout', priority: 'SUPERBOWL' },
  { channel: 7, frequencyMhz: 27.035, frequencyHz: 27_035_000, defaultMode: 'AM', label: 'CH 07', truckerUsage: 'General Local', synthNote: 'Next 10 kHz slot (27.045 MHz Ch 7A) skipped for R/C' },
  { channel: 8, frequencyMhz: 27.055, frequencyHz: 27_055_000, defaultMode: 'AM', label: 'CH 08', truckerUsage: 'Regional Convoy / Escort Loads' },
  { channel: 9, frequencyMhz: 27.065, frequencyHz: 27_065_000, defaultMode: 'AM', label: 'CH 09', truckerUsage: 'OFFICIAL FCC EMERGENCY & TRAVELER ASSISTANCE', priority: 'EMERGENCY' },
  { channel: 10, frequencyMhz: 27.075, frequencyHz: 27_075_000, defaultMode: 'AM', label: 'CH 10', truckerUsage: 'Scale Houses, Weigh Stations & Truck Stops', priority: 'SCALE' },
  { channel: 11, frequencyMhz: 27.085, frequencyHz: 27_085_000, defaultMode: 'AM', label: 'CH 11', truckerUsage: 'Historical AM Calling Channel', synthNote: 'Next 10 kHz slot (27.095 MHz Ch 11A) skipped for R/C' },
  { channel: 12, frequencyMhz: 27.105, frequencyHz: 27_105_000, defaultMode: 'AM', label: 'CH 12', truckerUsage: 'General Local' },
  { channel: 13, frequencyMhz: 27.115, frequencyHz: 27_115_000, defaultMode: 'AM', label: 'CH 13', truckerUsage: 'RV Campers & Marine / Port Bridge Comms' },
  { channel: 14, frequencyMhz: 27.125, frequencyHz: 27_125_000, defaultMode: 'AM', label: 'CH 14', truckerUsage: 'Distribution Center / Dock Doors & Walkie-Talkies' },
  { channel: 15, frequencyMhz: 27.135, frequencyHz: 27_135_000, defaultMode: 'AM', label: 'CH 15', truckerUsage: 'West Coast I-5 / California Regional Truckers', synthNote: 'Next 10 kHz slot (27.145 MHz Ch 15A) skipped for R/C' },
  { channel: 16, frequencyMhz: 27.155, frequencyHz: 27_155_000, defaultMode: 'AM', label: 'CH 16', truckerUsage: 'ATV / Off-Road & Vintage SSB Calling' },
  { channel: 17, frequencyMhz: 27.165, frequencyHz: 27_165_000, defaultMode: 'AM', label: 'CH 17', truckerUsage: 'North/South Interstate Overflow (I-5 / I-95)' },
  { channel: 18, frequencyMhz: 27.175, frequencyHz: 27_175_000, defaultMode: 'AM', label: 'CH 18', truckerUsage: 'General Convoy' },
  { channel: 19, frequencyMhz: 27.185, frequencyHz: 27_185_000, defaultMode: 'AM', label: 'CH 19', truckerUsage: 'PRIMARY HIGHWAY TRUCKER CHANNEL ("BREAKER 1-9")', priority: 'HIGHWAY', synthNote: 'Next 10 kHz slot (27.195 MHz Ch 19A) skipped for R/C' },
  { channel: 20, frequencyMhz: 27.205, frequencyHz: 27_205_000, defaultMode: 'AM', label: 'CH 20', truckerUsage: 'General / Rest Area Local' },
  { channel: 21, frequencyMhz: 27.215, frequencyHz: 27_215_000, defaultMode: 'AM', label: 'CH 21', truckerUsage: 'General Local' },
  { channel: 22, frequencyMhz: 27.225, frequencyHz: 27_225_000, defaultMode: 'AM', label: 'CH 22', truckerUsage: 'Oversize Load Pilot Cars & Escorts' },
  { channel: 23, frequencyMhz: 27.255, frequencyHz: 27_255_000, defaultMode: 'AM', label: 'CH 23', truckerUsage: 'Classic 23-Ch Top End (Jumps to 27.255 MHz!)', synthNote: 'Non-linear FCC crystal swap: Ch 23 is 27.255 MHz' },
  { channel: 24, frequencyMhz: 27.235, frequencyHz: 27_235_000, defaultMode: 'AM', label: 'CH 24', truckerUsage: 'General (Steps down to 27.235 MHz)', synthNote: 'Non-linear FCC crystal swap: Ch 24 is 27.235 MHz' },
  { channel: 25, frequencyMhz: 27.245, frequencyHz: 27_245_000, defaultMode: 'AM', label: 'CH 25', truckerUsage: 'General (27.245 MHz between Ch 24 & Ch 23)', synthNote: 'Non-linear FCC crystal swap: Ch 25 is 27.245 MHz' },
  { channel: 26, frequencyMhz: 27.265, frequencyHz: 27_265_000, defaultMode: 'AM', label: 'CH 26', truckerUsage: 'Low-Band AM Skip / DX Calling' },
  { channel: 27, frequencyMhz: 27.275, frequencyHz: 27_275_000, defaultMode: 'AM', label: 'CH 27', truckerUsage: 'General / Regional Base Stations' },
  { channel: 28, frequencyMhz: 27.285, frequencyHz: 27_285_000, defaultMode: 'AM', label: 'CH 28', truckerUsage: 'High-Level AM DX Skip Channel' },
  { channel: 29, frequencyMhz: 27.295, frequencyHz: 27_295_000, defaultMode: 'AM', label: 'CH 29', truckerUsage: 'General Local' },
  { channel: 30, frequencyMhz: 27.305, frequencyHz: 27_305_000, defaultMode: 'AM', label: 'CH 30', truckerUsage: 'General Local' },
  { channel: 31, frequencyMhz: 27.315, frequencyHz: 27_315_000, defaultMode: 'FM', label: 'CH 31', truckerUsage: 'Primary US FM CB Calling Channel', priority: 'FM_CALL' },
  { channel: 32, frequencyMhz: 27.325, frequencyHz: 27_325_000, defaultMode: 'AM', label: 'CH 32', truckerUsage: 'General Local' },
  { channel: 33, frequencyMhz: 27.335, frequencyHz: 27_335_000, defaultMode: 'FM', label: 'CH 33', truckerUsage: 'FM Simplex Convoy Channel' },
  { channel: 34, frequencyMhz: 27.345, frequencyHz: 27_345_000, defaultMode: 'AM', label: 'CH 34', truckerUsage: 'General / Sideband Guard' },
  { channel: 35, frequencyMhz: 27.355, frequencyHz: 27_355_000, defaultMode: 'LSB', label: 'CH 35', truckerUsage: 'Lower Sideband Overflow' },
  { channel: 36, frequencyMhz: 27.365, frequencyHz: 27_365_000, defaultMode: 'USB', label: 'CH 36', truckerUsage: 'SSB Digital / Prepper Data & Ragchew' },
  { channel: 37, frequencyMhz: 27.375, frequencyHz: 27_375_000, defaultMode: 'LSB', label: 'CH 37', truckerUsage: 'North American LSB DX QSO Channel' },
  { channel: 38, frequencyMhz: 27.385, frequencyHz: 27_385_000, defaultMode: 'LSB', label: 'CH 38', truckerUsage: 'PRIMARY NORTH AMERICAN SSB DX SKIP CALLING (38 LSB)', priority: 'SSB_DX' },
  { channel: 39, frequencyMhz: 27.395, frequencyHz: 27_395_000, defaultMode: 'LSB', label: 'CH 39', truckerUsage: 'SSB DX Move-Off / QSO Channel' },
  { channel: 40, frequencyMhz: 27.405, frequencyHz: 27_405_000, defaultMode: 'LSB', label: 'CH 40', truckerUsage: 'Top-of-Band SSB Regional Net' },
];

export interface NoaaWxChannel {
  wxChannel: number;
  frequencyMhz: number;
  label: string;
  stationName: string;
  forecastText: string;
}

export const NOAA_WX_CHANNELS: NoaaWxChannel[] = [
  {
    wxChannel: 1,
    frequencyMhz: 162.55,
    label: 'WX1',
    stationName: 'KEC63 / 162.550 MHz',
    forecastText: 'NOAA Weather Radio All Hazards KEC63. Interstate corridor advisory: Gusty crosswinds 35 knots across high profile passes. Clear visibility eastbound.',
  },
  {
    wxChannel: 2,
    frequencyMhz: 162.4,
    label: 'WX2',
    stationName: 'KHB32 / 162.400 MHz',
    forecastText: 'NOAA Weather Radio KHB32. Barometric pressure 30.12 inches and rising. Overnight highway conditions dry, temperature 54 degrees.',
  },
  {
    wxChannel: 3,
    frequencyMhz: 162.475,
    label: 'WX3',
    stationName: 'WXM60 / 162.475 MHz',
    forecastText: 'NOAA Weather Radio WXM60. Mountain pass traction advisory in effect above 5000 feet. Carry chains for commercial vehicles.',
  },
  {
    wxChannel: 4,
    frequencyMhz: 162.425,
    label: 'WX4',
    stationName: 'WWG24 / 162.425 MHz',
    forecastText: 'NOAA Weather Radio WWG24. Severe thunderstorm watch cleared for southern tier interstate corridors.',
  },
  {
    wxChannel: 5,
    frequencyMhz: 162.45,
    label: 'WX5',
    stationName: 'KIG98 / 162.450 MHz',
    forecastText: 'NOAA Weather Radio KIG98. Coastal fog reducing visibility to 1/2 mile along I-5 marine layer corridor.',
  },
  {
    wxChannel: 6,
    frequencyMhz: 162.5,
    label: 'WX6',
    stationName: 'KXI58 / 162.500 MHz',
    forecastText: 'NOAA Weather Radio KXI58. High Plains wind advisory for empty trailers and high-profile 53-foot vans.',
  },
  {
    wxChannel: 7,
    frequencyMhz: 162.525,
    label: 'WX7',
    stationName: 'WNG650 / 162.525 MHz',
    forecastText: 'NOAA Weather Radio WNG650. All hazards S.A.M.E. alert standby channel.',
  },
];

export interface HighwayCorridor {
  id: string;
  name: string;
  code: string;
  activeRigs: number;
  regionDesc: string;
}

export const HIGHWAY_CORRIDORS: HighwayCorridor[] = [
  { id: 'I-80', code: 'I-80 TRANSCON', name: 'I-80 Transcontinental (CA ↔ NJ)', activeRigs: 42, regionDesc: 'Donner Pass, Cheyenne, Omaha, Des Moines, Joliet, Toledo' },
  { id: 'I-5', code: 'I-5 WEST COAST', name: 'I-5 Pacific Corridor (WA ↔ CA)', activeRigs: 31, regionDesc: 'Seattle, Portland, Siskiyou Summit, Redding, Grapevine, LA' },
  { id: 'I-10', code: 'I-10 SOUTH TIER', name: 'I-10 Southern Rim (CA ↔ FL)', activeRigs: 28, regionDesc: 'Phoenix, El Paso, San Antonio, Houston, Baton Rouge, Jax' },
  { id: 'I-95', code: 'I-95 EAST COAST', name: 'I-95 Atlantic Seaboard (ME ↔ FL)', activeRigs: 39, regionDesc: 'New England, NJ Turnpike, Baltimore, I-95 Virginia, Savannah' },
  { id: 'I-40', code: 'I-40 MOTHER RD', name: 'I-40 Cross-Country (CA ↔ NC)', activeRigs: 35, regionDesc: 'Flagstaff, Albuquerque, Amarillo, OKC, Memphis, Knoxville' },
  { id: 'LAN', code: 'LOCAL LAN / S26', name: 'Direct Windows ↔ Samsung S26 Ultra LAN', activeRigs: 2, regionDesc: 'Zero-latency local Wi-Fi WebSocket bridge between your devices' },
];

export interface TruckerTransmission {
  handle: string;
  corridor: string;
  milepost: string;
  channel: number;
  mode: ModulationMode;
  signalDbm: number; // e.g. -65 dBm (S9+8dB)
  text: string;
  pitchHz: number;
}

export const SIMULATED_TRUCKER_TRAFFIC: TruckerTransmission[] = [
  {
    handle: 'Iron Horse 402',
    corridor: 'I-80 TRANSCON',
    milepost: 'MM 142 Westbound',
    channel: 19,
    mode: 'AM',
    signalDbm: -67, // S9+6dB
    text: 'Breaker 1-9, watch your foot westbound at the 142 yardstick, you got a full-grown bear in the median shooting laser.',
    pitchHz: 112,
  },
  {
    handle: 'Diesel Doctor',
    corridor: 'I-80 TRANSCON',
    milepost: 'MM 145 Eastbound',
    channel: 19,
    mode: 'AM',
    signalDbm: -75, // S8
    text: 'Appreciate that comeback Iron Horse! Eastbound is clean and green all the way back to the Flying J at exit 118.',
    pitchHz: 96,
  },
  {
    handle: 'Silver Eagle',
    corridor: 'I-5 WEST COAST',
    milepost: 'MM 68 Northbound',
    channel: 19,
    mode: 'AM',
    signalDbm: -81, // S7
    text: 'Northbound Peterbilt with the bull rack, you got your ears on? Scale house at the 71 is CLOSED, roll right on by.',
    pitchHz: 124,
  },
  {
    handle: 'Nightcrawler',
    corridor: 'I-95 EAST COAST',
    milepost: 'MM 210 Southbound',
    channel: 19,
    mode: 'AM',
    signalDbm: -61, // S9+12dB
    text: 'Heads up southbound 19, right lane is stacked up behind an oversize wind turbine blade at the 208 bridge.',
    pitchHz: 105,
  },
  {
    handle: 'Motormouth 006',
    corridor: 'SUPERBOWL SKIP',
    milepost: 'Bayou Base 2.5kW',
    channel: 6,
    mode: 'AM',
    signalDbm: -48, // S9+25dB
    text: 'Auuuudio, one-two, one-two! Worldwide 006 down in the Bayou standing on the big maul, waving a hand across the Super Bowl, I am gone, bye-bye-bye!',
    pitchHz: 92,
  },
  {
    handle: 'REACT Base 9',
    corridor: 'HIGHWAY WATCH',
    milepost: 'Regional Dispatch',
    channel: 9,
    mode: 'AM',
    signalDbm: -71, // S9+2dB
    text: 'Channel 9 advisory: Disabled tractor-trailer on the right shoulder at interchange ramp 44B, tow unit is en route.',
    pitchHz: 132,
  },
  {
    handle: 'Whiskey Delta 449',
    corridor: '11M F2 SKYWAVE SKIP',
    milepost: 'Grid EM73 // Georgia',
    channel: 38,
    mode: 'LSB',
    signalDbm: -77, // S8
    text: 'CQ DX, CQ DX on 38 Lower Sideband! This is 449 Georgia standing by for any West Coast or Midwest skip stations.',
    pitchHz: 118,
  },
];

export interface InternetRadioStation {
  id: string;
  name: string;
  genre: string;
  bitrate: string;
  streamUrl: string;
  fallbackSynthStyle: 'OUTLAW_COUNTRY' | 'HIGHWAY_ROCK' | 'NIGHT_SYNTH' | 'SCANNER_HUM';
  externalWebSdrUrl?: string;
}

export const INTERNET_RADIO_PRESETS: InternetRadioStation[] = [
  {
    id: 'roadhouse-country',
    name: '18-Wheeler Outlaw Country FM',
    genre: 'Trucker Country / Southern Rock',
    bitrate: '128 kbps MP3',
    streamUrl: 'https://ice2.somafm.com/bootliquor-128-mp3',
    fallbackSynthStyle: 'OUTLAW_COUNTRY',
  },
  {
    id: 'night-drive-synth',
    name: 'Interstate Midnight Cruiser',
    genre: 'Night Drive / Synth & Ambient',
    bitrate: '128 kbps MP3',
    streamUrl: 'https://ice2.somafm.com/defcon-128-mp3',
    fallbackSynthStyle: 'NIGHT_SYNTH',
  },
  {
    id: 'classic-rock-hwy',
    name: 'Heavy Haul Classic Rock',
    genre: 'Road Rock / Blues',
    bitrate: '128 kbps MP3',
    streamUrl: 'https://ice2.somafm.com/metal-128-mp3',
    fallbackSynthStyle: 'HIGHWAY_ROCK',
  },
  {
    id: 'space-comm-scanner',
    name: 'NASA / Deep Space & HF Mission Audio',
    genre: 'Live Telemetry & Comms Mix',
    bitrate: '128 kbps MP3',
    streamUrl: 'https://ice2.somafm.com/missioncontrol-128-mp3',
    fallbackSynthStyle: 'SCANNER_HUM',
    externalWebSdrUrl: 'http://kiwisdr.com/public/',
  },
];
