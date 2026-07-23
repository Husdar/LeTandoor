/**
 * Le serveur de production (Render) tourne en UTC, alors que le restaurant est à Paris — toute
 * logique de date "métier" (créneau d'un client, journée du jour pour les stats, heure de
 * déclenchement d'une tâche planifiée) doit donc être calculée explicitement en heure de Paris,
 * jamais via les méthodes locales de `Date` (`setHours`, `getDay`...) qui dépendent du fuseau du
 * serveur qui exécute le code.
 */
export const RESTAURANT_TIMEZONE = "Europe/Paris";

/** Décalage (en minutes) entre UTC et `timeZone` à l'instant `date`. */
export function timezoneOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUTC - date.getTime()) / 60_000;
}

export function parisDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function parisHour(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TIMEZONE,
    hourCycle: "h23",
    hour: "2-digit",
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")!.value);
}

/** Minuit (00:00) à Paris pour la journée calendaire de `d`, en instant UTC réel. */
export function startOfParisDay(d: Date): Date {
  const { year, month, day } = parisDateParts(d);
  const offsetMinutes = timezoneOffsetMinutes(RESTAURANT_TIMEZONE, d);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60_000);
}

/** Date "calendaire" pure (minuit UTC, sans décalage) — pour comparer une colonne SQL DATE. */
export function parisDateOnly(d: Date): Date {
  const { year, month, day } = parisDateParts(d);
  return new Date(Date.UTC(year, month - 1, day));
}
