import { useCallback, useEffect, useState } from "react";

/** Le navigateur exige un vrai geste utilisateur pour passer en plein écran (impossible au simple
 * chargement de la page) — on écoute donc le premier clic/tap sur la page pour y entrer
 * automatiquement dès que l'utilisateur touche l'écran, sans qu'il ait besoin de chercher un
 * bouton. Le bouton manuel reste disponible pour resortir ou re-rentrer à tout moment. */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  useEffect(() => {
    if (!document.documentElement.requestFullscreen) return;

    function handlePointerDown() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => undefined);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return { isFullscreen, toggle };
}
