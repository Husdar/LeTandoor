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

/**
 * Un seul "ding-dong", à l'instant `start` (en secondes AudioContext). Onde carrée (plus riche
 * en harmoniques, perçue comme plus forte/perçante qu'une sinusoïde à volume égal) + une octave
 * grave doublée pour donner du corps, le tout passé dans un compresseur commun pour pousser le
 * volume perçu au maximum sans écrêter.
 */
function scheduleDingDong(ctx: AudioContext, destination: AudioNode, start: number) {
  [880, 1320].forEach((freq, i) => {
    const noteStart = start + i * 0.18;
    const noteEnd = noteStart + 0.45;

    [freq, freq / 2].forEach((f, layer) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = f;
      const peak = layer === 0 ? 1 : 0.5;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(peak, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(noteStart);
      osc.stop(noteEnd + 0.05);
    });
  });
}

/** Sonnerie de 10 secondes (ding-dong répété, volume maximisé) pour signaler une nouvelle commande site web. */
export function playNewOrderChime() {
  try {
    const ctx = getContext();

    const schedule = () => {
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 6;
      compressor.ratio.value = 16;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.2;
      compressor.connect(ctx.destination);

      const now = ctx.currentTime;
      const repeats = Math.ceil(RING_DURATION_SECONDS / RING_INTERVAL_SECONDS);
      for (let r = 0; r < repeats; r++) {
        scheduleDingDong(ctx, compressor, now + r * RING_INTERVAL_SECONDS);
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
