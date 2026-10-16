import React, { useState } from 'react';
import {
  BlackBoxRecorder,
  RecordedTransmissionClip,
} from '../radio/blackBoxRecorder';
import {
  RotateCcw,
  Play,
  Download,
  Trash2,
} from 'lucide-react';

interface BlackBoxRecorderDeckProps {
  recorder: BlackBoxRecorder;
  onPlayBuffer: (samples: Float32Array) => void;
}

export const BlackBoxRecorderDeck: React.FC<BlackBoxRecorderDeckProps> = ({
  recorder,
  onPlayBuffer,
}) => {
  const [clips, setClips] = useState<RecordedTransmissionClip[]>(() => recorder.getClipHistory());
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [activePlayingClipId, setActivePlayingClipId] = useState<string | null>(null);

  const handleReplayLast30Seconds = () => {
    setIsPlayingReplay(true);
    const audio = recorder.getReplayBuffer(30);
    onPlayBuffer(audio);
    const durationMs = (audio.length / 48000) * 1000;
    setTimeout(() => {
      setIsPlayingReplay(false);
    }, durationMs + 100);
  };

  const handlePlayClip = (clip: RecordedTransmissionClip) => {
    setActivePlayingClipId(clip.id);
    onPlayBuffer(clip.samples);
    const durationMs = (clip.samples.length / 48000) * 1000;
    setTimeout(() => {
      setActivePlayingClipId(null);
    }, durationMs + 100);
  };

  const handleDownload = (clip: RecordedTransmissionClip) => {
    BlackBoxRecorder.downloadClip(clip);
  };

  const handleClear = () => {
    recorder.clearHistory();
    setClips([]);
  };

  return (
    <section className="panel blackbox-panel font-mono space-y-4" aria-label="Cockpit Black Box Recorder &amp; Instant Replay">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="status-led led-amber" />
          <h2 className="panel-title">COCKPIT &ldquo;BLACK BOX&rdquo; RECORDER &amp; REPLAY</h2>
          <span className="badge-mono hidden sm:inline-block">60s RING BUFFER</span>
        </div>

        <button
          onClick={handleClear}
          className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-300 rounded-md text-xs flex items-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer font-bold"
        >
          <Trash2 className="w-3.5 h-3.5" /> CLEAR CLIPS
        </button>
      </div>

      {/* Instant 30s "Say Again" Replay Bar */}
      <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-black p-4 rounded-xl border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-amber-400 font-bold text-sm flex items-center gap-2">
            <RotateCcw className={`w-4 h-4 ${isPlayingReplay ? 'animate-spin' : ''}`} />
            ROLLING 30-SECOND COCKPIT VOICE BUFFER
          </div>
          <div className="text-zinc-400 text-xs">
            Missed a callsign, 10-code, or highway mile marker? Hit &ldquo;Say Again&rdquo; to instantly
            hear the last 30 seconds of demodulated RF audio.
          </div>
        </div>

        <button
          onClick={handleReplayLast30Seconds}
          disabled={isPlayingReplay}
          className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all shrink-0 cursor-pointer ${
            isPlayingReplay
              ? 'bg-amber-400 text-black animate-pulse'
              : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          {isPlayingReplay ? 'PLAYING 30s REPLAY...' : 'SAY AGAIN? (REPLAY LAST 30s)'}
        </button>
      </div>

      {/* Squelch-Triggered Recorded Transmission Clips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
          <span>AUTOMATIC SQUELCH-TRIGGERED TRANSMISSION CLIPS ({clips.length})</span>
          <span className="text-zinc-500 text-[11px]">48 kHz 16-BIT PCM WAV EXPORT</span>
        </div>

        {clips.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-lg">
            No transmission clips recorded yet. Clips are automatically saved whenever the receiver
            squelch gate opens.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-[11px]">
                  <th className="py-2.5 px-3.5">TIME (UTC)</th>
                  <th className="py-2.5 px-3.5">CHANNEL</th>
                  <th className="py-2.5 px-3.5">FREQUENCY</th>
                  <th className="py-2.5 px-3.5">MODE</th>
                  <th className="py-2.5 px-3.5">DURATION</th>
                  <th className="py-2.5 px-3.5">PEAK SIGNAL</th>
                  <th className="py-2.5 px-3.5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {clips.map((clip) => {
                  const isPlaying = activePlayingClipId === clip.id;
                  return (
                    <tr
                      key={clip.id}
                      className="border-b border-zinc-800/40 hover:bg-zinc-900/50 text-zinc-300"
                    >
                      <td className="py-2.5 px-3.5 font-mono text-zinc-400">{clip.utcTimestamp}</td>
                      <td className="py-2.5 px-3.5 font-bold text-amber-300">{clip.channelLabel}</td>
                      <td className="py-2.5 px-3.5 font-mono text-zinc-300">
                        {clip.frequencyMhz.toFixed(4)} MHz
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="px-3.5 py-1 rounded-md bg-zinc-800 text-[10px] text-zinc-300 font-bold inline-block border border-zinc-700/60">
                          {clip.mode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono">{clip.durationSeconds}s</td>
                      <td className="py-2.5 px-3.5 font-mono text-emerald-400">{clip.peakDbm} dBm</td>
                      <td className="py-2.5 px-3.5 text-right space-x-2">
                        <button
                          onClick={() => handlePlayClip(clip)}
                          disabled={isPlaying}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs inline-flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          {isPlaying ? 'PLAYING' : 'PLAY'}
                        </button>
                        <button
                          onClick={() => handleDownload(clip)}
                          className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 rounded-md text-xs inline-flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                          title="Download 16-bit WAV"
                        >
                          <Download className="w-3 h-3" /> WAV
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
