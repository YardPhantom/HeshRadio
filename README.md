# HeshRadio // Tactical Multi-Band SDR Transceiver, CAT Rig Controller & Digital Modes Station

![HeshRadio Banner](https://img.shields.io/badge/HeshRadio-v2.0-amber?style=for-the-badge&logo=radio)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Android%20(Samsung%20S26%20Ultra)-cyan?style=for-the-badge)
![RF Range](https://img.shields.io/badge/Frequency-100%20kHz%20--%201.75%20GHz-emerald?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)

**HeshRadio** is a tactical Software Defined Radio (SDR) receiver, multi-vendor transceiver CAT rig controller, digital communications modem suite, and audio command deck. Engineered with a Rust Tauri v2 core, WebGPU/Canvas 120Hz real-time waterfall DSP, and a mobile tactical cockpit optimized for Windows 10/11 desktop workstations and the Samsung Galaxy S26 Ultra (via USB-OTG and touch thumb controls).

---

## 📻 Hardware Compatibility Matrix

HeshRadio is built for real-world RF field operations, digital ham radio setups, highway trucker communications, and emergency monitoring. It interfaces directly with the following hardware classes:

### 1. Software Defined Radio (SDR) Receivers
* **RTL-SDR Dongles (v3, v4, Blog, NooElec NESDR Nano/SMArt):**
  * Direct plug-and-play **WebUSB** hardware streaming ($2.048\text{ MS/s}$ zero-drop 8-bit unsigned IQ stream).
  * Networked **`rtl_tcp`** bridge support (`127.0.0.1:1234` or remote Raspberry Pi/Linux servers).
  * Direct sampling mode for HF reception below $28\text{ MHz}$ on RTL-SDR v3/v4.
* **Network & Simulated SDRs:**
  * WebSDR and KiwiSDR remote networked receiver streams.
  * Embedded deterministic laboratory RF/IQ signal generator with synthetic thermal noise floor ($-114\text{ dBm}$) and multi-signal carrier synthesis when physical hardware is unplugged.

### 2. Transceiver CAT Rig Control (Computer-Aided Transceiver)
Bidirectional frequency tuning, modulation mode sync, VFO A/B split switching, and calibrated S-meter/power telemetry for physical transceivers:
* **Yaesu:** FT-891, FT-991A, FTDX10, FT-857D, FT-817/818 (ASCII CAT commands over USB virtual serial).
* **Icom CI-V:** IC-7300, IC-705, IC-7610, IC-7100 (Packed Little-Endian BCD over CI-V bus address `0xFE 0xFE <Addr> 0xE0 ... 0xFD`).
* **Kenwood / Elecraft / Xiegu:** TS-590SG, TS-890S, Elecraft KX2/KX3/K3S, Xiegu G90, X6100 (`FA; MD; TX; RX;` ASCII protocol).
* **Hamlib `rigctld` Engine:** Universal TCP network rig control bridge (`127.0.0.1:4532`) supporting 200+ amateur and commercial radio models.

### 3. Digital Soundcard Interfaces & Hardware PTT Keying
* **Digirig Mobile (v1.6 / v1.9):**
  * Integrated CP2102/CP2104 USB-to-UART serial interface.
  * PTT keying via hardware **RTS pin** assertion and optional CW on **DTR pin**.
  * Transformer-isolated TRRS stereo audio input and output.
* **Tigertronics SignaLink USB:**
  * Universal internal VOX audio-activated PTT controller and USB soundcard.
* **C-Media CM108 / CM119 / SSS1623 USB Audio Chips:**
  * Hardware GPIO3 (Pin 13 Bit 2) PTT keying without serial port overhead.
* **Failsafe Hardware PTT Watchdog:**
  * Built-in hardware Time-Out Timer (TOT) with configurable 180s countdown and instantaneous panic-unkey on disconnect or focus loss.

### 4. Host Computing Hardware & Mobile Devices
* **Windows Desktop / Laptop (x64 / ARM64):**
  * Native Tauri v2 windowed application with GPU-accelerated Canvas rendering and multi-monitor layout.
* **Samsung Galaxy S26 Ultra (Android):**
  * USB-OTG host mode with direct WebUSB / USB-Serial device access for RTL-SDR and Digirig dongles.
  * Tactile thumb-friendly Mobile Cockpit with haptic vibration feedback.
  * Dynamic AMOLED 120Hz waterfall refresh.
  * Monochromatic tactical red night vision mode (`filter: hue-rotate(-50deg) saturate(650%)`) preserving scotopic rhodopsin vision during nighttime field operations.

### 5. Acoustic & Audio Transducers
* Dynamic & electret communications microphones (Astatic D104, Cobra HighGear, Heil Sound headsets) through the internal 4:1 Dynamike soft-knee speech compressor and $300\text{–}3000\text{ Hz}$ Butterworth bandpass filter.

---

## ⚡ Core Feature Overview

| Module | Technical Capabilities |
| :--- | :--- |
| **Wideband VFO & Waterfall** | Continuous tuning across **$100\text{ kHz}$ to $1.75\text{ GHz}$** (HF, 11m CB, VHF Airband, Marine, 2m/70cm Ham, NOAA, GMRS/FRS, FM Broadcast). 120Hz GPU waterfall with 4 palettes (KiwiSDR, Phosphor, Inferno, Matrix Cyan) and Peak Hold. |
| **Full Demodulator Bank** | **AM** (envelope detector), **NFM** (polar conjugate discriminator + $750\mu\text{s}$ de-emphasis), **WFM** (wideband FM discriminator + stereo subcarrier + RDS station text decoding), **USB / LSB** (complex analytic bandpass + fast-attack/slow-decay hang AGC), and **CW** ($250\text{ Hz}$ narrow filter + adjustable $400\text{--}1000\text{ Hz}$ BFO pitch). |
| **CTCSS (PL) Sub-Audible Engine** | Full 50 EIA/TIA CTCSS sub-audible tone Goertzel decoder ($67.0\text{ Hz}$ to $254.1\text{ Hz}$) with real-time spectrum analysis, tone squelch gating, and encoder. |
| **High-Speed Tactical Scanner** | **$100\text{ channels/second}$** tactical scanner across 6 pre-configured banks (Highway CB, GMRS/FRS, VHF Marine, Airband, 2m/70cm Repeaters, NOAA Weather) with Priority Channel sampling, Lockout/Skip, Scan Delay, and Hit Counters. |
| **NOAA All-Hazards & EAS SAME** | Monitors all 7 NOAA frequencies ($162.400\text{–}162.550\text{ MHz}$). Embedded $520.83\text{ baud}$ AFSK ($2083.3\text{ Hz} / 1562.5\text{ Hz}$) SAME preamble demodulator parsing Originator, Event Code (TOR, SVR, FFW), and FIPS location codes. |
| **Cockpit Black Box Audio Recorder** | Continuous 60-second lock-free floating-point ring buffer audio recorder with instant replay, pause, scrub, and one-click uncompressed WAV audio export. |
| **Digital Modes Suite** | **APRS** (AX.25 1200 baud Bell 202 AFSK packet decoder/encoder + Maidenhead locator geodesy), **FT8** (synchronous 8-FSK Costas array acoustic modem), and **SSTV** (Robot36 color image scanline encoder/decoder). |
| **ADIF 3.1.4 Logbook** | Full amateur radio logbook with Maidenhead distance/bearing geodesy, QSO filtering, and standard `.adi` ADIF 3.1.4 export compatible with LoTW, QRZ, and Cloudlog. |
| **Solar Space Wx & Greyline** | Real-time solar flux index ($SFI$), Sunspot number ($SSN$), planetary $A$ and $K_p$ geomagnetic indices, Maximum Usable Frequency ($MUF$) estimator, and interactive solar day/night terminator map. |
| **Internet Radio Auto-Ducker** | Live Icecast radio streams automatically duck by **$-18\text{ dB}$ within $15\text{ ms}$** whenever RF carrier squelch breaks or PTT is held, restoring music smoothly after speech ceases. |
| **Laboratory Signal Generator** | Built-in RF calibration laboratory with pure sine, two-tone IMD ($1.0\text{ kHz} + 1.9\text{ kHz}$ for IP3/DR3 testing), white Gaussian noise, and sweep generators. |

---

## 🚀 Quick Start Guide

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or newer)
* [Rust & Cargo](https://www.rust-lang.org/) (for native Tauri desktop builds)

### Installation & Launch

```powershell
# Clone the repository
git clone https://github.com/YardPhantom/HeshRadio.git
cd HeshRadio

# Install dependencies
npm install

# Start development workstation
npm run dev
```

Alternatively on Windows, double-click `run-heshradio.bat`.

Open your browser at `http://localhost:5173/` or launch the Tauri native application:

```powershell
npm run tauri dev
```

---

## 🛠️ Technology Stack
* **UI & Client:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
* **DSP & Audio:** Web Audio API, `Float32Array` lock-free ring buffers, Goertzel tone filters, 4th-order Butterworth IIR filters
* **Desktop Core:** Tauri v2, Rust
* **RF Protocols:** FCC Part 95 & Part 97 tables, IARU S-Meter Calibration, AX.25, SAME EAS, FT8 Costas, Robot36, ADIF 3.1.4

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for details.
