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

const RING_INTERVAL_MS = 900;

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

let ringCompressor: DynamicsCompressorNode | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;

function getRingCompressor(ctx: AudioContext): DynamicsCompressorNode {
  if (!ringCompressor) {
    ringCompressor = ctx.createDynamicsCompressor();
    ringCompressor.threshold.value = -18;
    ringCompressor.knee.value = 6;
    ringCompressor.ratio.value = 16;
    ringCompressor.attack.value = 0.002;
    ringCompressor.release.value = 0.2;
    ringCompressor.connect(ctx.destination);
  }
  return ringCompressor;
}

/**
 * Sonne en continu (comme une notification de livraison) jusqu'à l'appel de `stopRinging()` —
 * c'est à dire jusqu'à ce que le personnel ouvre la commande concernée. Rappeler cette fonction
 * pendant qu'elle sonne déjà ne relance pas une seconde boucle.
 */
export function startRinging() {
  try {
    const ctx = getContext();

    const begin = () => {
      if (ringInterval) return;
      const compressor = getRingCompressor(ctx);
      scheduleDingDong(ctx, compressor, ctx.currentTime);
      ringInterval = setInterval(() => {
        scheduleDingDong(ctx, compressor, ctx.currentTime);
      }, RING_INTERVAL_MS);
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(begin).catch(() => undefined);
    } else {
      begin();
    }
  } catch {
    // Audio context unavailable — fail silently rather than breaking the order flow.
  }
}

/** Coupe la sonnerie en cours (appelé quand il n'y a plus aucune commande site web non ouverte). */
export function stopRinging() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}
