/**
 * Menu sound effects, synthesised rather than loaded.
 *
 * Every blip here is generated with WebAudio oscillators — no audio files.
 * That's partly authenticity (these are the same square/triangle waves the
 * era's hardware produced) and partly practicality: no assets to host, nothing
 * to 404, and the whole thing is a few hundred bytes of code.
 *
 * Browsers won't let an AudioContext start without a user gesture, which is
 * why the title screen's PRESS START gate is also the audio unlock — the one
 * moment in the flow where a gesture is guaranteed.
 */

export type SfxName =
  | "move"
  | "confirm"
  | "back"
  | "deny"
  | "start"
  | "lock"
  | "medal";

type Voice = {
  /** Hz. A single number is a flat tone; a pair is a glide. */
  freq: number | [number, number];
  /** Seconds. */
  duration: number;
  type: OscillatorType;
  gain: number;
  /** Seconds to wait before this voice fires, for arpeggios. */
  delay?: number;
};

const VOICES: Record<SfxName, Voice[]> = {
  // Short, dry tick as the cursor steps between items.
  move: [{ freq: 880, duration: 0.05, type: "square", gain: 0.06 }],
  // Rising two-note "yes".
  confirm: [
    { freq: 660, duration: 0.07, type: "square", gain: 0.08 },
    { freq: 990, duration: 0.11, type: "square", gain: 0.08, delay: 0.06 },
  ],
  // Falling two-note "back out".
  back: [
    { freq: 520, duration: 0.07, type: "square", gain: 0.07 },
    { freq: 350, duration: 0.1, type: "square", gain: 0.07, delay: 0.055 },
  ],
  // Flat buzz for a rejected input (overspent multiplier budget, locked event).
  deny: [{ freq: 150, duration: 0.16, type: "sawtooth", gain: 0.07 }],
  // The big one, on PRESS START.
  start: [
    { freq: 523, duration: 0.09, type: "square", gain: 0.09 },
    { freq: 659, duration: 0.09, type: "square", gain: 0.09, delay: 0.08 },
    { freq: 784, duration: 0.09, type: "square", gain: 0.09, delay: 0.16 },
    { freq: 1046, duration: 0.24, type: "square", gain: 0.1, delay: 0.24 },
  ],
  // Descending clunk as a multiplier locks in.
  lock: [{ freq: [700, 220], duration: 0.16, type: "triangle", gain: 0.09 }],
  // Fanfare sting for the medal table.
  medal: [
    { freq: 784, duration: 0.1, type: "triangle", gain: 0.09 },
    { freq: 1046, duration: 0.1, type: "triangle", gain: 0.09, delay: 0.1 },
    { freq: 1318, duration: 0.32, type: "triangle", gain: 0.1, delay: 0.2 },
  ],
};

let ctx: AudioContext | null = null;
let muted = false;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    // Some environments refuse to construct one at all. Silence is an
    // acceptable outcome for menu blips — never let it break the UI.
    return null;
  }
  return ctx;
}

/** Call from a real user gesture (the PRESS START handler) to unlock audio. */
export function unlockAudio(): void {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
}

export function setMuted(next: boolean): void {
  muted = next;
}

export function isMuted(): boolean {
  return muted;
}

export function playSfx(name: SfxName): void {
  if (muted) return;
  const c = context();
  if (!c || c.state !== "running") return;

  const now = c.currentTime;
  for (const voice of VOICES[name]) {
    const start = now + (voice.delay ?? 0);
    const osc = c.createOscillator();
    const amp = c.createGain();

    osc.type = voice.type;
    if (Array.isArray(voice.freq)) {
      osc.frequency.setValueAtTime(voice.freq[0], start);
      osc.frequency.exponentialRampToValueAtTime(
        voice.freq[1],
        start + voice.duration
      );
    } else {
      osc.frequency.setValueAtTime(voice.freq, start);
    }

    // Fast attack, exponential decay — the shape of a hardware blip.
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(voice.gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + voice.duration);

    osc.connect(amp).connect(c.destination);
    osc.start(start);
    osc.stop(start + voice.duration + 0.02);
  }
}
