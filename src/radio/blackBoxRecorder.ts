/**
 * Tactical "Black Box" Cockpit Audio Recorder & Rolling 30-Second "Say Again" Replay
 *
 * Implements:
 * 1. Rolling 30-Second Circular Audio Buffer for instantaneous replay of missed transmissions.
 * 2. Automatic Squelch-Gated Audio Clip Capture with metadata (UTC time, frequency, mode, S-meter).
 * 3. Standard RIFF WAV (16-bit PCM Mono 48 kHz) file encoder and export.
 */

import { downloadBlob } from '../utils/fileExport';

export interface RecordedTransmissionClip {
  id: string;
  utcTimestamp: string;
  channelLabel: string;
  frequencyMhz: number;
  mode: string;
  durationSeconds: number;
  peakDbm: number;
  samples: Float32Array;
  blobUrl?: string;
}

export class BlackBoxRecorder {
  private sampleRate: number;
  private ringCapacity: number;
  private ringBuffer: Float32Array;
  private writeIndex = 0;
  private totalSamplesWritten = 0;

  // Squelch-Triggered Active Clip Capture
  private isCapturingClip = false;
  private activeClipSamples: number[] = [];
  private activeClipStartTime = '';
  private activeClipFreqMhz = 27.185;
  private activeClipChannelLabel = 'CH 19';
  private activeClipMode = 'AM';
  private activeClipPeakDbm = -120;

  private clipHistory: RecordedTransmissionClip[] = [];
  private maxClipHistory = 25;

  constructor(sampleRate = 48000, maxSeconds = 30) {
    this.sampleRate = sampleRate;
    this.ringCapacity = Math.floor(sampleRate * maxSeconds);
    this.ringBuffer = new Float32Array(this.ringCapacity);
  }

  /**
   * High-frequency zero-allocation write method called by the audio DSP thread.
   */
  public pushAudioSamples(samples: Float32Array, peakSignalDbm = -100): void {
    const len = samples.length;
    for (let i = 0; i < len; i++) {
      this.ringBuffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.ringCapacity;
    }
    this.totalSamplesWritten += len;

    // If currently capturing a transmission clip
    if (this.isCapturingClip) {
      for (let i = 0; i < len; i++) {
        this.activeClipSamples.push(samples[i]);
      }
      if (peakSignalDbm > this.activeClipPeakDbm) {
        this.activeClipPeakDbm = peakSignalDbm;
      }
    }
  }

  /**
   * Notify recorder when receiver squelch gate opens or closes.
   */
  public notifySquelch(
    squelchOpen: boolean,
    frequencyMhz: number,
    channelLabel: string,
    mode: string,
    currentDbm: number
  ): RecordedTransmissionClip | null {
    if (squelchOpen && !this.isCapturingClip) {
      // Start recording new clip
      this.isCapturingClip = true;
      this.activeClipSamples = [];
      this.activeClipStartTime = new Date().toISOString().slice(11, 19) + 'Z';
      this.activeClipFreqMhz = frequencyMhz;
      this.activeClipChannelLabel = channelLabel;
      this.activeClipMode = mode;
      this.activeClipPeakDbm = currentDbm;
      return null;
    } else if (!squelchOpen && this.isCapturingClip) {
      // Finalize clip
      this.isCapturingClip = false;
      const count = this.activeClipSamples.length;
      // Only keep clips longer than 250 ms (~12,000 samples) to avoid squelch pops
      if (count > this.sampleRate * 0.25) {
        const floatSamples = new Float32Array(this.activeClipSamples);
        const clip: RecordedTransmissionClip = {
          id: 'clip-' + Date.now(),
          utcTimestamp: this.activeClipStartTime,
          channelLabel: this.activeClipChannelLabel,
          frequencyMhz: this.activeClipFreqMhz,
          mode: this.activeClipMode,
          durationSeconds: parseFloat((count / this.sampleRate).toFixed(1)),
          peakDbm: Math.round(this.activeClipPeakDbm),
          samples: floatSamples,
        };

        this.clipHistory.unshift(clip);
        if (this.clipHistory.length > this.maxClipHistory) {
          this.clipHistory.pop();
        }
        return clip;
      }
    }
    return null;
  }

  /**
   * Retrieves the last N seconds of recorded audio in chronological order.
   */
  public getReplayBuffer(seconds = 30): Float32Array {
    const requestedSamples = Math.min(
      Math.floor(this.sampleRate * seconds),
      Math.min(this.totalSamplesWritten, this.ringCapacity)
    );

    const out = new Float32Array(requestedSamples);
    let readIndex = (this.writeIndex - requestedSamples + this.ringCapacity) % this.ringCapacity;

    for (let i = 0; i < requestedSamples; i++) {
      out[i] = this.ringBuffer[readIndex];
      readIndex = (readIndex + 1) % this.ringCapacity;
    }

    return out;
  }

  public getClipHistory(): RecordedTransmissionClip[] {
    return this.clipHistory;
  }

  public clearHistory(): void {
    this.clipHistory = [];
  }

  /**
   * Encodes PCM Float32 samples into a standard 16-bit Mono RIFF WAV Blob.
   */
  public static createWavBlob(samples: Float32Array, sampleRate = 48000): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = samples.length * (bitsPerSample / 8);
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // RIFF identifier
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    this.writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // "data" sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write 16-bit PCM samples with saturation clipping
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1.0, Math.min(1.0, samples[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, Math.floor(val), true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private static writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Triggers a browser download of the recorded clip.
   */
  public static downloadClip(clip: RecordedTransmissionClip): void {
    const blob = this.createWavBlob(clip.samples, 48000);
    const filename = `HeshRadio_${clip.channelLabel.replace(/\s+/g, '_')}_${clip.frequencyMhz.toFixed(3)}MHz_${clip.utcTimestamp.replace(/:/g, '')}.wav`;
    downloadBlob(blob, filename);
  }
}
