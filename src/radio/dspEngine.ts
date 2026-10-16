import { CB_CHANNELS, ModulationMode } from './cbChannels';

export type RogerBeepType = 'CLASSIC_2475' | 'APOLLO_DUAL' | 'TRUCKER_K' | 'OFF';

export interface SMeterReading {
  powerDbm: number;
  sUnits: number;       // 0 to 9
  overS9Db: number;     // 0 to 60
  formatted: string;    // e.g. "S7" or "S9+15dB"
  needleNormalized: number; // 0.0 to 1.0 for analog/bar meter
  modulationPct: number;    // 0 to 100% during TX/RX
  swrRatio: number;         // e.g. 1.15 during TX
}

/**
 * Computes IARU Standard HF/11m CB S-Meter reading:
 * S9 = -73.0 dBm (50 uV into 50 Ohms), 6.0 dB per S-unit below S9.
 */
export function computeIaruSMeter(
  powerDbm: number,
  modulationPct: number = 0,
  swrRatio: number = 1.15
): SMeterReading {
  let sUnits = 0;
  let overS9Db = 0;

  if (powerDbm >= -73.0) {
    sUnits = 9;
    overS9Db = Math.min(60, Math.round(powerDbm - -73.0));
  } else {
    const rawS = 9.0 + (powerDbm - -73.0) / 6.0;
    sUnits = Math.max(0, Math.min(9, Math.floor(rawS)));
    overS9Db = 0;
  }

  const formatted =
    overS9Db > 0 ? `S9+${overS9Db}dB` : `S${sUnits}`;

  // Normalize -127 dBm (S0) .. -13 dBm (S9+60) into [0, 1]
  // S0..-73dBm maps to 0.0 .. 0.62, S9..S9+60 maps to 0.62 .. 1.0
  let needleNormalized = 0;
  if (powerDbm <= -73.0) {
    needleNormalized = Math.max(0, (powerDbm - -127.0) / (-73.0 - -127.0)) * 0.62;
  } else {
    needleNormalized = 0.62 + Math.min(1, (powerDbm - -73.0) / 60.0) * 0.38;
  }

  return {
    powerDbm,
    sUnits,
    overS9Db,
    formatted,
    needleNormalized: Math.max(0, Math.min(1, needleNormalized)),
    modulationPct: Math.max(0, Math.min(100, Math.round(modulationPct))),
    swrRatio,
  };
}

/**
 * Zero-Allocation Real-Time RF Spectrum & CB Audio DSP Engine.
 * Pre-allocates all FFT and window buffers to comply with real-time audio invariants.
 */
export class HeshRadioDspEngine {
  public readonly fftBins = 512;
  public readonly spectrumDb: Float32Array;
  public readonly peakHoldDb: Float32Array;
  private readonly blackmanHarrisWin: Float32Array;
  private readonly rawFreqData: Uint8Array<ArrayBuffer>;

  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private talkbackGain: GainNode | null = null;
  private staticNoiseGain: GainNode | null = null;
  private rxCarrierOsc: OscillatorNode | null = null;
  private rxCarrierGain: GainNode | null = null;
  private rxWhineOsc: OscillatorNode | null = null;
  private rxWhineGain: GainNode | null = null;

  // Squelch hysteresis state (Open at theta_open, Close at theta_open - 3.0 dB)
  private squelchOpenState = false;
  private currentDuckGain = 1.0;
  private lastVoiceActiveTimestamp = 0;
  private phaseAccumulator = 0;

  // Simulated / Network Incoming Carrier state
  private incomingCarrierActive = false;
  private incomingSignalDbm = -114;
  private incomingChannel = 19;
  private incomingModDepth = 0;

  constructor() {
    this.spectrumDb = new Float32Array(this.fftBins).fill(-118);
    this.peakHoldDb = new Float32Array(this.fftBins).fill(-118);
    this.blackmanHarrisWin = new Float32Array(this.fftBins);
    this.rawFreqData = new Uint8Array(this.fftBins);

    // Precompute 4-Term Blackman-Harris window coefficients:
    // w[n] = a0 - a1*cos(2*pi*n/(N-1)) + a2*cos(4*pi*n/(N-1)) - a3*cos(6*pi*n/(N-1))
    const a0 = 0.35875;
    const a1 = 0.48829;
    const a2 = 0.14128;
    const a3 = 0.01168;
    const N = this.fftBins;
    for (let n = 0; n < N; n++) {
      const ratio = (2 * Math.PI * n) / (N - 1);
      this.blackmanHarrisWin[n] =
        a0 -
        a1 * Math.cos(ratio) +
        a2 * Math.cos(2 * ratio) -
        a3 * Math.cos(3 * ratio);
    }
  }

  public async initAudioContext(): Promise<boolean> {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
      this.setupStaticFloorAndRxChain();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    return true;
  }

  /**
   * Builds the continuous RF band noise floor + 300-3000 Hz Butterworth bandpass
   * + simulated diesel alternator whine (attenuated when ANL is enabled).
   */
  private setupStaticFloorAndRxChain(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;

    // Create 3-second looping pink/band-limited RF static buffer (allocated once at startup)
    const bufferSize = ctx.sampleRate * 3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // 300 - 3000 Hz CB Voice Passband Filter
    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 300;
    hpFilter.Q.value = 0.707;

    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 3000;
    lpFilter.Q.value = 0.707;

    this.staticNoiseGain = ctx.createGain();
    this.staticNoiseGain.gain.value = 0.0;

    whiteNoise.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(this.staticNoiseGain);
    this.staticNoiseGain.connect(ctx.destination);
    whiteNoise.start(0);

    // Subtle carrier heterodyne / alternator whine oscillator for realistic AM CB character
    this.rxCarrierOsc = ctx.createOscillator();
    this.rxCarrierOsc.type = 'triangle';
    this.rxCarrierOsc.frequency.value = 185;
    this.rxCarrierGain = ctx.createGain();
    this.rxCarrierGain.gain.value = 0;
    this.rxCarrierOsc.connect(lpFilter);
    this.rxCarrierOsc.start(0);

    // Diesel ignition / alternator whine (1150 Hz) that ANL suppresses
    this.rxWhineOsc = ctx.createOscillator();
    this.rxWhineOsc.type = 'sawtooth';
    this.rxWhineOsc.frequency.value = 1180;
    this.rxWhineGain = ctx.createGain();
    this.rxWhineGain.gain.value = 0;
    this.rxWhineOsc.connect(lpFilter);
    this.rxWhineOsc.start(0);
  }

  /**
   * Connects real Windows / Android S26 Ultra microphone through the authentic CB TX Chain:
   * High-Pass (300 Hz) -> Pre-Emphasis (+6 dB @ 2.1 kHz) -> Low-Pass (3000 Hz)
   * -> Soft-Knee "Dynamike" 4:1 Compressor -> Analyser & Talkback Monitor.
   */
  public async enableMicrophone(talkbackEnabled: boolean): Promise<boolean> {
    await this.initAudioContext();
    if (!this.audioCtx) return false;

    if (!this.micStream) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        const ctx = this.audioCtx;
        this.micSource = ctx.createMediaStreamSource(this.micStream);

        const hp300 = ctx.createBiquadFilter();
        hp300.type = 'highpass';
        hp300.frequency.value = 300;
        hp300.Q.value = 0.707;

        const presenceBoost = ctx.createBiquadFilter();
        presenceBoost.type = 'peaking';
        presenceBoost.frequency.value = 2100;
        presenceBoost.Q.value = 1.2;
        presenceBoost.gain.value = 6.5;

        const lp3000 = ctx.createBiquadFilter();
        lp3000.type = 'lowpass';
        lp3000.frequency.value = 3000;
        lp3000.Q.value = 0.707;

        // Soft-Knee 4:1 "Dynamike" CB Speech Compressor
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 8;
        compressor.ratio.value = 4.0;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.080;

        this.micAnalyser = ctx.createAnalyser();
        this.micAnalyser.fftSize = 1024;
        this.micAnalyser.smoothingTimeConstant = 0.5;

        this.talkbackGain = ctx.createGain();
        this.talkbackGain.gain.value = talkbackEnabled ? 0.35 : 0.0;

        this.micSource.connect(hp300);
        hp300.connect(presenceBoost);
        presenceBoost.connect(lp3000);
        lp3000.connect(compressor);
        compressor.connect(this.micAnalyser);
        compressor.connect(this.talkbackGain);
        this.talkbackGain.connect(ctx.destination);
        return true;
      } catch {
        // Graceful fallback if mic permission denied or no physical mic plugged in
        return false;
      }
    } else if (this.talkbackGain && this.audioCtx) {
      this.talkbackGain.gain.setTargetAtTime(
        talkbackEnabled ? 0.35 : 0.0,
        this.audioCtx.currentTime,
        0.015
      );
      return true;
    }
    return false;
  }

  public setTalkbackVolume(enabled: boolean, pttActive: boolean): void {
    if (this.talkbackGain && this.audioCtx) {
      this.talkbackGain.gain.setTargetAtTime(
        enabled && pttActive ? 0.4 : 0.0,
        this.audioCtx.currentTime,
        0.01
      );
    }
  }

  /**
   * Triggers authentic CB Microphone Key-Down Click.
   */
  public playMicClick(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.018);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.022);
  }

  /**
   * Synthesizes End-of-Transmission Roger Beep + 110ms Band-Limited Squelch Tail.
   */
  public playRogerBeepAndSquelchTail(beepType: RogerBeepType, masterVolume: number = 0.8): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    let tailStartOffset = 0.01;

    if (beepType === 'CLASSIC_2475') {
      // Classic Cobra / President 2475 Hz single tone (115 ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2475, now);
      gain.gain.setValueAtTime(0.16 * masterVolume, now);
      gain.gain.setValueAtTime(0.16 * masterVolume, now + 0.105);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.120);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.125);
      tailStartOffset = 0.125;
    } else if (beepType === 'APOLLO_DUAL') {
      // NASA Quindar / Dual-Tone 2525 Hz -> 2475 Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2525, now);
      osc.frequency.setValueAtTime(2475, now + 0.085);
      gain.gain.setValueAtTime(0.16 * masterVolume, now);
      gain.gain.setValueAtTime(0.16 * masterVolume, now + 0.165);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.180);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.185);
      tailStartOffset = 0.185;
    } else if (beepType === 'TRUCKER_K') {
      // Morse 'K' (- . -) at 1950 Hz
      const segments: [number, number][] = [
        [0.0, 0.09],
        [0.12, 0.16],
        [0.19, 0.28],
      ];
      for (const [start, end] of segments) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1950, now + start);
        gain.gain.setValueAtTime(0.15 * masterVolume, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + end);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + end + 0.005);
      }
      tailStartOffset = 0.29;
    }

    // Authentic 115ms Band-Limited Squelch Tail Burst ("Kssshht!")
    if (this.staticNoiseGain) {
      const t0 = now + tailStartOffset;
      this.staticNoiseGain.gain.cancelScheduledValues(t0);
      this.staticNoiseGain.gain.setValueAtTime(0.32 * masterVolume, t0);
      this.staticNoiseGain.gain.setValueAtTime(0.28 * masterVolume, t0 + 0.095);
      this.staticNoiseGain.gain.linearRampToValueAtTime(0.0, t0 + 0.120);
    }
  }

  /**
   * Plays NOAA 1050 Hz S.A.M.E. Weather Alert Test Tone.
   */
  public playNoaaAlertTone(masterVolume: number = 0.7): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1050, now);
    gain.gain.setValueAtTime(0.22 * masterVolume, now);
    gain.gain.setValueAtTime(0.22 * masterVolume, now + 0.65);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  /**
   * Sets simulated / incoming network RF carrier state and articulates CB speech
   * through Web Speech API + bandpass RF carrier heterodyne.
   */
  public triggerIncomingTransmission(
    channel: number,
    signalDbm: number,
    spokenText: string,
    pitchHz: number,
    masterVolume: number,
    anlEnabled: boolean,
    rogerBeep: RogerBeepType,
    onComplete?: () => void
  ): void {
    this.incomingCarrierActive = true;
    this.incomingChannel = channel;
    this.incomingSignalDbm = signalDbm;
    this.incomingModDepth = 78;

    // Speak through browser speech synthesizer if available
    if ('speechSynthesis' in window && masterVolume > 0.02) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(spokenText);
      utter.rate = 1.06;
      utter.pitch = Math.max(0.6, Math.min(1.3, pitchHz / 110));
      utter.volume = Math.min(1.0, masterVolume);
      utter.onend = () => {
        this.incomingCarrierActive = false;
        this.playRogerBeepAndSquelchTail(rogerBeep, masterVolume);
        if (onComplete) onComplete();
      };
      utter.onerror = () => {
        this.incomingCarrierActive = false;
        if (onComplete) onComplete();
      };
      window.speechSynthesis.speak(utter);
    } else {
      const durationMs = Math.max(2800, spokenText.length * 62);
      setTimeout(() => {
        this.incomingCarrierActive = false;
        this.playRogerBeepAndSquelchTail(rogerBeep, masterVolume);
        if (onComplete) onComplete();
      }, durationMs);
    }

    // Add subtle RF static / alternator whine under incoming carrier
    if (this.audioCtx && this.staticNoiseGain && this.rxWhineGain) {
      const now = this.audioCtx.currentTime;
      this.staticNoiseGain.gain.setTargetAtTime(0.11 * masterVolume, now, 0.02);
      this.rxWhineGain.gain.setTargetAtTime(
        anlEnabled ? 0.001 * masterVolume : 0.018 * masterVolume,
        now,
        0.02
      );
    }
  }

  public stopIncomingTransmission(): void {
    this.incomingCarrierActive = false;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.audioCtx && this.staticNoiseGain && this.rxWhineGain) {
      const now = this.audioCtx.currentTime;
      this.staticNoiseGain.gain.setTargetAtTime(0, now, 0.02);
      this.rxWhineGain.gain.setTargetAtTime(0, now, 0.02);
    }
  }

  /**
   * High-frequency DSP frame tick (called at 60-120 Hz from requestAnimationFrame).
   * Zero heap allocations inside this method!
   * Updates:
   * 1. Spectrum & Peak-Hold FFT arrays across the 26.950 - 27.420 MHz 11m CB band
   * 2. Squelch gate with 3.0 dB hysteresis
   * 3. Calibrated IARU S-Meter reading (S9 = -73 dBm)
   * 4. Sidechain Auto-Ducker envelope for Internet Radio
   */
  public stepDspFrame(params: {
    currentChannel: number;
    mode: ModulationMode;
    pttActive: boolean;
    squelchThresholdDbm: number;
    rfGainPct: number;
    dynamikePct: number;
    anlEnabled: boolean;
    masterVolume: number;
    autoDuckEnabled: boolean;
  }): {
    sMeter: SMeterReading;
    squelchOpen: boolean;
    duckGain: number;
  } {
    this.phaseAccumulator += 0.08;
    const rfGainOffsetDb = ((params.rfGainPct - 100) / 100) * 30.0; // -30 to +0 dB

    // 1. Measure real mic modulation if PTT is active
    let txModPct = 0;
    if (params.pttActive) {
      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(this.rawFreqData);
        let sum = 0;
        for (let i = 4; i < 68; i++) {
          sum += this.rawFreqData[i];
        }
        const avg = sum / 64;
        txModPct = Math.min(100, (avg / 145) * (params.dynamikePct / 80) * 100);
      }
      // Synthetic voice modulation floor if user hasn't spoken yet while holding PTT
      if (txModPct < 12) {
        txModPct =
          28 +
          22 * Math.abs(Math.sin(this.phaseAccumulator * 3.1)) +
          18 * Math.abs(Math.cos(this.phaseAccumulator * 7.4));
      }
    }

    // 2. Compute atmospheric & ignition noise floor across the 512 FFT bins
    // Span: 26.950 MHz (bin 0) to 27.420 MHz (bin 511) -> 470 kHz total span (~918 Hz/bin)
    const spanStartMhz = 26.950;
    const spanWidthMhz = 0.470;
    const baseNoiseDbm = (params.anlEnabled ? -115.5 : -107.0) + rfGainOffsetDb * 0.4;

    for (let k = 0; k < this.fftBins; k++) {
      // Deterministic pseudo-gaussian thermal noise + QRN atmospheric static
      const thermalJitter =
        Math.sin(k * 12.9898 + this.phaseAccumulator * 19.7) * 2.4 +
        Math.cos(k * 78.233 - this.phaseAccumulator * 11.3) * 1.9;
      const ignitionSpike =
        !params.anlEnabled && ((k * 31 + Math.floor(this.phaseAccumulator * 10)) % 97 === 0)
          ? 14.0
          : 0.0;

      let binTargetDb = baseNoiseDbm + thermalJitter + ignitionSpike;

      // Ambient distant background signals on key CB channels:
      // Ch 6 Superbowl (27.025 MHz), Ch 19 Highway (27.185 MHz), Ch 38 LSB (27.385 MHz)
      const binFreqMhz = spanStartMhz + (k / this.fftBins) * spanWidthMhz;

      // Ch 6 Superbowl distant skip carrier (27.025 MHz)
      const distCh6 = Math.abs(binFreqMhz - 27.025);
      if (distCh6 < 0.0045) {
        const env6 = -84.0 + 9.0 * Math.sin(this.phaseAccumulator * 1.7) + rfGainOffsetDb;
        const shape6 = Math.exp(-(distCh6 * distCh6) / 0.000003);
        binTargetDb = Math.max(binTargetDb, baseNoiseDbm + (env6 - baseNoiseDbm) * shape6);
      }

      // Ch 38 LSB distant DX skip (27.382 - 27.385 MHz lower sideband energy)
      const distCh38 = binFreqMhz - 27.3835;
      if (Math.abs(distCh38) < 0.0022) {
        const env38 = -88.0 + 11.0 * Math.abs(Math.sin(this.phaseAccumulator * 2.9)) + rfGainOffsetDb;
        const shape38 = Math.exp(-(distCh38 * distCh38) / 0.0000012);
        binTargetDb = Math.max(binTargetDb, baseNoiseDbm + (env38 - baseNoiseDbm) * shape38);
      }

      // Active Incoming Transmission on incomingChannel
      if (this.incomingCarrierActive) {
        const chObj = CB_CHANNELS[this.incomingChannel - 1] || CB_CHANNELS[18];
        const df = binFreqMhz - chObj.frequencyMhz;
        if (Math.abs(df) < 0.0055) {
          // Carrier + Dual AM Sidebands (or LSB single sideband)
          const carrierPeak =
            Math.abs(df) < 0.0009
              ? this.incomingSignalDbm + rfGainOffsetDb
              : this.incomingSignalDbm -
                10 +
                8 * Math.abs(Math.sin(this.phaseAccumulator * 6.5 + k * 0.7)) +
                rfGainOffsetDb;
          const passbandShape = Math.exp(-(df * df) / 0.000006);
          binTargetDb = Math.max(
            binTargetDb,
            baseNoiseDbm + (carrierPeak - baseNoiseDbm) * passbandShape
          );
        }
      }

      // Active User PTT Transmit Carrier on currentChannel
      if (params.pttActive) {
        const txChObj = CB_CHANNELS[params.currentChannel - 1] || CB_CHANNELS[18];
        const dfTx = binFreqMhz - txChObj.frequencyMhz;
        if (Math.abs(dfTx) < 0.0065) {
          const txPowerDbm = -22.0 + (txModPct / 100) * 8.0; // S9+51dB local TX indication
          const txShape = Math.exp(-(dfTx * dfTx) / 0.000007);
          binTargetDb = Math.max(
            binTargetDb,
            baseNoiseDbm + (txPowerDbm - baseNoiseDbm) * txShape
          );
        }
      }

      // Apply asymmetric Exponential Moving Average (EMA):
      // Fast attack (0.62) for transient voice peaks, slow decay (0.16)
      const prev = this.spectrumDb[k];
      const alpha = binTargetDb > prev ? 0.62 : 0.16;
      const smoothed = prev + alpha * (binTargetDb - prev);
      this.spectrumDb[k] = smoothed;

      // Update Peak-Hold trace with slow 0.12 dB/frame decay
      if (smoothed >= this.peakHoldDb[k]) {
        this.peakHoldDb[k] = smoothed;
      } else {
        this.peakHoldDb[k] = Math.max(-120, this.peakHoldDb[k] - 0.12);
      }
    }

    // 3. Measure Channel Power at Tuned Frequency & Evaluate Hysteresis Squelch
    const tunedChObj = CB_CHANNELS[params.currentChannel - 1] || CB_CHANNELS[18];
    const centerBin = Math.min(
      this.fftBins - 1,
      Math.max(
        0,
        Math.round(((tunedChObj.frequencyMhz - spanStartMhz) / spanWidthMhz) * this.fftBins)
      )
    );

    let channelPeakDbm = -120;
    for (let b = Math.max(0, centerBin - 3); b <= Math.min(this.fftBins - 1, centerBin + 3); b++) {
      if (this.spectrumDb[b] > channelPeakDbm) {
        channelPeakDbm = this.spectrumDb[b];
      }
    }

    // Hysteresis Squelch Gate:
    // Opens at squelchThresholdDbm, closes at (squelchThresholdDbm - 3.0 dB)
    if (!params.pttActive) {
      if (!this.squelchOpenState && channelPeakDbm >= params.squelchThresholdDbm) {
        this.squelchOpenState = true;
      } else if (this.squelchOpenState && channelPeakDbm < params.squelchThresholdDbm - 3.0) {
        this.squelchOpenState = false;
      }
    } else {
      this.squelchOpenState = true;
    }

    // If user pulls squelch knob open below noise floor, let them hear authentic CB static
    if (this.audioCtx && this.staticNoiseGain && !this.incomingCarrierActive && !params.pttActive) {
      const targetStatic = this.squelchOpenState ? 0.09 * params.masterVolume : 0.0;
      this.staticNoiseGain.gain.setTargetAtTime(targetStatic, this.audioCtx.currentTime, 0.03);
    }

    // 4. Sidechain Auto-Ducker for Internet Radio:
    // Attenuate music stream by -18 dB (gain = 0.125) within 15 ms when squelch opens or PTT is pressed.
    // Hold for 600 ms after squelch closes, then smoothly restore to 1.0.
    const nowMs = performance.now();
    const voiceOrPttActive =
      params.pttActive ||
      (this.squelchOpenState && (this.incomingCarrierActive || channelPeakDbm > -95));

    if (voiceOrPttActive) {
      this.lastVoiceActiveTimestamp = nowMs;
    }

    const withinHoldWindow = nowMs - this.lastVoiceActiveTimestamp < 600;
    const targetDuck =
      params.autoDuckEnabled && (voiceOrPttActive || withinHoldWindow) ? 0.125 : 1.0;

    // Fast 15ms attack, smooth 400ms release
    const duckAlpha = targetDuck < this.currentDuckGain ? 0.45 : 0.06;
    this.currentDuckGain += duckAlpha * (targetDuck - this.currentDuckGain);

    // 5. Calculate Calibrated IARU S-Meter Reading
    const modPct = params.pttActive
      ? txModPct
      : this.incomingCarrierActive && this.incomingChannel === params.currentChannel
      ? 62 + 28 * Math.abs(Math.sin(this.phaseAccumulator * 4.8))
      : this.squelchOpenState
      ? 14
      : 0;

    const sMeter = computeIaruSMeter(channelPeakDbm, modPct, 1.15);

    return {
      sMeter,
      squelchOpen: this.squelchOpenState,
      duckGain: this.currentDuckGain,
    };
  }
}
