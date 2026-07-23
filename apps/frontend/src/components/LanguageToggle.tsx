import { useLanguageStore } from "../store/language";

export default function LanguageToggle() {
  const language = useLanguageStore((s) => s.language);
  const toggle = useLanguageStore((s) => s.toggle);

  return (
    <button
      onClick={toggle}
      className="tap-target flex items-center gap-1 rounded-full border-2 border-gold/40 bg-burgundy-dark px-3 py-2 text-sm font-semibold text-gold"
      title="Français / اردو"
    >
      <span className={language === "fr" ? "text-gold" : "text-gold/40"}>FR</span>
      <span className="text-gold/40">/</span>
      <span className={language === "ur" ? "font-urdu text-base text-gold" : "text-gold/40"}>اردو</span>
    </button>
  );
}
