import { parisHour } from "../../timezone.js";
import { generateDailyInsight, hasDailyInsightToday } from "./service.js";

const CHECK_INTERVAL_MS = 60_000;
const TRIGGER_HOUR = 23;

/** Vérifie chaque minute si il est 23h à Paris ; génère au plus une analyse quotidienne par jour. */
export function startDailyInsightScheduler(log: { info: (msg: string) => void; error: (err: unknown, msg: string) => void }) {
  setInterval(() => {
    void (async () => {
      if (parisHour(new Date()) !== TRIGGER_HOUR) return;
      if (await hasDailyInsightToday()) return;

      try {
        await generateDailyInsight();
        log.info("Analyse quotidienne (23h) générée avec succès");
      } catch (err) {
        log.error(err, "Échec de la génération de l'analyse quotidienne (23h)");
      }
    })();
  }, CHECK_INTERVAL_MS);
}
