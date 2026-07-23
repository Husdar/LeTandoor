export interface ParsedContact {
  email: string;
  name?: string;
  subscribed: boolean;
}

const EMAIL_REGEX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// Mojibake fréquent quand un export Mac (Numbers/Excel) écrit de l'UTF-8 relu comme Mac OS Roman —
// on corrige les séquences les plus courantes plutôt que d'implémenter un décodeur complet.
const MOJIBAKE_MAP: [RegExp, string][] = [
  [/√©/g, "é"],
  [/√®/g, "è"],
  [/√´/g, "ë"],
  [/√ª/g, "û"],
  [/√¥/g, "ô"],
  [/√Ø/g, "ï"],
  [/√¢/g, "â"],
  [/√†/g, "à"],
  [/√ß/g, "ç"],
  [/√Ä/g, "À"],
  [/√â/g, "É"],
  [/√à/g, "È"],
  [/¬¥/g, "'"],
  [/¬´/g, "«"],
  [/¬ª/g, "»"],
];

function fixMojibake(value: string): string {
  let result = value;
  for (const [pattern, replacement] of MOJIBAKE_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

/**
 * Parse un import de contacts au format libre : un email par ligne, ou CSV avec colonnes
 * "email,nom,consentement" (ordre des colonnes non garanti d'une export à l'autre, donc on
 * détecte l'email par regex plutôt que par position fixe). Une ligne d'en-tête ("Email,...")
 * peut apparaître plusieurs fois dans un export concaténé — elle est simplement ignorée.
 */
export function parseContactsText(text: string): ParsedContact[] {
  const lines = text.split(/\r?\n/);
  const byEmail = new Map<string, ParsedContact>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const cells = splitCsvLine(line);
    const emailCell = cells.find((c) => EMAIL_REGEX.test(c));
    if (!emailCell) continue; // ligne d'en-tête ou sans email exploitable

    const email = emailCell.toLowerCase();
    const otherCells = cells.filter((c) => c !== emailCell);
    const name = otherCells.find((c) => c.length > 0 && !/^(oui|non|yes|no|true|false)$/i.test(c));
    const consentCell = otherCells.find((c) => /^(oui|non|yes|no|true|false)$/i.test(c));
    const subscribed = consentCell ? /^(oui|yes|true)$/i.test(consentCell) : false;

    byEmail.set(email, {
      email,
      name: name ? fixMojibake(name) : undefined,
      subscribed,
    });
  }

  return Array.from(byEmail.values());
}
