import { create } from "zustand";

interface ScreenLockState {
  locked: boolean;
  lock: () => void;
  unlock: () => void;
}

/** Verrou d'écran local (pas un système d'authentification) : masque l'appli déjà connectée sur
 * une tablette partagée, sans retaper email/mot de passe, tant que la session réelle (JWT) reste
 * valide. Ne remplace en rien la vraie authentification. */
export const useScreenLock = create<ScreenLockState>((set) => ({
  locked: false,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
}));
