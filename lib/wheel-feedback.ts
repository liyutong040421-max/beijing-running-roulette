// Haptic + audio feedback for the climbing wheel. Synthesizes mechanical
// clicks via Web Audio (no asset load) and fires navigator.vibrate where
// supported (Android Chrome; iOS Safari ignores it silently).

const TICK_COOLDOWN_MS = 35;
const NOISE_BUFFER_SECONDS = 0.2;

type Ctor = typeof AudioContext;

export type WheelFeedback = {
  tick: () => void;
  lock: () => void;
};

export function createWheelFeedback(): WheelFeedback {
  let ctx: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let lastTickAt = -Infinity;

  const ensureCtx = (): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const Ctor: Ctor | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        ctx = new Ctor();
      } catch {
        return null;
      }
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * NOISE_BUFFER_SECONDS);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      noiseBuffer = buffer;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  // Try to unlock immediately (works if we're inside a user gesture, e.g.
  // SPIN button click) and also attach passive listeners to catch the next
  // pointer / key event on the page if we were created from mousemove.
  // Chrome's autoplay policy blocks resume() outside user-activation, so
  // both attempts are needed.
  const unlock = () => {
    ensureCtx();
  };
  if (typeof window !== "undefined") {
    unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
  }

  const playClick = (opts: {
    freq: number;
    q: number;
    gain: number;
    decay: number;
  }) => {
    const audio = ensureCtx();
    if (!audio || !noiseBuffer) return;
    const now = audio.currentTime;

    const source = audio.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(opts.freq, now);
    filter.Q.setValueAtTime(opts.q, now);

    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(opts.gain, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.decay);

    source.connect(filter).connect(gain).connect(audio.destination);
    source.start(now);
    source.stop(now + opts.decay + 0.02);
  };

  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator === "undefined") return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // some browsers reject patterns or throw on insecure contexts
    }
  };

  return {
    tick: () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastTickAt < TICK_COOLDOWN_MS) return;
      lastTickAt = now;
      playClick({ freq: 1700, q: 8, gain: 0.22, decay: 0.04 });
      vibrate(6);
    },
    lock: () => {
      playClick({ freq: 900, q: 3.5, gain: 0.32, decay: 0.09 });
      vibrate([10, 40, 20]);
    },
  };
}
