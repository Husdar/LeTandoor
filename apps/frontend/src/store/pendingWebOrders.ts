import { create } from "zustand";
import { startRinging, stopRinging } from "../lib/sound";

// Délai pendant lequel useRingReconciliation ignore une commande fraîchement ajoutée (voir ws.ts) —
// laisse le temps à la requête /orders/active fraîchement invalidée de revenir avant de faire
// confiance à une éventuelle réponse encore "en vol", lancée AVANT la création de la commande, qui
// ne la contient donc pas encore. Sans ce délai, cette réponse périmée peut couper à tort la
// sonnerie d'une commande pourtant bien réelle, quelques centaines de ms après son arrivée — bug
// observé : la sonnerie s'arrête d'elle-même après un court instant.
export const RECONCILE_GRACE_MS = 6000;

interface PendingWebOrdersState {
  ids: Map<string, number>;
  /** Signale une nouvelle commande (toute source) non encore ouverte/acceptée — déclenche/maintient
   * la sonnerie et le popup plein écran d'acceptation. */
  add: (id: string) => void;
  /** Marque une commande comme ouverte/acceptée — coupe la sonnerie s'il n'en reste plus aucune en attente. */
  acknowledge: (id: string) => void;
}

export const usePendingWebOrders = create<PendingWebOrdersState>((set, get) => ({
  ids: new Map(),
  add: (id) => {
    if (get().ids.has(id)) return;
    const next = new Map(get().ids);
    next.set(id, Date.now());
    set({ ids: next });
    startRinging();
  },
  acknowledge: (id) => {
    if (!get().ids.has(id)) return;
    const next = new Map(get().ids);
    next.delete(id);
    set({ ids: next });
    if (next.size === 0) stopRinging();
  },
}));
