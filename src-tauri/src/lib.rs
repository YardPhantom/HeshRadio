use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// Exact FCC Part 95 40-Channel CB Synthesizer Frequency Table (in Hz)
/// Accounts for skipped R/C "A-channels" (3A, 7A, 11A, 15A, 19A)
/// and the historical Ch 22 -> 23 -> 24 -> 25 crystal synthesizer permutation.
pub const CB_CHANNEL_FREQS_HZ: [u64; 40] = [
    26_965_000, // Ch 1
    26_975_000, // Ch 2
    26_985_000, // Ch 3  (26.995 MHz = 3A R/C skipped)
    27_005_000, // Ch 4
    27_015_000, // Ch 5
    27_025_000, // Ch 6  ("The Super Bowl")
    27_035_000, // Ch 7  (27.045 MHz = 7A R/C skipped)
    27_055_000, // Ch 8
    27_065_000, // Ch 9  (Official Emergency / Traveler Assistance)
    27_075_000, // Ch 10
    27_085_000, // Ch 11 (27.095 MHz = 11A R/C skipped)
    27_105_000, // Ch 12
    27_115_000, // Ch 13
    27_125_000, // Ch 14
    27_135_000, // Ch 15 (27.145 MHz = 15A R/C skipped)
    27_155_000, // Ch 16
    27_165_000, // Ch 17
    27_175_000, // Ch 18
    27_185_000, // Ch 19 (Primary Highway Trucker Channel - "Breaker 1-9")
    27_205_000, // Ch 20 (27.195 MHz = 19A R/C skipped)
    27_215_000, // Ch 21
    27_225_000, // Ch 22
    27_255_000, // Ch 23 (Jumps to .255 MHz!)
    27_235_000, // Ch 24 (Steps back to .235 MHz!)
    27_245_000, // Ch 25
    27_265_000, // Ch 26
    27_275_000, // Ch 27
    27_285_000, // Ch 28
    27_295_000, // Ch 29
    27_305_000, // Ch 30
    27_315_000, // Ch 31
    27_325_000, // Ch 32
    27_335_000, // Ch 33
    27_345_000, // Ch 34
    27_355_000, // Ch 35
    27_365_000, // Ch 36
    27_375_000, // Ch 37
    27_385_000, // Ch 38 (Primary North American LSB DX Calling Channel)
    27_395_000, // Ch 39
    27_405_000, // Ch 40
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadioRigState {
    pub channel: u8,
    pub frequency_hz: u64,
    pub vfo_a_hz: u64,
    pub vfo_b_hz: u64,
    pub active_vfo: String, // "VFO_A" or "VFO_B"
    pub mode: String,       // "AM", "NFM", "WFM", "USB", "LSB", "CW"
    pub repeater_offset_hz: i64,
    pub ctcss_tone_hz: Option<f32>,
    pub ptt_active: bool,
    pub squelch_dbm: f32,
    pub rf_gain_db: f32,
    pub anl_enabled: bool,
    pub roger_beep: String,
    pub tot_remaining_sec: u32,
}

impl Default for RadioRigState {
    fn default() -> Self {
        Self {
            channel: 19,
            frequency_hz: CB_CHANNEL_FREQS_HZ[18],
            vfo_a_hz: CB_CHANNEL_FREQS_HZ[18],
            vfo_b_hz: CB_CHANNEL_FREQS_HZ[18],
            active_vfo: "VFO_A".to_string(),
            mode: "AM".to_string(),
            repeater_offset_hz: 0,
            ctcss_tone_hz: None,
            ptt_active: false,
            squelch_dbm: -105.0,
            rf_gain_db: 100.0,
            anl_enabled: true,
            roger_beep: "CLASSIC_2475".to_string(),
            tot_remaining_sec: 180,
        }
    }
}

pub struct AppState(pub Mutex<RadioRigState>);

/// Calibrates received power (dBm) to IARU Region 1 Standard S-Units:
/// HF (< 30 MHz): S9 = -73.0 dBm, 6.0 dB per S-unit below S9.
/// VHF/UHF (> 30 MHz): S9 = -93.0 dBm, 6.0 dB per S-unit below S9.
#[tauri::command]
pub fn calculate_s_meter(power_dbm: f32, freq_hz: Option<u64>) -> (u8, f32) {
    let s9_ref = match freq_hz {
        Some(f) if f > 30_000_000 => -93.0,
        _ => -73.0,
    };

    if power_dbm >= s9_ref {
        (9, (power_dbm - s9_ref).min(60.0))
    } else {
        let s_float = 9.0 + (power_dbm - s9_ref) / 6.0;
        let s_unit = s_float.clamp(0.0, 9.0).floor() as u8;
        (s_unit, 0.0)
    }
}

#[tauri::command]
pub fn set_cb_channel(state: State<'_, AppState>, channel: u8) -> Result<RadioRigState, String> {
    if !(1..=40).contains(&channel) {
        return Err("CB Channel must be between 1 and 40".into());
    }
    let mut rig = state.0.lock().map_err(|e| e.to_string())?;
    rig.channel = channel;
    rig.frequency_hz = CB_CHANNEL_FREQS_HZ[(channel - 1) as usize];
    rig.vfo_a_hz = rig.frequency_hz;
    if channel == 38 && rig.mode == "AM" {
        rig.mode = "LSB".to_string();
    }
    Ok(rig.clone())
}

#[tauri::command]
pub fn set_vfo_frequency(state: State<'_, AppState>, freq_hz: u64, vfo: Option<String>) -> Result<RadioRigState, String> {
    if freq_hz < 100_000 || freq_hz > 1_750_000_000 {
        return Err("Frequency must be between 100 kHz and 1.75 GHz".into());
    }
    let mut rig = state.0.lock().map_err(|e| e.to_string())?;
    let target_vfo = vfo.unwrap_or_else(|| rig.active_vfo.clone());
    if target_vfo == "VFO_B" {
        rig.vfo_b_hz = freq_hz;
    } else {
        rig.vfo_a_hz = freq_hz;
    }
    rig.frequency_hz = freq_hz;
    Ok(rig.clone())
}

#[tauri::command]
pub fn set_modulation_mode(state: State<'_, AppState>, mode: String) -> Result<RadioRigState, String> {
    let mut rig = state.0.lock().map_err(|e| e.to_string())?;
    rig.mode = mode;
    Ok(rig.clone())
}

#[tauri::command]
pub fn set_ptt_state(state: State<'_, AppState>, active: bool) -> Result<RadioRigState, String> {
    let mut rig = state.0.lock().map_err(|e| e.to_string())?;
    rig.ptt_active = active;
    if !active {
        rig.tot_remaining_sec = 180;
    }
    Ok(rig.clone())
}

#[tauri::command]
pub fn panic_unkey(state: State<'_, AppState>) -> Result<RadioRigState, String> {
    let mut rig = state.0.lock().map_err(|e| e.to_string())?;
    rig.ptt_active = false;
    rig.tot_remaining_sec = 180;
    Ok(rig.clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(RadioRigState::default())))
        .invoke_handler(tauri::generate_handler![
            calculate_s_meter,
            set_cb_channel,
            set_vfo_frequency,
            set_modulation_mode,
            set_ptt_state,
            panic_unkey
        ])
        .run(tauri::generate_context!())
        .expect("error while running HeshRadio Tauri application");
}
