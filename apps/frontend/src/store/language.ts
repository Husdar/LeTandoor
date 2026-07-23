import { create } from "zustand";

export type Language = "fr" | "ur";

const STORAGE_KEY = "le-tandoor-language";

function loadInitial(): Language {
  if (typeof window === "undefined") return "fr";
  return window.localStorage.getItem(STORAGE_KEY) === "ur" ? "ur" : "fr";
}

interface LanguageState {
  language: Language;
  toggle: () => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: loadInitial(),
  toggle: () => {
    const next: Language = get().language === "fr" ? "ur" : "fr";
    window.localStorage.setItem(STORAGE_KEY, next);
    set({ language: next });
  },
}));
