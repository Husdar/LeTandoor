let audioCtx: AudioContext | null = null;
let unlockAttached = false;

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Browsers keep the AudioContext "suspended" until a real user gesture (tap, click,
 * key press) resumes it — a new order arriving over WebSocket is not a gesture, so
 * without this the chime would silently produce no sound. Call once at app startup;
 * any early tap on the tablet (login, navigation) then unlocks audio for later chimes.
 */
export function initAudioUnlock() {
  if (unlockAttached || typeof window === "undefined") return;
  unlockAttached = true;

  const unlock = () => {
    const ctx = getContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => undefined);
    }
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

const RING_DURATION_SECONDS = 10;
const RING_INTERVAL_SECONDS = 0.9;

/** Un seul "ding-dong" deux tons, à l'instant `start` (en secondes AudioContext). */
function scheduleDingDong(ctx: AudioContext, start: number) {
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const noteStart = start + i * 0.18;
    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(0.9, noteStart + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(noteStart);
    osc.stop(noteStart + 0.4);
  });
}

/** Sonnerie de 10 secondes (ding-dong répété) pour signaler une nouvelle commande site web. */
export function playNewOrderChime() {
  try {
    const ctx = getContext();

    const schedule = () => {
      const now = ctx.currentTime;
      const repeats = Math.ceil(RING_DURATION_SECONDS / RING_INTERVAL_SECONDS);
      for (let r = 0; r < repeats; r++) {
        scheduleDingDong(ctx, now + r * RING_INTERVAL_SECONDS);
      }
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(schedule).catch(() => undefined);
    } else {
      schedule();
    }
  } catch {
    // Audio context unavailable — fail silently rather than breaking the order flow.
  }
}
