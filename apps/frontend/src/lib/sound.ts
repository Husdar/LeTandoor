let audioEl: HTMLAudioElement | null = null;
let unlockAttached = false;

function getAudioElement(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio("/sonnerie.mp3");
    audioEl.loop = true;
  }
  return audioEl;
}

/**
 * Les navigateurs bloquent la lecture automatique du son tant qu'aucun vrai geste utilisateur
 * (tap, clic, touche) n'a eu lieu — une nouvelle commande arrivant par WebSocket n'en est pas un.
 * On joue donc puis coupe immédiatement dès le premier geste (login, navigation) pour débloquer
 * la lecture ultérieure des sonneries déclenchées sans interaction directe.
 */
export function initAudioUnlock() {
  if (unlockAttached || typeof window === "undefined") return;
  unlockAttached = true;

  const unlock = () => {
    const el = getAudioElement();
    el.play()
      .then(() => el.pause())
      .catch(() => undefined);
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function playLoop() {
  const el = getAudioElement();
  if (!el.paused) return; // déjà en cours — ne pas relancer depuis le début
  el.currentTime = 0;
  el.play().catch(() => undefined);
}

function pauseLoop() {
  audioEl?.pause();
}

// Vrai tant qu'il existe au moins une commande en attente d'acceptation — indépendant du fait que
// l'onglet soit actuellement affiché ou en arrière-plan (voir startRinging/stopRinging ci-dessous).
let wantsRinging = false;
let visibilityListenerAttached = false;

function attachVisibilityListener() {
  if (visibilityListenerAttached || typeof document === "undefined") return;
  visibilityListenerAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (!wantsRinging) return;
    if (document.visibilityState === "visible") {
      playLoop();
    } else {
      pauseLoop();
    }
  });
}

/**
 * Sonne en boucle (fichier audio réel, voir apps/frontend/public/sonnerie.mp3) jusqu'à l'appel de
 * `stopRinging()` — c'est à dire jusqu'à ce que le personnel ouvre/accepte la commande concernée.
 * Rappeler cette fonction pendant qu'elle sonne déjà ne relance pas une seconde boucle.
 *
 * Ne sonne que si l'onglet est actuellement affiché au premier plan — un onglet resté ouvert en
 * arrière-plan (ou sur un écran que personne ne regarde) ne doit pas faire du bruit tout seul.
 * Si l'onglet revient au premier plan alors qu'une commande est toujours en attente, la sonnerie
 * reprend automatiquement.
 */
export function startRinging() {
  wantsRinging = true;
  attachVisibilityListener();
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return;
  }
  playLoop();
}

/** Coupe la sonnerie en cours (appelé quand il n'y a plus aucune commande site web non ouverte). */
export function stopRinging() {
  wantsRinging = false;
  pauseLoop();
}
