import { CB_CHANNELS } from './cbChannels';

export type ModulationModeExtended = 'AM' | 'NFM' | 'WFM' | 'USB' | 'LSB' | 'CW' | 'WX';

export interface ChannelPreset {
  name: string;
  frequencyMhz: number;
  frequencyHz: number;
  mode: ModulationModeExtended;
  description: string;
  repeaterOffsetMhz?: number;
  ctcssToneHz?: number;
}

export interface BandPlan {
  id: string;
  name: string;
  category: 'CB' | 'GMRS' | 'AIR' | 'MARINE' | 'FM_BROADCAST' | 'HAM_HF' | 'HAM_VHF_UHF' | 'WX';
  frequencyMinMhz: number;
  frequencyMaxMhz: number;
  centerFrequencyMhz: number;
  defaultMode: ModulationModeExtended;
  allowedModes: ModulationModeExtended[];
  defaultStepHz: number;
  allowedStepsHz: number[];
  standardRepeaterOffsetMhz: number;
  description: string;
  presets: ChannelPreset[];
}

/**
 * 22-Channel GMRS / FRS UHF Allocations + 8 GMRS Repeater Inputs
 */
export const GMRS_CHANNELS: ChannelPreset[] = [
  { name: 'GMRS 01', frequencyMhz: 462.5625, frequencyHz: 462_562_500, mode: 'NFM', description: 'GMRS / FRS Ch 1 (Simplex)' },
  { name: 'GMRS 02', frequencyMhz: 462.5875, frequencyHz: 462_587_500, mode: 'NFM', description: 'GMRS / FRS Ch 2 (Simplex)' },
  { name: 'GMRS 03', frequencyMhz: 462.6125, frequencyHz: 462_612_500, mode: 'NFM', description: 'GMRS / FRS Ch 3 (Simplex)' },
  { name: 'GMRS 04', frequencyMhz: 462.6375, frequencyHz: 462_637_500, mode: 'NFM', description: 'GMRS / FRS Ch 4 (Simplex)' },
  { name: 'GMRS 05', frequencyMhz: 462.6625, frequencyHz: 462_662_500, mode: 'NFM', description: 'GMRS / FRS Ch 5 (Simplex)' },
  { name: 'GMRS 06', frequencyMhz: 462.6875, frequencyHz: 462_687_500, mode: 'NFM', description: 'GMRS / FRS Ch 6 (Simplex)' },
  { name: 'GMRS 07', frequencyMhz: 462.7125, frequencyHz: 462_712_500, mode: 'NFM', description: 'GMRS / FRS Ch 7 (Simplex)' },
  { name: 'GMRS 08', frequencyMhz: 467.5625, frequencyHz: 467_562_500, mode: 'NFM', description: 'FRS Ch 8 (0.5W FRS only)' },
  { name: 'GMRS 09', frequencyMhz: 467.5875, frequencyHz: 467_587_500, mode: 'NFM', description: 'FRS Ch 9 (0.5W FRS only)' },
  { name: 'GMRS 10', frequencyMhz: 467.6125, frequencyHz: 467_612_500, mode: 'NFM', description: 'FRS Ch 10 (0.5W FRS only)' },
  { name: 'GMRS 11', frequencyMhz: 467.6375, frequencyHz: 467_637_500, mode: 'NFM', description: 'FRS Ch 11 (0.5W FRS only)' },
  { name: 'GMRS 12', frequencyMhz: 467.6625, frequencyHz: 467_662_500, mode: 'NFM', description: 'FRS Ch 12 (0.5W FRS only)' },
  { name: 'GMRS 13', frequencyMhz: 467.6875, frequencyHz: 467_687_500, mode: 'NFM', description: 'FRS Ch 13 (0.5W FRS only)' },
  { name: 'GMRS 14', frequencyMhz: 467.7125, frequencyHz: 467_712_500, mode: 'NFM', description: 'FRS Ch 14 (0.5W FRS only)' },
  { name: 'GMRS 15', frequencyMhz: 462.5500, frequencyHz: 462_550_000, mode: 'NFM', description: 'GMRS Ch 15 (Repeater Out, +5 MHz in)', repeaterOffsetMhz: 5.0 },
  { name: 'GMRS 16', frequencyMhz: 462.5750, frequencyHz: 462_575_000, mode: 'NFM', description: 'GMRS Ch 16 (Repeater Out, +5 MHz in)', repeaterOffsetMhz: 5.0 },
  { name: 'GMRS 17', frequencyMhz: 462.6000, frequencyHz: 462_600_000, mode: 'NFM', description: 'GMRS Ch 17 (Repeater Out, +5 MHz in)', repeaterOffsetMhz: 5.0 },
  { name: 'GMRS 18', frequencyMhz: 462.6250, frequencyHz: 462_625_000, mode: 'NFM', description: 'GMRS Ch 18 (Repeater Out, +5 MHz in)', repeaterOffsetMhz: 5.0 },
  { name: 'GMRS 19', frequencyMhz: 462.6500, frequencyHz: 462_650_000, mode: 'NFM', description: 'GMRS Ch 19 — Primary Highway/Overland Calling', repeaterOffsetMhz: 5.0 },
  { name: 'GMRS 20', frequencyMhz: 462.6750, frequencyHz: 462_675_000, mode: 'NFM', description: 'GMRS Ch 20 — Emergency & Traveler (141.3 Hz PL)', repeaterOffsetMhz: 5.0, ctcssToneHz: 141.3 },
  { name: 'GMRS 21', frequencyMhz: 462.7000, frequencyHz: 462_700_000, mode: 'NFM', description: 'GMRS Ch 21 (Repeater Out, +5 MHz in)', repeaterOffsetMhz: 5.0 },
  { name: 'GMRS 22', frequencyMhz: 462.7250, frequencyHz: 462_725_000, mode: 'NFM', description: 'GMRS Ch 22 (Repeater Out, +5 MHz in)', repeaterOffsetMhz: 5.0 },
];

/**
 * VHF Civilian Aviation Airband Key Frequencies (118 - 137 MHz AM)
 */
export const AIRBAND_PRESETS: ChannelPreset[] = [
  { name: 'AIR EMG', frequencyMhz: 121.500, frequencyHz: 121_500_000, mode: 'AM', description: 'International VHF Aviation Emergency / Guard Channel' },
  { name: 'UNICOM', frequencyMhz: 122.800, frequencyHz: 122_800_000, mode: 'AM', description: 'Standard Uncontrolled Field UNICOM / CTAF' },
  { name: 'FLIGHT WATCH', frequencyMhz: 122.000, frequencyHz: 122_000_000, mode: 'AM', description: 'Enroute Flight Advisory Service (EFAS)' },
  { name: 'AIR-TO-AIR', frequencyMhz: 122.750, frequencyHz: 122_750_000, mode: 'AM', description: 'General Aviation Air-to-Air Chat' },
  { name: 'TOWER 1', frequencyMhz: 118.700, frequencyHz: 118_700_000, mode: 'AM', description: 'Primary Regional Control Tower' },
  { name: 'GROUND 1', frequencyMhz: 121.900, frequencyHz: 121_900_000, mode: 'AM', description: 'Standard Airport Ground Control' },
  { name: 'ATIS 1', frequencyMhz: 127.150, frequencyHz: 127_150_000, mode: 'AM', description: 'Automatic Terminal Information Service' },
  { name: 'SAR GUARD', frequencyMhz: 123.100, frequencyHz: 123_100_000, mode: 'AM', description: 'Search and Rescue (SAR) On-Scene Scene Coordination' },
];

/**
 * Marine VHF Key Frequencies (156 - 162 MHz NFM)
 */
export const MARINE_PRESETS: ChannelPreset[] = [
  { name: 'MAR 16', frequencyMhz: 156.800, frequencyHz: 156_800_000, mode: 'NFM', description: 'International Marine Distress, Safety & Calling (Channel 16)' },
  { name: 'MAR 09', frequencyMhz: 156.450, frequencyHz: 156_450_000, mode: 'NFM', description: 'Boater Calling / Secondary Recreational (Channel 9)' },
  { name: 'MAR 13', frequencyMhz: 156.650, frequencyHz: 156_650_000, mode: 'NFM', description: 'Navigational Bridge-to-Bridge Safety (Channel 13 - 1 Watt)' },
  { name: 'MAR 22A', frequencyMhz: 157.100, frequencyHz: 157_100_000, mode: 'NFM', description: 'US Coast Guard Liaison & Maritime Safety Broadcasts (Channel 22A)' },
  { name: 'MAR 68', frequencyMhz: 156.425, frequencyHz: 156_425_000, mode: 'NFM', description: 'Non-Commercial Recreational Working Channel' },
  { name: 'MAR 70', frequencyMhz: 156.525, frequencyHz: 156_525_000, mode: 'NFM', description: 'Digital Selective Calling (DSC) Distress & Automated Routing' },
];

/**
 * FM Broadcast Presets (88 - 108 MHz WFM)
 */
export const FM_BROADCAST_PRESETS: ChannelPreset[] = [
  { name: '88.5 FM', frequencyMhz: 88.500, frequencyHz: 88_500_000, mode: 'WFM', description: 'Public Radio / Classical & Jazz' },
  { name: '91.1 FM', frequencyMhz: 91.100, frequencyHz: 91_100_000, mode: 'WFM', description: 'College / Indie Alternative Rock' },
  { name: '95.5 FM', frequencyMhz: 95.500, frequencyHz: 95_500_000, mode: 'WFM', description: 'Classic Highway Rock & Road News' },
  { name: '98.7 FM', frequencyMhz: 98.700, frequencyHz: 98_700_000, mode: 'WFM', description: 'Trucker Outlaw Country FM' },
  { name: '101.1 FM', frequencyMhz: 101.100, frequencyHz: 101_100_000, mode: 'WFM', description: 'Contemporary Top 40 & Traffic Reports' },
  { name: '104.3 FM', frequencyMhz: 104.300, frequencyHz: 104_300_000, mode: 'WFM', description: 'Golden Oldies & Southern Hits' },
];

/**
 * Amateur Radio (Ham) Presets across HF, VHF, UHF
 */
export const HAM_160M_PRESETS: ChannelPreset[] = [
  { name: '160m FT8', frequencyMhz: 1.840, frequencyHz: 1_840_000, mode: 'USB', description: '160m Digital FT8 Calling' },
  { name: '160m CW', frequencyMhz: 1.820, frequencyHz: 1_820_000, mode: 'CW', description: '160m CW Calling / DX Window' },
  { name: '160m LSB', frequencyMhz: 1.900, frequencyHz: 1_900_000, mode: 'LSB', description: '160m Top-Band Night Ragchew' },
];

export const HAM_80M_PRESETS: ChannelPreset[] = [
  { name: '80m FT8', frequencyMhz: 3.573, frequencyHz: 3_573_000, mode: 'USB', description: '80m Digital FT8 Activity' },
  { name: '80m JS8', frequencyMhz: 3.578, frequencyHz: 3_578_000, mode: 'USB', description: '80m Weak-Signal JS8Call Chat' },
  { name: '80m CW', frequencyMhz: 3.530, frequencyHz: 3_530_000, mode: 'CW', description: '80m CW Ragchew & Traffic Nets' },
  { name: '75m LSB', frequencyMhz: 3.860, frequencyHz: 3_860_000, mode: 'LSB', description: '75m Phone Regional Night Net' },
  { name: '75m SSTV', frequencyMhz: 3.845, frequencyHz: 3_845_000, mode: 'USB', description: 'Slow-Scan TV Calling' },
];

export const HAM_40M_PRESETS: ChannelPreset[] = [
  { name: '40m FT8', frequencyMhz: 7.074, frequencyHz: 7_074_000, mode: 'USB', description: '40m Primary FT8 Frequency' },
  { name: '40m JS8', frequencyMhz: 7.078, frequencyHz: 7_078_000, mode: 'USB', description: '40m Primary JS8Call Net' },
  { name: '40m CW', frequencyMhz: 7.030, frequencyHz: 7_030_000, mode: 'CW', description: '40m QRP / CW Calling' },
  { name: '40m LSB', frequencyMhz: 7.200, frequencyHz: 7_200_000, mode: 'LSB', description: '40m Mid-Day Interstate Voice Net' },
  { name: '40m SSTV', frequencyMhz: 7.171, frequencyHz: 7_171_000, mode: 'USB', description: 'Analog Slow-Scan TV Analog Images' },
];

export const HAM_20M_PRESETS: ChannelPreset[] = [
  { name: '20m FT8', frequencyMhz: 14.074, frequencyHz: 14_074_000, mode: 'USB', description: '20m World Primary FT8 Digital Activity' },
  { name: '20m JS8', frequencyMhz: 14.078, frequencyHz: 14_078_000, mode: 'USB', description: '20m Keyboard-to-Keyboard JS8Call Net' },
  { name: '20m CW', frequencyMhz: 14.060, frequencyHz: 14_060_000, mode: 'CW', description: '20m QRP / CW Calling Frequency' },
  { name: '20m USB CALL', frequencyMhz: 14.225, frequencyHz: 14_225_000, mode: 'USB', description: '20m Daytime Intercontinental Voice Calling' },
  { name: '20m SSTV', frequencyMhz: 14.230, frequencyHz: 14_230_000, mode: 'USB', description: '20m World SSTV Image Calling Channel' },
  { name: '20m MARITIME', frequencyMhz: 14.300, frequencyHz: 14_300_000, mode: 'USB', description: 'Maritime Mobile & Emergency Hurricane Net' },
];

export const HAM_10M_PRESETS: ChannelPreset[] = [
  { name: '10m FT8', frequencyMhz: 28.074, frequencyHz: 28_074_000, mode: 'USB', description: '10m Solar Max FT8 Activity' },
  { name: '10m CW', frequencyMhz: 28.025, frequencyHz: 28_025_000, mode: 'CW', description: '10m CW Calling' },
  { name: '10m USB CALL', frequencyMhz: 28.400, frequencyHz: 28_400_000, mode: 'USB', description: '10m Voice Calling (Technician Class Access)' },
  { name: '10m AM CALL', frequencyMhz: 29.000, frequencyHz: 29_000_000, mode: 'AM', description: '10m Vintage AM Window' },
  { name: '10m FM SIMPLEX', frequencyMhz: 29.600, frequencyHz: 29_600_000, mode: 'NFM', description: '10m National FM Simplex Calling' },
  { name: '10m REPEATER', frequencyMhz: 29.620, frequencyHz: 29_620_000, mode: 'NFM', description: '10m FM Repeater Output (-100 kHz in)', repeaterOffsetMhz: -0.1 },
];

export const HAM_2M_PRESETS: ChannelPreset[] = [
  { name: '2m SIMPLEX', frequencyMhz: 146.520, frequencyHz: 146_520_000, mode: 'NFM', description: 'National 2m FM Simplex Calling Channel' },
  { name: '2m APRS', frequencyMhz: 144.390, frequencyHz: 144_390_000, mode: 'NFM', description: 'North American 1200 Baud APRS Packet Network' },
  { name: '2m USB CALL', frequencyMhz: 144.200, frequencyHz: 144_200_000, mode: 'USB', description: '2m Weak-Signal USB Calling Frequency' },
  { name: '2m CW CALL', frequencyMhz: 144.050, frequencyHz: 144_050_000, mode: 'CW', description: '2m CW Weak-Signal Calling' },
  { name: '2m RPT HIGH', frequencyMhz: 146.940, frequencyHz: 146_940_000, mode: 'NFM', description: 'Standard 2m Repeater Output (-600 kHz Shift)', repeaterOffsetMhz: -0.6, ctcssToneHz: 100.0 },
  { name: '2m RPT LOW', frequencyMhz: 145.230, frequencyHz: 145_230_000, mode: 'NFM', description: 'Standard 2m Repeater Output (-600 kHz Shift)', repeaterOffsetMhz: -0.6, ctcssToneHz: 123.0 },
];

export const HAM_70CM_PRESETS: ChannelPreset[] = [
  { name: '70cm SIMPLEX', frequencyMhz: 446.000, frequencyHz: 446_000_000, mode: 'NFM', description: 'National 70cm UHF FM Simplex Calling' },
  { name: '70cm RPT 1', frequencyMhz: 442.100, frequencyHz: 442_100_000, mode: 'NFM', description: 'Standard 70cm Repeater (+5.0 MHz Shift)', repeaterOffsetMhz: 5.0, ctcssToneHz: 100.0 },
  { name: '70cm RPT 2', frequencyMhz: 444.450, frequencyHz: 444_450_000, mode: 'NFM', description: 'Regional UHF Repeater (+5.0 MHz Shift)', repeaterOffsetMhz: 5.0, ctcssToneHz: 131.8 },
  { name: '70cm USB CALL', frequencyMhz: 432.100, frequencyHz: 432_100_000, mode: 'USB', description: '70cm Weak Signal & Satellite Calling' },
  { name: '70cm DMR / DIGITAL', frequencyMhz: 441.000, frequencyHz: 441_000_000, mode: 'NFM', description: 'UHF Digital Voice Net' },
];

/**
 * Master List of All Supported Radio Bands (100 kHz to 1.75 GHz)
 */
export const MASTER_BAND_PLANS: BandPlan[] = [
  {
    id: '11m-cb',
    name: '11m Citizens Band (CB)',
    category: 'CB',
    frequencyMinMhz: 26.965,
    frequencyMaxMhz: 27.405,
    centerFrequencyMhz: 27.185,
    defaultMode: 'AM',
    allowedModes: ['AM', 'LSB', 'USB', 'NFM'],
    defaultStepHz: 10_000,
    allowedStepsHz: [1000, 5000, 10000],
    standardRepeaterOffsetMhz: 0,
    description: '40 Channels Part 95 AM/SSB/FM with historical non-linear channel swap and skipped R/C frequencies.',
    presets: CB_CHANNELS.map((ch) => ({
      name: ch.label,
      frequencyMhz: ch.frequencyMhz,
      frequencyHz: ch.frequencyHz,
      mode: ch.defaultMode === 'FM' ? 'NFM' : (ch.defaultMode as ModulationModeExtended),
      description: ch.truckerUsage,
    })),
  },
  {
    id: 'gmrs-frs',
    name: 'GMRS / FRS (UHF)',
    category: 'GMRS',
    frequencyMinMhz: 462.550,
    frequencyMaxMhz: 467.725,
    centerFrequencyMhz: 462.650,
    defaultMode: 'NFM',
    allowedModes: ['NFM'],
    defaultStepHz: 12_500,
    allowedStepsHz: [6250, 12500, 25000],
    standardRepeaterOffsetMhz: 5.0,
    description: '22 Channels UHF NFM for highway, overlanding, and repeater travel assistance.',
    presets: GMRS_CHANNELS,
  },
  {
    id: 'airband',
    name: 'VHF Aviation Airband',
    category: 'AIR',
    frequencyMinMhz: 118.000,
    frequencyMaxMhz: 136.975,
    centerFrequencyMhz: 121.500,
    defaultMode: 'AM',
    allowedModes: ['AM'],
    defaultStepHz: 25_000,
    allowedStepsHz: [8333, 25000, 50000],
    standardRepeaterOffsetMhz: 0,
    description: 'Civilian aeronautical voice AM communications, emergency 121.5 MHz guard, towers, and ATIS.',
    presets: AIRBAND_PRESETS,
  },
  {
    id: 'marine-vhf',
    name: 'Marine VHF',
    category: 'MARINE',
    frequencyMinMhz: 156.000,
    frequencyMaxMhz: 162.025,
    centerFrequencyMhz: 156.800,
    defaultMode: 'NFM',
    allowedModes: ['NFM'],
    defaultStepHz: 25_000,
    allowedStepsHz: [12500, 25000],
    standardRepeaterOffsetMhz: 0,
    description: 'International maritime mobile VHF safety, distress Channel 16, bridge-to-bridge, and port ops.',
    presets: MARINE_PRESETS,
  },
  {
    id: 'fm-broadcast',
    name: 'FM Broadcast (WFM)',
    category: 'FM_BROADCAST',
    frequencyMinMhz: 88.000,
    frequencyMaxMhz: 108.000,
    centerFrequencyMhz: 98.700,
    defaultMode: 'WFM',
    allowedModes: ['WFM'],
    defaultStepHz: 100_000,
    allowedStepsHz: [50000, 100000, 200000],
    standardRepeaterOffsetMhz: 0,
    description: 'Commercial Wideband FM stereo broadcast with RDS station name and RadioText.',
    presets: FM_BROADCAST_PRESETS,
  },
  {
    id: 'ham-160m',
    name: 'Amateur 160m (Top Band)',
    category: 'HAM_HF',
    frequencyMinMhz: 1.800,
    frequencyMaxMhz: 2.000,
    centerFrequencyMhz: 1.900,
    defaultMode: 'LSB',
    allowedModes: ['LSB', 'CW', 'USB'],
    defaultStepHz: 1000,
    allowedStepsHz: [100, 500, 1000, 5000],
    standardRepeaterOffsetMhz: 0,
    description: '1.8 - 2.0 MHz MF amateur band, predominantly nighttime skywave propagation and local ragchew.',
    presets: HAM_160M_PRESETS,
  },
  {
    id: 'ham-80m',
    name: 'Amateur 80m / 75m',
    category: 'HAM_HF',
    frequencyMinMhz: 3.500,
    frequencyMaxMhz: 4.000,
    centerFrequencyMhz: 3.800,
    defaultMode: 'LSB',
    allowedModes: ['LSB', 'CW', 'USB'],
    defaultStepHz: 1000,
    allowedStepsHz: [100, 500, 1000, 5000],
    standardRepeaterOffsetMhz: 0,
    description: '3.5 - 4.0 MHz regional HF band, emergency traffic nets and evening LSB ragchew.',
    presets: HAM_80M_PRESETS,
  },
  {
    id: 'ham-40m',
    name: 'Amateur 40m',
    category: 'HAM_HF',
    frequencyMinMhz: 7.000,
    frequencyMaxMhz: 7.300,
    centerFrequencyMhz: 7.150,
    defaultMode: 'LSB',
    allowedModes: ['LSB', 'CW', 'USB'],
    defaultStepHz: 1000,
    allowedStepsHz: [100, 500, 1000, 5000],
    standardRepeaterOffsetMhz: 0,
    description: '7.0 - 7.3 MHz workhorse HF band for daytime regional NVIS and nighttime worldwide DX.',
    presets: HAM_40M_PRESETS,
  },
  {
    id: 'ham-20m',
    name: 'Amateur 20m',
    category: 'HAM_HF',
    frequencyMinMhz: 14.000,
    frequencyMaxMhz: 14.350,
    centerFrequencyMhz: 14.200,
    defaultMode: 'USB',
    allowedModes: ['USB', 'CW', 'AM'],
    defaultStepHz: 1000,
    allowedStepsHz: [100, 500, 1000, 5000],
    standardRepeaterOffsetMhz: 0,
    description: '14.0 - 14.35 MHz primary daytime worldwide DX amateur band (always Upper Sideband).',
    presets: HAM_20M_PRESETS,
  },
  {
    id: 'ham-10m',
    name: 'Amateur 10m',
    category: 'HAM_HF',
    frequencyMinMhz: 28.000,
    frequencyMaxMhz: 29.700,
    centerFrequencyMhz: 28.500,
    defaultMode: 'USB',
    allowedModes: ['USB', 'NFM', 'AM', 'CW'],
    defaultStepHz: 5000,
    allowedStepsHz: [500, 1000, 5000, 10000],
    standardRepeaterOffsetMhz: -0.1,
    description: '28.0 - 29.7 MHz high HF band, opens spectacular worldwide DX during solar peaks and Sporadic-E.',
    presets: HAM_10M_PRESETS,
  },
  {
    id: 'ham-2m',
    name: 'Amateur 2m (VHF)',
    category: 'HAM_VHF_UHF',
    frequencyMinMhz: 144.000,
    frequencyMaxMhz: 148.000,
    centerFrequencyMhz: 146.520,
    defaultMode: 'NFM',
    allowedModes: ['NFM', 'USB', 'CW'],
    defaultStepHz: 20_000,
    allowedStepsHz: [5000, 10000, 12500, 15000, 20000, 25000],
    standardRepeaterOffsetMhz: -0.6,
    description: '144 - 148 MHz primary VHF amateur band. Standard repeater split is ±600 kHz.',
    presets: HAM_2M_PRESETS,
  },
  {
    id: 'ham-70cm',
    name: 'Amateur 70cm (UHF)',
    category: 'HAM_VHF_UHF',
    frequencyMinMhz: 420.000,
    frequencyMaxMhz: 450.000,
    centerFrequencyMhz: 446.000,
    defaultMode: 'NFM',
    allowedModes: ['NFM', 'USB', 'CW'],
    defaultStepHz: 25_000,
    allowedStepsHz: [6250, 12500, 25000, 50000],
    standardRepeaterOffsetMhz: 5.0,
    description: '420 - 450 MHz primary UHF amateur band. Standard repeater split is ±5.0 MHz.',
    presets: HAM_70CM_PRESETS,
  },
];

/**
 * Finds the matching band plan for a given frequency in MHz.
 */
export function findBandPlanForFrequency(freqMhz: number): BandPlan | null {
  for (const bp of MASTER_BAND_PLANS) {
    if (freqMhz >= bp.frequencyMinMhz - 0.05 && freqMhz <= bp.frequencyMaxMhz + 0.05) {
      return bp;
    }
  }
  return null;
}

/**
 * Automatically infers the standard modulation mode for any RF frequency
 * across 100 kHz - 1.75 GHz based on international frequency allocations.
 */
export function inferDefaultModeForFrequency(freqMhz: number): ModulationModeExtended {
  if (freqMhz >= 88.0 && freqMhz <= 108.0) return 'WFM';
  if (freqMhz >= 118.0 && freqMhz <= 137.0) return 'AM';
  if (freqMhz >= 162.4 && freqMhz <= 162.55) return 'WX';
  if (freqMhz >= 26.965 && freqMhz <= 27.405) {
    if (Math.abs(freqMhz - 27.385) < 0.002) return 'LSB'; // Ch 38
    if (Math.abs(freqMhz - 27.315) < 0.002) return 'NFM'; // Ch 31 FM
    return 'AM';
  }
  if (freqMhz >= 144.0 && freqMhz <= 148.0) return 'NFM';
  if (freqMhz >= 420.0 && freqMhz <= 470.0) return 'NFM';
  if (freqMhz >= 156.0 && freqMhz <= 162.0) return 'NFM';
  if (freqMhz < 10.0) return 'LSB'; // Standard amateur HF convention (< 10 MHz)
  return 'USB';                     // Standard amateur HF convention (> 10 MHz)
}
