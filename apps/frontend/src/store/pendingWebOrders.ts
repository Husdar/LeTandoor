import { create } from "zustand";
import { startRinging, stopRinging } from "../lib/sound";

interface PendingWebOrdersState {
  ids: Set<string>;
  /** Signale une nouvelle commande (toute source) non encore ouverte/acceptée — déclenche/maintient
   * la sonnerie et le popup plein écran d'acceptation. */
  add: (id: string) => void;
  /** Marque une commande comme ouverte/acceptée — coupe la sonnerie s'il n'en reste plus aucune en attente. */
  acknowledge: (id: string) => void;
}

export const usePendingWebOrders = create<PendingWebOrdersState>((set, get) => ({
  ids: new Set(),
  add: (id) => {
    if (get().ids.has(id)) return;
    const next = new Set(get().ids);
    next.add(id);
    set({ ids: next });
    startRinging();
  },
  acknowledge: (id) => {
    if (!get().ids.has(id)) return;
    const next = new Set(get().ids);
    next.delete(id);
    set({ ids: next });
    if (next.size === 0) stopRinging();
  },
}));
