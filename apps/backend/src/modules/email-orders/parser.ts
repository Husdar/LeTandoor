import { OrderType } from "@le-tandoor/shared";
import { RESTAURANT_TIMEZONE, timezoneOffsetMinutes } from "../../timezone.js";

export interface ParsedEmailOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Nom du produit promotionnel ("Bowl") pour les offres groupées ("1 Bowl acheté = 1 Bowl
   * offert — <saveur>") — sert à rattacher l'article au bon menu (ex: "Bowl") plutôt qu'au plat à
   * la carte homonyme de la saveur, qui a un prix et une catégorie différents. */
  promoLabel?: string;
}

export interface ParsedEmailOrder {
  externalRef: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  type: OrderType;
  items: ParsedEmailOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod?: string;
  fulfillmentLabel?: string;
  /** Créneau choisi par le client au format brut, ex "19h" ou "19h30". */
  requestedTimeLabel?: string;
  /** Délai de préparation minimum annoncé (en minutes). */
  prepMinutes?: number;
}

export class EmailParseError extends Error {}

/** Ramène un créneau "en toutes lettres" ("19 heures") au format abrégé ("19h") attendu par
 * `resolveRequestedTime` — les deux formats ont été observés selon la commande. */
function normalizeTimeLabel(raw: string): string {
  const heuresMatch = raw.match(/^(\d{1,2})\s*heures?$/i);
  return heuresMatch ? `${heuresMatch[1]}h` : raw.trim();
}

/** Combine un créneau brut ("19h" ou "19h30") avec la date de réception pour obtenir un instant complet, en heure de Paris. */
export function resolveRequestedTime(label: string, referenceDate: Date): Date {
  const match = label.match(/^(\d{1,2})h(\d{0,2})$/);
  const hours = match ? Number(match[1]) : 0;
  const minutes = match && match[2] ? Number(match[2]) : 0;

  const dayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);
  const get = (type: string) => Number(dayParts.find((p) => p.type === type)!.value);

  const offsetMinutes = timezoneOffsetMinutes(RESTAURANT_TIMEZONE, referenceDate);
  const utcMillis =
    Date.UTC(get("year"), get("month") - 1, get("day"), hours, minutes, 0, 0) - offsetMinutes * 60_000;
  return new Date(utcMillis);
}

function toNumber(raw: string): number {
  return Number(raw.replace(/\s/g, "").replace(",", "."));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Parses the restaurant website's order notification emails (Hostinger online
 * store). Two template variants have been observed in production and are both
 * supported here — see docs/email-order-format.md:
 *  - "Nouvelle commande #N" — each item followed by a "Commander: <type>" line,
 *    totals on separate lines.
 *  - "Votre commande a été expédiée" — no per-item fulfillment line, totals
 *    sometimes flattened onto a single line (HTML table → plain text quirk).
 * If Hostinger changes the template again, check this file and the doc first.
 */
export function parseOrderEmail(subject: string, text: string): ParsedEmailOrder {
  const body = text.replace(/\r\n/g, "\n");

  // "Ordre #N résumé" (gabarits A/B) ou "Nouvelle commande #N" / "Résumé de la commande #N"
  // (gabarit C, vu sur la commande #2201 du 2026-08-08 — Hostinger a de nouveau fait évoluer le
  // gabarit, l'objet de l'email ne contient plus du tout de numéro pour cette variante).
  const refMatch = subject.match(/#(\d+)/) ?? body.match(/(?:ordre|commande)\s*#(\d+)/i);
  if (!refMatch) {
    throw new EmailParseError("Numéro de commande introuvable dans l'email");
  }
  const externalRef = refMatch[1];

  // "de <Nom>." ou "de la part de <Nom>." (variante vue sur la commande #2201 du 2026-08-08) —
  // simple filet de secours, prend le pas seulement si le bloc client est introuvable.
  const nameFallbackMatch = body.match(/reçu une nouvelle commande de\s+(?:la part de\s+)?(.+?)\.?\s*\n/);

  // "... résumé" (fin de ligne, gabarits A/B) ou "Résumé de la commande #N" (reste de la ligne
  // après "résumé", gabarit C vu sur la commande #2201 du 2026-08-08) — [^\n]* absorbe le texte
  // qui suit "résumé" sur la même ligne quand il y en a.
  const itemsSectionMatch = body.match(/résumé[^\n]*\n([\s\S]*?)\nSous-total/i);
  if (!itemsSectionMatch) {
    throw new EmailParseError("Section des articles introuvable (repère 'résumé' non trouvé)");
  }
  const itemsSection = itemsSectionMatch[1];

  // La ligne "Comman(der|de): <type>" par article n'existe que dans l'ancien gabarit — optionnelle ici.
  // Le prix/quantité est soit sur deux lignes ("N × €X" puis "€Y"), soit sur une seule ligne
  // ("N x €X = €Y") — ce second format apparaît sur les articles avec une offre "1 acheté = 1 offert",
  // où le "x" est aussi en minuscule et sans accent, contrairement au gabarit standard.
  const itemRegex =
    /([^\n]+)\n(?:Comman(?:der|de)\s*:\s*([^\n]+)\n)?\s*(\d+)\s*[×x]\s*€\s*([\d.,]+)\s*(?:\n\s*€\s*([\d.,]+)|=\s*€\s*([\d.,]+))/g;
  const items: ParsedEmailOrderItem[] = [];
  // Deux signaux distincts, de fiabilité différente : "Commander: X" (gabarit A, très fiable) et
  // le suffixe "— À emporter" par article (gabarit C) qui s'est avéré peu fiable en pratique — vu
  // sur une vraie commande #2164 où CHAQUE article portait "— À emporter" alors que la commande
  // était une vraie livraison ("Méthode d'expédition: Livraison hors lorient" + adresse + frais de
  // livraison réels). Les deux sont donc gardés séparés ; seul "Commander:" fait foi seul,
  // "Méthode d'expédition" passe avant le suffixe par article dans isDelivery ci-dessous.
  let commanderLabel = "";
  let dashFulfillmentLabel = "";
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(itemsSection))) {
    const [, rawName, fulfillment, qty, unitPrice, lineTotalNextLine, lineTotalSameLine] = match;
    if (fulfillment) commanderLabel = fulfillment.trim();

    // Le tiret cadratin a deux usages opposés selon le gabarit, à distinguer :
    //  - offre groupée : "- 1 Bowl acheté = 1 Bowl offert — 2x Poulet Curry" (le vrai nom SUIT le
    //    tiret ; le texte AVANT contient le nom du produit promotionnel, ex "Bowl", à extraire
    //    pour rattacher l'article au bon menu plutôt qu'au plat homonyme de la saveur — voir
    //    commande #2145 du 2026-07-23 et commande Poulet Tikka Massala du 2026-07-26 où l'article
    //    "Bowl" a été confondu avec le plat à la carte du même nom de saveur).
    //  - mode de retrait par article : "- Poisson Kashmiri — À emporter" (le vrai nom PRÉCÈDE le
    //    tiret, suivi du mode de retrait — capturé à part, voir commentaire ci-dessus).
    let name = rawName.trim().replace(/^-\s*/, "");
    let promoLabel: string | undefined;
    const dashIdx = name.lastIndexOf("—");
    if (dashIdx >= 0) {
      const before = name.slice(0, dashIdx).trim();
      const after = name.slice(dashIdx + 1).trim();
      if (/^(à emporter|a emporter|emporter|livraison|sur place)$/i.test(after)) {
        name = before;
        if (!dashFulfillmentLabel) dashFulfillmentLabel = after;
      } else {
        name = after;
        const promoMatch = before.match(/^\d+\s+(.+?)\s+achet[ée]/i);
        if (promoMatch) promoLabel = promoMatch[1].trim();
      }
    }
    name = name.replace(/^\d+\s*x\s*/i, "");

    items.push({
      name,
      quantity: Number(qty),
      unitPrice: toNumber(unitPrice),
      lineTotal: toNumber(lineTotalNextLine ?? lineTotalSameLine),
      promoLabel,
    });
  }
  if (items.length === 0) {
    throw new EmailParseError("Aucun article reconnu dans l'email");
  }

  // Pas d'ancrage en début de ligne : le gabarit "expédiée" met parfois les trois totaux
  // sur une seule ligne concaténée. Le lookbehind évite de confondre "Total" avec "Sous-total".
  const subtotalMatch = body.match(/Sous-total[^\n€]*€\s*([\d.,]+)/i);
  const deliveryFeeMatch = body.match(/Livraison[^\n€]*€\s*([\d.,]+)/i);
  const totalMatch = body.match(/(?<!Sous-)\bTotal[^\n€]*€\s*([\d.,]+)/i);
  if (!subtotalMatch || !totalMatch) {
    throw new EmailParseError("Totaux introuvables (Sous-total / Total)");
  }
  const subtotal = toNumber(subtotalMatch[1]);
  const deliveryFee = deliveryFeeMatch ? toNumber(deliveryFeeMatch[1]) : 0;
  const total = toNumber(totalMatch[1]);

  const itemsSum = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
  if (Math.abs(itemsSum - subtotal) > 0.02) {
    throw new EmailParseError(
      `Incohérence: somme des articles (${itemsSum}€) ≠ sous-total annoncé (${subtotal}€)`
    );
  }

  const paymentMatch = body.match(/Mode de paiement\s*:\s*([^\n]+)/i);

  // Créneau choisi par le client : présent uniquement dans les emails "Nouvelle commande" et
  // "confirmée" (pas dans "expédiée"), sous la forme "... Livraison : 19h-22h" suivi du créneau
  // choisi (sur sa propre ligne, ou accolé sur la même ligne selon le gabarit). Le créneau lui-même
  // a été vu sous deux formats selon la commande : abrégé ("19h", "19h30") et en toutes lettres
  // ("19 heures") — vu sur la commande #2164 du 2026-07-25, qui a fait échouer la capture de
  // l'heure de retrait (requestedFor est resté vide) tant que seul le format abrégé était géré.
  const slotMatch = body.match(
    /Délai minimum\s*:\s*(\d+)\s*min[\s\S]*?Livraison\s*:\s*\d{1,2}h\d{0,2}-\d{1,2}h\d{0,2}\s*\n?\s*(\d{1,2}h\d{0,2}|\d{1,2}\s*heures?)\b/i
  );
  const prepMinutes = slotMatch ? Number(slotMatch[1]) : undefined;
  const requestedTimeLabel = slotMatch ? normalizeTimeLabel(slotMatch[2]) : undefined;

  // Bloc client : capturé jusqu'au pied de page connu (les gabarits ont des textes différents
  // ici — "Informations client" (A/B) ou "Coordonnées client" (C, vu sur la commande #2201 du
  // 2026-08-08)), puis on isole "Méthode d'expédition"/"Méthode de livraison" (même variation
  // selon le gabarit) séparément car elle peut être accolée au téléphone sur la même ligne quand
  // la mise en page HTML à deux colonnes est aplatie en texte brut.
  const clientBlockMatch = body.match(/(?:Informations|Coordonnées) client\s*([\s\S]*?)(?:Si vous avez des questions|$)/i);
  let customerEmail: string | undefined;
  let customerPhone: string | undefined;
  let customerNameFromBlock: string | undefined;
  let addressLines: string[] = [];
  let shippingLabel: string | undefined;

  if (clientBlockMatch) {
    const rawBlock = clientBlockMatch[1];
    shippingLabel = rawBlock.match(/Méthode d(?:'expédition|e livraison)\s*:?\s*\n?([^\n]*)/i)?.[1]?.trim();
    const clientOnly = rawBlock.replace(/Méthode d(?:'expédition|e livraison)[\s\S]*$/i, "");

    const lines = clientOnly
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const emailIdx = lines.findIndex((l) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l));
    const phoneIdx = lines.findIndex((l) => /^\+?\d[\d\s]{6,}$/.test(l));

    if (emailIdx >= 0) customerEmail = lines[emailIdx];
    if (phoneIdx >= 0) customerPhone = lines[phoneIdx];

    customerNameFromBlock = lines[0];
    const boundaries = [emailIdx, phoneIdx].filter((i) => i >= 0);
    const cutoff = boundaries.length > 0 ? Math.min(...boundaries) : lines.length;
    addressLines = lines.slice(1, cutoff);
  }

  const meaningfulAddress = addressLines.filter((l) => l.length > 1 && !/^X(\s?X)*$/.test(l));

  // Ordre de fiabilité décroissante : "Commander: Livraison/À emporter" (gabarit A, explicite par
  // article) > "Méthode d'expédition" (le champ officiel du compte client) > suffixe "— À
  // emporter" par article (gabarit C — vu peu fiable en pratique, cf. commande #2164 ci-dessus)
  // > frais de livraison réels (> 0€) en dernier recours.
  const isDelivery = commanderLabel
    ? /livraison/i.test(commanderLabel) && !/emporter/i.test(commanderLabel)
    : shippingLabel
      ? /livraison|domicile/i.test(shippingLabel)
      : dashFulfillmentLabel
        ? /livraison/i.test(dashFulfillmentLabel) && !/emporter/i.test(dashFulfillmentLabel)
        : deliveryFee > 0;
  const type = isDelivery ? OrderType.LIVRAISON : OrderType.EMPORTER;

  return {
    externalRef,
    customerName: customerNameFromBlock || nameFallbackMatch?.[1]?.trim() || "Client site web",
    customerEmail,
    customerPhone,
    deliveryAddress: type === OrderType.LIVRAISON && meaningfulAddress.length > 0 ? meaningfulAddress.join(", ") : undefined,
    type,
    items,
    subtotal,
    deliveryFee,
    total,
    paymentMethod: paymentMatch?.[1]?.trim(),
    fulfillmentLabel: commanderLabel || dashFulfillmentLabel || undefined,
    requestedTimeLabel,
    prepMinutes,
  };
}
