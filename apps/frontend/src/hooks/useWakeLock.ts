import { useEffect } from "react";

/** Empêche la tablette de s'éteindre/verrouiller automatiquement (utile en salle/caisse où
 * l'écran se coupe sinon après un délai système). Le verrou est relâché par le navigateur dès
 * que l'onglet passe en arrière-plan (changement d'appli, écran éteint manuellement), donc on le
 * redemande à chaque retour au premier plan. */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function requestLock() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
      } catch {
        // Ignoré : par ex. onglet en arrière-plan ou non supporté sur cet appareil.
      }
    }

    requestLock();

    function handleVisibility() {
      if (document.visibilityState === "visible" && !sentinel) {
        requestLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      sentinel?.release().catch(() => undefined);
    };
  }, []);
}
