import { useEffect, useState } from "react";
import clsx from "clsx";
import { useScreenLock } from "../store/screenLock";
import { LogoMark } from "./icons";

// Verrou de confort pour tablette partagée, pas un mot de passe — la vraie session (JWT) reste
// celle qui autorise réellement l'accès à l'API, ce code ne fait que réafficher l'appli déjà
// connectée sans tout retaper.
const UNLOCK_PIN = "2007";
const PIN_LENGTH = 4;

export default function PinLockScreen() {
  const unlock = useScreenLock((s) => s.unlock);
  const [digits, setDigits] = useState("");
  const [shake, setShake] = useState(false);

  // Mise à jour fonctionnelle : des appuis rapprochés (avant le prochain rendu) doivent chacun
  // s'ajouter au dernier état réel, pas au digits capturé au moment du rendu — sinon des appuis
  // rapides se perdent (vérifié : 4 appuis rapides ne faisaient avancer le code que d'un chiffre).
  function press(digit: string) {
    setDigits((prev) => (prev.length >= PIN_LENGTH ? prev : prev + digit));
  }

  function backspace() {
    setDigits((prev) => prev.slice(0, -1));
  }

  useEffect(() => {
    if (digits.length !== PIN_LENGTH) return;
    if (digits === UNLOCK_PIN) {
      unlock();
      return;
    }
    setShake(true);
    const timer = setTimeout(() => {
      setShake(false);
      setDigits("");
    }, 400);
    return () => clearTimeout(timer);
  }, [digits, unlock]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-burgundy p-6">
      <div className="flex flex-col items-center gap-3">
        <LogoMark className="h-14 w-14 text-gold" />
        <p className="font-display text-xl font-semibold text-cream">Écran verrouillé</p>
      </div>

      <div className={clsx("flex gap-4", shake && "animate-[shake_0.4s]")}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={clsx(
              "h-4 w-4 rounded-full border-2 border-gold",
              i < digits.length ? "bg-gold" : "bg-transparent"
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="tap-target flex h-16 w-16 items-center justify-center rounded-full bg-cream/10 text-2xl font-semibold text-cream transition active:scale-95 active:bg-cream/20"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => press("0")}
          className="tap-target flex h-16 w-16 items-center justify-center rounded-full bg-cream/10 text-2xl font-semibold text-cream transition active:scale-95 active:bg-cream/20"
        >
          0
        </button>
        <button
          onClick={backspace}
          className="tap-target flex h-16 w-16 items-center justify-center rounded-full text-sm font-medium text-cream/70 transition active:scale-95"
        >
          Effacer
        </button>
      </div>
    </div>
  );
}
