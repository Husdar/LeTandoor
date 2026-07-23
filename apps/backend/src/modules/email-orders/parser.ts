import { OrderType } from "@le-tandoor/shared";
import { RESTAURANT_TIMEZONE, timezoneOffsetMinutes } from "../../timezone.js";

export interface ParsedEmailOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
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

  const refMatch = subject.match(/#(\d+)/) ?? body.match(/Ordre\s*#(\d+)/i);
  if (!refMatch) {
    throw new EmailParseError("Numéro de commande introuvable dans l'email");
  }
  const externalRef = refMatch[1];

  const nameFallbackMatch = body.match(/reçu une nouvelle commande de\s+(.+?)\.?\s*\n/);

  const itemsSectionMatch = body.match(/résumé\s*\n([\s\S]*?)\nSous-total/i);
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
  let fulfillmentLabel = "";
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(itemsSection))) {
    const [, rawName, fulfillment, qty, unitPrice, lineTotalNextLine, lineTotalSameLine] = match;
    if (fulfillment) fulfillmentLabel = fulfillment.trim();

    // Le tiret cadratin a deux usages opposés selon le gabarit, à distinguer :
    //  - offre groupée : "- 1 acheté = 1 offert — 2x Poulet Curry" (le vrai nom SUIT le tiret)
    //  - mode de retrait par article : "- Poisson Kashmiri — À emporter" (le vrai nom PRÉCÈDE le
    //    tiret, suivi du mode de retrait — à traiter comme un "Commander: ..." si aucun n'est
    //    déjà connu, car c'est un signal fiable pour le type de commande).
    let name = rawName.trim().replace(/^-\s*/, "");
    const dashIdx = name.lastIndexOf("—");
    if (dashIdx >= 0) {
      const before = name.slice(0, dashIdx).trim();
      const after = name.slice(dashIdx + 1).trim();
      if (/^(à emporter|a emporter|emporter|livraison|sur place)$/i.test(after)) {
        name = before;
        if (!fulfillmentLabel) fulfillmentLabel = after;
      } else {
        name = after;
      }
    }
    name = name.replace(/^\d+\s*x\s*/i, "");

    items.push({
      name,
      quantity: Number(qty),
      unitPrice: toNumber(unitPrice),
      lineTotal: toNumber(lineTotalNextLine ?? lineTotalSameLine),
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
  // "confirmée" (pas dans "expédiée"), sous la forme "... Livraison : 19h-22h" suivi de "19h"
  // (sur sa propre ligne, ou accolé sur la même ligne selon le gabarit).
  const slotMatch = body.match(
    /Délai minimum\s*:\s*(\d+)\s*min[\s\S]*?Livraison\s*:\s*\d{1,2}h\d{0,2}-\d{1,2}h\d{0,2}\s*\n?\s*(\d{1,2}h\d{0,2})\b/i
  );
  const prepMinutes = slotMatch ? Number(slotMatch[1]) : undefined;
  const requestedTimeLabel = slotMatch ? slotMatch[2] : undefined;

  // Bloc client : capturé jusqu'au pied de page connu (les deux gabarits ont des textes différents
  // ici), puis on isole "Méthode d'expédition" séparément car elle peut être accolée au téléphone
  // sur la même ligne quand la mise en page HTML à deux colonnes est aplatie en texte brut.
  const clientBlockMatch = body.match(/Informations client\s*([\s\S]*?)(?:Si vous avez des questions|$)/i);
  let customerEmail: string | undefined;
  let customerPhone: string | undefined;
  let customerNameFromBlock: string | undefined;
  let addressLines: string[] = [];
  let shippingLabel: string | undefined;

  if (clientBlockMatch) {
    const rawBlock = clientBlockMatch[1];
    shippingLabel = rawBlock.match(/Méthode d'expédition\s*:?\s*\n?([^\n]*)/i)?.[1]?.trim();
    const clientOnly = rawBlock.replace(/Méthode d'expédition[\s\S]*$/i, "");

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

  // L'ancien gabarit indiquait le type par article ("Commander: Livraison/À emporter") — fait foi
  // si présent. Le nouveau ne le fait plus : "Méthode d'expédition" est alors le repère le plus
  // fiable (ex: "Livraison à domicile" vs le nom du point de retrait, ex: "Tandoor / Lorient").
  // La présence d'une adresse n'est PAS un bon signal ici : le compte client affiche sa propre
  // adresse même pour une commande à emporter. En dernier recours, des frais de livraison réels
  // (> 0€) indiquent une livraison ; sinon on considère que c'est un retrait.
  const isDelivery = fulfillmentLabel
    ? /livraison/i.test(fulfillmentLabel) && !/emporter/i.test(fulfillmentLabel)
    : shippingLabel
      ? /livraison|domicile/i.test(shippingLabel)
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
    fulfillmentLabel: fulfillmentLabel || undefined,
    requestedTimeLabel,
    prepMinutes,
  };
}
