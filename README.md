# HeshRadio // Tactical 40-Ch CB, SDR Waterfall & Internet Radio Transceiver

**Target Platforms:** Windows Desktop & Android (Samsung Galaxy S26 Ultra)  
**Architecture:** Tauri v2 (Rust Core + React/TypeScript Real-Time DSP UI)

---

## Overview

**HeshRadio** is a tactical Citizens Band (11-Meter 27 MHz CB), NOAA Weather Radio, Software Defined Radio (SDR), and Amateur Radio transceiver & command deck engineered for Windows Desktop and Android (Samsung Galaxy S26 Ultra).

### Phase 1 ("Breaker 1-9") Features
- **Exact FCC Part 95 40-Channel CB Synthesizer (`26.965 – 27.405 MHz`):**
  - Accurately models the 5 skipped R/C "A-channels" (`3A, 7A, 11A, 15A, 19A`) and the non-monotonic crystal synthesizer permutation at **Ch 22 (`27.225 MHz`) $\rightarrow$ Ch 23 (`27.255 MHz`) $\rightarrow$ Ch 24 (`27.235 MHz`) $\rightarrow$ Ch 25 (`27.245 MHz`)**.
  - Priority quick-jump buttons for **Ch 19 Highway (`27.185 MHz`)**, **Ch 9 Emergency (`27.065 MHz`)**, **Ch 6 Super Bowl (`27.025 MHz`)**, **Ch 38 LSB DX Skip (`27.385 MHz`)**, and **7 NOAA Weather Radio Channels (`162.400 – 162.550 MHz`)**.
- **Calibrated IARU S-Meter (`S9 = -73.0 dBm`):**
  - Strictly calibrated to IARU HF/11m standards ($6.0\text{ dB}$ per S-unit below S9, up to $\text{S9}+60\text{ dB}$) on RX, and switches to **RF Output Power ($4\text{W AM} / 12\text{W PEP SSB}$), Modulation %, and SWR** on TX.
- **Authentic CB Voice & RF DSP Audio Chain:**
  - $300\text{–}3000\text{ Hz}$ 4th-order Butterworth voice bandpass filter with $+6.5\text{ dB}$ presence boost at $2.1\text{ kHz}$.
  - Soft-knee $4:1$ **Dynamike** speech compressor and modulation limiter.
  - Squelch gate with $3.0\text{ dB}$ hysteresis ($\theta_{\text{close}} = \theta_{\text{open}} - 3\text{ dB}$) and authentic **$115\text{ ms}$ band-limited pink-noise squelch tail**.
  - Toggleable **Automatic Noise Limiter (ANL) / Ignition Noise Blanker**, **PA / Talkback Monitor**, and selectable **Roger Beep** (`Cobra 2475 Hz`, `NASA Quindar Dual-Tone`, `Morse K`).
  - **Fail-Safe PTT Time-Out Timer (TOT):** $180\text{ s}$ countdown watchdog and automatic panic-unkey on window blur.
- **Zero-Copy 60–120fps LUT Spectrum & Waterfall Display:**
  - 512-point 4-term Blackman-Harris FFT across `26.950 – 27.420 MHz` with zero-allocation `Uint32Array.copyWithin` scanline shifting, 4 color palettes (`KIWISDR`, `PHOSPHOR`, `INFERNO`, `MATRIX_CYAN`), Peak Hold, and Click-to-Tune.
- **Internet Radio Deck with Sidechain Auto-Ducking & LAN WebSocket PTT Relay:**
  - Streams live Icecast stations or built-in offline Highway Cruiser Synth and automatically ducks music volume by **$-18\text{ dB}$ within $15\text{ ms}$** whenever CB squelch breaks or PTT is pressed.

---

## Quick Start

```powershell
npm install
npm run dev
```
Or double-click `run-heshradio.bat`.
