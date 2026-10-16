import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Eye,
  Zap,
  Mic,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Hash,
} from 'lucide-react';

interface MobileTacticalCockpitProps {
  currentFreqMhz: number;
  currentMode: string;
  pttActive: boolean;
  totRemainingSec: number;
  squelchOpen: boolean;
  onFrequencyChange: (freqMhz: number) => void;
  onStartPtt: () => void;
  onStopPtt: () => void;
  onPanicUnkey: () => void;
}

export const MobileTacticalCockpit: React.FC<MobileTacticalCockpitProps> = ({
  currentFreqMhz,
  currentMode,
  pttActive,
  totRemainingSec,
  squelchOpen,
  onFrequencyChange,
  onStartPtt,
  onStopPtt,
  onPanicUnkey,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [nightVisionActive, setNightVisionActive] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');

  // WakeLock API for Samsung S26 Ultra AMOLED Display
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
        }
      } catch (err) {
        console.warn('[WakeLock] Unable to acquire wake lock:', err);
      }
    };

    if (wakeLockActive && !wakeLockSentinel) {
      requestWakeLock();
    }

    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [wakeLockActive]);

  // Haptic Feedback Helper
  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  // Toggle Red/Night Vision Mode
  const toggleNightVision = () => {
    const next = !nightVisionActive;
    setNightVisionActive(next);
    triggerHaptic(25);
    if (next) {
      document.documentElement.classList.add('tactical-night-vision');
    } else {
      document.documentElement.classList.remove('tactical-night-vision');
    }
  };

  const handleKeypadDigit = (digit: string) => {
    triggerHaptic(15);
    if (keypadInput.length < 8) {
      setKeypadInput((prev) => prev + digit);
    }
  };

  const handleKeypadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(keypadInput);
    if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 1750.0) {
      triggerHaptic([20, 20]);
      onFrequencyChange(parsed);
      setShowKeypad(false);
      setKeypadInput('');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#090e15]/95 backdrop-blur-md border-t border-zinc-800 p-2 sm:hidden font-mono shadow-2xl">
      {/* Top Mini Bar */}
      <div className="flex items-center justify-between px-2 pb-1.5 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-[11px]">S26 ULTRA COCKPIT</span>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Night Vision Toggle */}
          <button
            onClick={toggleNightVision}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              nightVisionActive
                ? 'bg-red-950 border-red-600 text-red-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
            title="Monochromatic Red Tactical Night Vision"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
          </button>

          {/* Wake Lock Toggle */}
          <button
            onClick={() => setWakeLockActive((v) => !v)}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              wakeLockActive
                ? 'bg-amber-950 border-amber-600 text-amber-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
            title="Screen Always-On WakeLock"
          >
            {wakeLockActive ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Unlock className="w-3.5 h-3.5 shrink-0" />}
          </button>

          {/* Keypad Quick Button */}
          <button
            onClick={() => setShowKeypad((v) => !v)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 cursor-pointer"
            title="Direct Frequency Keypad"
          >
            <Hash className="w-3.5 h-3.5 shrink-0" />
          </button>

          {/* Emergency Panic Unkey Button */}
          <button
            onClick={onPanicUnkey}
            className="p-2 bg-red-950 hover:bg-red-900 border border-red-700 rounded-lg text-red-300 cursor-pointer"
            title="Immediate Fail-Safe Panic Unkey"
          >
            <Zap className="w-3.5 h-3.5 text-red-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* Expanded S26 Ultra Controls */}
      {isExpanded && (
        <div className="py-2.5 px-1.5 border-t border-zinc-800/80 grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 px-3.5 bg-black/60 rounded-xl border border-zinc-800">
            <div className="text-[10px] text-zinc-500 font-bold">TUNED FREQUENCY</div>
            <div className="text-amber-400 font-bold text-sm font-mono pt-1">
              {currentFreqMhz.toFixed(4)} MHz
            </div>
            <div className="text-[10px] text-zinc-400 pt-0.5">{currentMode} MODE</div>
          </div>

          <div className="p-3 px-3.5 bg-black/60 rounded-xl border border-zinc-800 flex flex-col justify-between">
            <div className="text-[10px] text-zinc-500 font-bold">CARRIER STATE</div>
            <div className="font-bold text-xs flex items-center gap-1.5 pt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  pttActive
                    ? 'bg-red-500 animate-pulse'
                    : squelchOpen
                    ? 'bg-cyan-400'
                    : 'bg-zinc-600'
                }`}
              />
              <span
                className={
                  pttActive ? 'text-red-400' : squelchOpen ? 'text-cyan-300' : 'text-zinc-500'
                }
              >
                {pttActive ? 'TRANSMITTING' : squelchOpen ? 'SQUELCH OPEN' : 'GUARD STBY'}
              </span>
            </div>
            <div className="text-[10px] text-zinc-500">TOT: {totRemainingSec}s</div>
          </div>
        </div>
      )}

      {/* Oversized Tactical Thumb PTT Bar */}
      <div className="pt-1">
        <button
          type="button"
          onMouseDown={() => {
            triggerHaptic([30, 20]);
            onStartPtt();
          }}
          onMouseUp={() => {
            triggerHaptic(20);
            onStopPtt();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            triggerHaptic([30, 20]);
            onStartPtt();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            triggerHaptic(20);
            onStopPtt();
          }}
          className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-2xl transition-all select-none touch-none ${
            pttActive
              ? 'bg-red-600 text-white animate-pulse shadow-red-600/50'
              : 'bg-gradient-to-r from-zinc-800 via-amber-600/40 to-zinc-800 border-2 border-amber-500/60 text-amber-300 active:scale-[0.98]'
          }`}
        >
          <Mic className="w-5 h-5 shrink-0" />
          <span>{pttActive ? 'TRANSMITTING (RELEASE TO UNKEY)' : 'HOLD THUMB TO TALK (PTT)'}</span>
        </button>
      </div>

      {/* Direct Frequency Keypad Modal */}
      {showKeypad && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1722] border border-zinc-700 rounded-2xl p-5 max-w-xs w-full space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                <Hash className="w-4 h-4" /> DIRECT FREQUENCY ENTRY
              </span>
              <button
                onClick={() => setShowKeypad(false)}
                className="text-zinc-400 hover:text-zinc-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-black/80 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-[10px] text-zinc-500">TARGET FREQ (MHz)</div>
              <div className="text-2xl font-bold text-amber-300 font-mono tracking-wider">
                {keypadInput || '0.000'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    if (k === '⌫') {
                      triggerHaptic(15);
                      setKeypadInput((p) => p.slice(0, -1));
                    } else {
                      handleKeypadDigit(k);
                    }
                  }}
                  className="py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-amber-500 active:text-black rounded-lg text-base font-bold text-zinc-200 shadow"
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setKeypadInput('')}
                className="w-1/3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={handleKeypadSubmit}
                className="w-2/3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs"
              >
                TUNE FREQUENCY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
