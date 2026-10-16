import { ModulationModeExtended } from './bandPlans';
import { CB_CHANNELS } from './cbChannels';
import { CtcssToneEncoder, GoertzelCtcssDecoder, CtcssDetectionResult } from './ctcssTones';
import { DemodulatorBank, RdsStationData } from './demodulators';

export type RogerBeepType = 'CLASSIC_2475' | 'APOLLO_DUAL' | 'TRUCKER_K' | 'OFF';

export interface SMeterReading {
  powerDbm: number;
  sUnits: number;           // 0 to 9
  overS9Db: number;         // 0 to 60
  formatted: string;        // e.g. "S7" or "S9+15dB"
  needleNormalized: number; // 0.0 to 1.0 for analog/bar meter
  modulationPct: number;    // 0 to 100% during TX/RX
  swrRatio: number;         // e.g. 1.15 during TX
  s9ReferenceDbm: number;   // -73 dBm on HF, -93 dBm on VHF/UHF
}

/**
 * Computes IARU Standard S-Meter reading:
 * - HF (< 30 MHz): S9 = -73.0 dBm (50 uV into 50 Ohms), 6.0 dB per S-unit below S9.
 * - VHF/UHF (> 30 MHz): S9 = -93.0 dBm (5 uV into 50 Ohms), 6.0 dB per S-unit below S9.
 */
export function computeIaruSMeter(
  powerDbm: number,
  modulationPct: number = 0,
  swrRatio: number = 1.15,
  frequencyMhz: number = 27.185
): SMeterReading {
  const s9Ref = frequencyMhz > 30.0 ? -93.0 : -73.0;
  const s0Floor = s9Ref - 54.0; // 9 S-units * 6 dB = 54 dB below S9 (-127 dBm HF, -147 dBm VHF)

  let sUnits = 0;
  let overS9Db = 0;

  if (powerDbm >= s9Ref) {
    sUnits = 9;
    overS9Db = Math.min(60, Math.round(powerDbm - s9Ref));
  } else {
    const rawS = 9.0 + (powerDbm - s9Ref) / 6.0;
    sUnits = Math.max(0, Math.min(9, Math.floor(rawS)));
    overS9Db = 0;
  }

  const formatted = overS9Db > 0 ? `S9+${overS9Db}dB` : `S${sUnits}`;

  let needleNormalized = 0;
  if (powerDbm <= s9Ref) {
    needleNormalized = Math.max(0, (powerDbm - s0Floor) / (s9Ref - s0Floor)) * 0.62;
  } else {
    needleNormalized = 0.62 + Math.min(1, (powerDbm - s9Ref) / 60.0) * 0.38;
  }

  return {
    powerDbm,
    sUnits,
    overS9Db,
    formatted,
    needleNormalized: Math.max(0, Math.min(1, needleNormalized)),
    modulationPct: Math.max(0, Math.min(100, Math.round(modulationPct))),
    swrRatio,
    s9ReferenceDbm: s9Ref,
  };
}

/**
 * Zero-Allocation Wideband Multi-Band DSP Engine (100 kHz - 1.75 GHz).
 * Incorporates:
 * - Full Demodulator Bank (AM, NFM, WFM, USB, LSB, CW)
 * - Goertzel CTCSS 50-Tone Sub-Audible Decoder & Encoder
 * - Real-time Waterfall & Spectrum FFT across tuned RF span
 * - Auto-Ducking sidechain mixer for Internet Radio
 */
export class HeshRadioDspEngine {
  public readonly fftBins = 512;
  public readonly spectrumDb: Float32Array;
  public readonly peakHoldDb: Float32Array;
  private readonly blackmanHarrisWin: Float32Array;
  private readonly rawFreqData: Uint8Array<ArrayBuffer>;

  // Demodulators and CTCSS Subsystems
  public readonly demodulatorBank: DemodulatorBank;
  public readonly ctcssDecoder: GoertzelCtcssDecoder;
  public readonly ctcssEncoder: CtcssToneEncoder;

  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private talkbackGain: GainNode | null = null;
  private staticNoiseGain: GainNode | null = null;
  private cwSidetoneOsc: OscillatorNode | null = null;
  private cwSidetoneGain: GainNode | null = null;
  private rxCarrierOsc: OscillatorNode | null = null;
  private rxCarrierGain: GainNode | null = null;
  private rxWhineOsc: OscillatorNode | null = null;
  private rxWhineGain: GainNode | null = null;

  // Squelch state
  private squelchOpenState = false;
  private currentDuckGain = 1.0;
  private lastVoiceActiveTimestamp = 0;
  private phaseAccumulator = 0;

  // Real-time sub-audible CTCSS audio buffer for Goertzel
  private subAudibleBuffer: Float32Array;
  public latestCtcssResult: CtcssDetectionResult = {
    detectedToneHz: null,
    detectedToneConfidence: 0,
    tonePowers: new Float32Array(50),
    squelchMatches: true,
  };

  // Simulated / Network Incoming Carrier state
  private incomingCarrierActive = false;
  private incomingSignalDbm = -114;
  private incomingFreqMhz = 27.185;

  constructor() {
    this.spectrumDb = new Float32Array(this.fftBins).fill(-118);
    this.peakHoldDb = new Float32Array(this.fftBins).fill(-118);
    this.blackmanHarrisWin = new Float32Array(this.fftBins);
    this.rawFreqData = new Uint8Array(this.fftBins);
    this.subAudibleBuffer = new Float32Array(128);

    this.demodulatorBank = new DemodulatorBank(48000);
    this.ctcssDecoder = new GoertzelCtcssDecoder();
    this.ctcssEncoder = new CtcssToneEncoder();

    // 4-Term Blackman-Harris Window
    const a0 = 0.35875;
    const a1 = 0.48829;
    const a2 = 0.14128;
    const a3 = 0.01168;
    const N = this.fftBins;
    for (let n = 0; n < N; n++) {
      const ratio = (2 * Math.PI * n) / (N - 1);
      this.blackmanHarrisWin[n] =
        a0 - a1 * Math.cos(ratio) + a2 * Math.cos(2 * ratio) - a3 * Math.cos(3 * ratio);
    }
  }

  public async initAudioContext(): Promise<boolean> {
    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
      this.setupStaticFloorAndRxChain();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    return true;
  }

  private setupStaticFloorAndRxChain(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;

    // 3-second looping pink noise static buffer
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

    // 300 - 3000 Hz Standard Voice Passband Filter
    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 300;
    hpFilter.Q.value = 0.707;

    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 3200;
    lpFilter.Q.value = 0.707;

    this.staticNoiseGain = ctx.createGain();
    this.staticNoiseGain.gain.value = 0.0;

    whiteNoise.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(this.staticNoiseGain);
    this.staticNoiseGain.connect(ctx.destination);
    whiteNoise.start(0);

    // Subtle carrier heterodyne oscillator
    this.rxCarrierOsc = ctx.createOscillator();
    this.rxCarrierOsc.type = 'triangle';
    this.rxCarrierOsc.frequency.value = 185;
    this.rxCarrierGain = ctx.createGain();
    this.rxCarrierGain.gain.value = 0;
    this.rxCarrierOsc.connect(lpFilter);
    this.rxCarrierOsc.start(0);

    // Alternator whine (suppressed by ANL)
    this.rxWhineOsc = ctx.createOscillator();
    this.rxWhineOsc.type = 'sawtooth';
    this.rxWhineOsc.frequency.value = 1180;
    this.rxWhineGain = ctx.createGain();
    this.rxWhineGain.gain.value = 0;
    this.rxWhineOsc.connect(lpFilter);
    this.rxWhineOsc.start(0);

    // CW Sidetone Pitch Oscillator (BFO)
    this.cwSidetoneOsc = ctx.createOscillator();
    this.cwSidetoneOsc.type = 'sine';
    this.cwSidetoneOsc.frequency.value = this.demodulatorBank.bfoPitchHz;
    this.cwSidetoneGain = ctx.createGain();
    this.cwSidetoneGain.gain.value = 0.0;
    this.cwSidetoneOsc.connect(this.cwSidetoneGain);
    this.cwSidetoneGain.connect(ctx.destination);
    this.cwSidetoneOsc.start(0);
  }

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

        const presenceBoost = ctx.createBiquadFilter();
        presenceBoost.type = 'peaking';
        presenceBoost.frequency.value = 2100;
        presenceBoost.gain.value = 6.0;

        const lp3000 = ctx.createBiquadFilter();
        lp3000.type = 'lowpass';
        lp3000.frequency.value = 3000;

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

  public setCwSidetone(active: boolean, pitchHz?: number): void {
    if (pitchHz && this.cwSidetoneOsc && this.audioCtx) {
      this.cwSidetoneOsc.frequency.setTargetAtTime(pitchHz, this.audioCtx.currentTime, 0.01);
      this.demodulatorBank.setBfoPitch(pitchHz);
    }
    if (this.cwSidetoneGain && this.audioCtx) {
      this.cwSidetoneGain.gain.setTargetAtTime(
        active ? 0.18 : 0.0,
        this.audioCtx.currentTime,
        0.005
      );
    }
  }

  public playPcmBuffer(samples: Float32Array, sampleRate: number = 48000, gainLevel: number = 0.5): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = ctx.createGain();
    gainNode.gain.value = gainLevel;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
  }

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

  public playRogerBeepAndSquelchTail(beepType: RogerBeepType, masterVolume: number = 0.8): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    let tailStartOffset = 0.01;

    if (beepType === 'CLASSIC_2475') {
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

    if (this.staticNoiseGain) {
      const t0 = now + tailStartOffset;
      this.staticNoiseGain.gain.cancelScheduledValues(t0);
      this.staticNoiseGain.gain.setValueAtTime(0.32 * masterVolume, t0);
      this.staticNoiseGain.gain.setValueAtTime(0.28 * masterVolume, t0 + 0.095);
      this.staticNoiseGain.gain.linearRampToValueAtTime(0.0, t0 + 0.120);
    }
  }

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

  public triggerIncomingTransmission(
    freqMhzOrChannel: number,
    signalDbm: number,
    spokenText: string,
    pitchHz: number,
    masterVolume: number,
    anlEnabled: boolean,
    rogerBeep: RogerBeepType,
    ctcssToneHzOrOnComplete?: number | null | (() => void),
    onComplete?: () => void
  ): void {
    let ctcssToneHz: number | null = null;
    let finishCb = onComplete;
    if (typeof ctcssToneHzOrOnComplete === 'function') {
      finishCb = ctcssToneHzOrOnComplete;
    } else if (typeof ctcssToneHzOrOnComplete === 'number') {
      ctcssToneHz = ctcssToneHzOrOnComplete;
    }

    // Determine freq in MHz (if <= 40, treat as CB channel index)
    const freqMhz =
      freqMhzOrChannel <= 40
        ? (CB_CHANNELS[freqMhzOrChannel - 1] || CB_CHANNELS[18]).frequencyMhz
        : freqMhzOrChannel;

    this.incomingCarrierActive = true;
    this.incomingFreqMhz = freqMhz;
    this.incomingSignalDbm = signalDbm;

    // Simulate CTCSS tone presence in sub-audible path
    if (ctcssToneHz) {
      for (let i = 0; i < this.subAudibleBuffer.length; i++) {
        this.subAudibleBuffer[i] =
          Math.sin((2 * Math.PI * ctcssToneHz * i) / GoertzelCtcssDecoder.SAMPLE_RATE_HZ) * 0.45;
      }
      this.latestCtcssResult = this.ctcssDecoder.processSamples(this.subAudibleBuffer, ctcssToneHz);
    }

    if ('speechSynthesis' in window && masterVolume > 0.02) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(spokenText);
      utter.rate = 1.06;
      utter.pitch = Math.max(0.6, Math.min(1.3, pitchHz / 110));
      utter.volume = Math.min(1.0, masterVolume);
      utter.onend = () => {
        this.incomingCarrierActive = false;
        this.playRogerBeepAndSquelchTail(rogerBeep, masterVolume);
        if (finishCb) finishCb();
      };
      utter.onerror = () => {
        this.incomingCarrierActive = false;
        if (finishCb) finishCb();
      };
      window.speechSynthesis.speak(utter);
    } else {
      const durationMs = Math.max(2800, spokenText.length * 62);
      setTimeout(() => {
        this.incomingCarrierActive = false;
        this.playRogerBeepAndSquelchTail(rogerBeep, masterVolume);
        if (finishCb) finishCb();
      }, durationMs);
    }

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
   * Real-Time DSP Frame Engine (Called at 60-120 Hz)
   */
  public stepDspFrame(params: {
    currentFreqMhz?: number;
    currentChannel?: number;
    spanMhz?: number;
    mode: ModulationModeExtended | 'FM';
    pttActive: boolean;
    squelchThresholdDbm: number;
    rfGainPct: number;
    dynamikePct: number;
    anlEnabled: boolean;
    masterVolume: number;
    autoDuckEnabled: boolean;
    ctcssToneHz?: number | null;
    ctcssSquelchEnabled?: boolean;
    cwBfoPitchHz?: number;
    rawIqData?: { i: Float32Array; q: Float32Array } | null;
  }): {
    sMeter: SMeterReading;
    squelchOpen: boolean;
    duckGain: number;
    rdsData: RdsStationData;
    ctcssResult: CtcssDetectionResult;
  } {
    this.phaseAccumulator += 0.08;
    const rfGainOffsetDb = ((params.rfGainPct - 100) / 100) * 30.0;
    const centerFreqMhz =
      params.currentFreqMhz ??
      (params.currentChannel
        ? (CB_CHANNELS[params.currentChannel - 1] || CB_CHANNELS[18]).frequencyMhz
        : 27.185);
    const spanMhz = Math.max(0.05, params.spanMhz || 0.470);
    const spanStartMhz = centerFreqMhz - spanMhz / 2;

    // 1. Microphone Modulation during PTT
    let txModPct = 0;
    if (params.pttActive) {
      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(this.rawFreqData);
        let sum = 0;
        for (let i = 4; i < 68; i++) sum += this.rawFreqData[i];
        const avg = sum / 64;
        txModPct = Math.min(100, (avg / 145) * (params.dynamikePct / 80) * 100);
      }
      if (txModPct < 12) {
        txModPct =
          28 +
          22 * Math.abs(Math.sin(this.phaseAccumulator * 3.1)) +
          18 * Math.abs(Math.cos(this.phaseAccumulator * 7.4));
      }
    }

    // 2. Base Thermal and Atmospheric RF Noise Floor
    // VHF/UHF (> 30 MHz) has significantly lower atmospheric noise floor than HF
    const baseNoiseDbm =
      (centerFreqMhz > 30.0 ? -122.0 : (params.anlEnabled ? -115.5 : -107.0)) +
      rfGainOffsetDb * 0.4;

    for (let k = 0; k < this.fftBins; k++) {
      const thermalJitter =
        Math.sin(k * 12.9898 + this.phaseAccumulator * 19.7) * 2.2 +
        Math.cos(k * 78.233 - this.phaseAccumulator * 11.3) * 1.8;
      const ignitionSpike =
        !params.anlEnabled && centerFreqMhz < 30.0 && ((k * 31 + Math.floor(this.phaseAccumulator * 10)) % 97 === 0)
          ? 14.0
          : 0.0;

      let binTargetDb = baseNoiseDbm + thermalJitter + ignitionSpike;
      const binFreqMhz = spanStartMhz + (k / this.fftBins) * spanMhz;

      // Active Incoming Transmission
      if (this.incomingCarrierActive) {
        const df = binFreqMhz - this.incomingFreqMhz;
        if (Math.abs(df) < spanMhz * 0.035) {
          const carrierPeak =
            Math.abs(df) < spanMhz * 0.005
              ? this.incomingSignalDbm + rfGainOffsetDb
              : this.incomingSignalDbm -
                12 +
                8 * Math.abs(Math.sin(this.phaseAccumulator * 6.5 + k * 0.7)) +
                rfGainOffsetDb;
          const passbandShape = Math.exp(-(df * df) / ((spanMhz * 0.015) ** 2));
          binTargetDb = Math.max(binTargetDb, baseNoiseDbm + (carrierPeak - baseNoiseDbm) * passbandShape);
        }
      }

      // User Local Transmit Carrier
      if (params.pttActive) {
        const dfTx = binFreqMhz - centerFreqMhz;
        if (Math.abs(dfTx) < spanMhz * 0.04) {
          const txPowerDbm = -20.0 + (txModPct / 100) * 8.0;
          const txShape = Math.exp(-(dfTx * dfTx) / ((spanMhz * 0.012) ** 2));
          binTargetDb = Math.max(binTargetDb, baseNoiseDbm + (txPowerDbm - baseNoiseDbm) * txShape);
        }
      }

      // Smooth with Exponential Moving Average (EMA)
      const prev = this.spectrumDb[k];
      const alpha = binTargetDb > prev ? 0.62 : 0.16;
      const smoothed = prev + alpha * (binTargetDb - prev);
      this.spectrumDb[k] = smoothed;

      // Peak-Hold trace
      if (smoothed >= this.peakHoldDb[k]) {
        this.peakHoldDb[k] = smoothed;
      } else {
        this.peakHoldDb[k] = Math.max(-135, this.peakHoldDb[k] - 0.12);
      }
    }

    // 3. Channel Power at Tuned Frequency Center
    const centerBin = Math.floor(this.fftBins / 2);
    let channelPeakDbm = -135;
    for (let b = Math.max(0, centerBin - 3); b <= Math.min(this.fftBins - 1, centerBin + 3); b++) {
      if (this.spectrumDb[b] > channelPeakDbm) {
        channelPeakDbm = this.spectrumDb[b];
      }
    }

    // 4. CTCSS Sub-Audible Detection & Tone Squelch
    if (params.ctcssToneHz && this.incomingCarrierActive) {
      // Simulate real-time tone decoder response
      this.latestCtcssResult = {
        detectedToneHz: params.ctcssToneHz,
        detectedToneConfidence: 0.94,
        tonePowers: this.latestCtcssResult.tonePowers,
        squelchMatches: true,
      };
    } else if (!this.incomingCarrierActive) {
      this.latestCtcssResult = {
        detectedToneHz: null,
        detectedToneConfidence: 0,
        tonePowers: this.latestCtcssResult.tonePowers,
        squelchMatches: !params.ctcssSquelchEnabled,
      };
    }

    // 5. Evaluate Hysteresis Squelch Gate (RF Squelch + Optional CTCSS Tone Match)
    let rfSquelchPassed = false;
    if (!params.pttActive) {
      if (!this.squelchOpenState && channelPeakDbm >= params.squelchThresholdDbm) {
        rfSquelchPassed = true;
      } else if (this.squelchOpenState && channelPeakDbm >= params.squelchThresholdDbm - 3.0) {
        rfSquelchPassed = true;
      }
    } else {
      rfSquelchPassed = true;
    }

    const ctcssPassed =
      !params.ctcssSquelchEnabled ||
      params.pttActive ||
      this.latestCtcssResult.squelchMatches;

    this.squelchOpenState = rfSquelchPassed && ctcssPassed;

    if (this.audioCtx && this.staticNoiseGain && !this.incomingCarrierActive && !params.pttActive) {
      const targetStatic = this.squelchOpenState ? 0.09 * params.masterVolume : 0.0;
      this.staticNoiseGain.gain.setTargetAtTime(targetStatic, this.audioCtx.currentTime, 0.03);
    }

    // 6. Sidechain Auto-Ducker for Internet Radio
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

    const duckAlpha = targetDuck < this.currentDuckGain ? 0.45 : 0.06;
    this.currentDuckGain += duckAlpha * (targetDuck - this.currentDuckGain);

    // 7. Calibrated IARU S-Meter Reading (Passes Center Frequency to select HF vs VHF S9)
    const modPct = params.pttActive
      ? txModPct
      : this.incomingCarrierActive
      ? 62 + 28 * Math.abs(Math.sin(this.phaseAccumulator * 4.8))
      : this.squelchOpenState
      ? 14
      : 0;

    const sMeter = computeIaruSMeter(channelPeakDbm, modPct, 1.15, centerFreqMhz);

    return {
      sMeter,
      squelchOpen: this.squelchOpenState,
      duckGain: this.currentDuckGain,
      rdsData: this.demodulatorBank.rdsData,
      ctcssResult: this.latestCtcssResult,
    };
  }
}
