import { printer as ThermalPrinter, types as PrinterTypes, characterSet as CharacterSet } from "node-thermal-printer";
import { OrderItemStatus, OrderSource, OrderType, PaymentMethod } from "@le-tandoor/shared";
import { RESTAURANT_TIMEZONE } from "../../timezone.js";
import { LOGO_PNG_BASE64 } from "./logo.js";
import type { OrderWithRelations } from "../orders/order-include.js";

function formatDateTime(date: Date): string {
  return date.toLocaleString("fr-FR", { timeZone: RESTAURANT_TIMEZONE });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { timeZone: RESTAURANT_TIMEZONE, hour: "2-digit", minute: "2-digit" });
}

/** Numéro affiché : celui du site web (externalRef) s'il existe, sinon le numéro interne — pour
 * qu'une commande site web porte le même numéro sur le ticket que celui vu par le client. */
function ref(order: OrderWithRelations): string {
  return order.externalRef ?? String(order.orderNumber);
}

/** Retire un suffixe descriptif entre parenthèses en fin de nom (ex: "Butter Chicken (spécialité
 * du chef)" -> "Butter Chicken") pour un ticket cuisine plus court et plus lisible en un coup d'œil. */
function shortenName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  SUR_PLACE: "Sur place",
  EMPORTER: "A emporter",
  LIVRAISON: "Livraison",
};

const PAYMENT_LABELS: Record<string, string> = {
  [PaymentMethod.ESPECES]: "Especes",
  [PaymentMethod.CARTE]: "Carte",
  [PaymentMethod.TICKET_RESTAURANT]: "Ticket restaurant",
  [PaymentMethod.AUTRE]: "Autre",
};

/**
 * Ticket width tuned for an 80mm Epson thermal printer (42 characters per line at
 * normal font). Adjust `width` if the printer is configured for 58mm paper instead.
 */
export function createPrinterClient(ip: string, port: number): ThermalPrinter {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${ip}:${port}`,
    characterSet: CharacterSet.PC858_EURO,
    removeSpecialCharacters: false,
    width: 42,
    options: { timeout: 5000 },
  });
}

function formatMoney(value: unknown): string {
  return `${Number(value).toFixed(2)} EUR`;
}

type OrderItemWithRelations = OrderWithRelations["items"][number];

interface CategoryGroup {
  categoryName: string;
  position: number;
  items: OrderItemWithRelations[];
}

/** Regroupe les articles par catégorie de menu (entrées, plats...) pour un ticket plus lisible ;
 * les articles sans catégorie connue (ex: article non reconnu d'une commande site web) finissent
 * dans un groupe "Autres" en fin de ticket plutôt que d'être mélangés. */
function groupItemsByCategory(items: OrderItemWithRelations[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const item of items) {
    const category = item.menuItem?.category;
    const key = category?.id ?? "__autres__";
    if (!groups.has(key)) {
      groups.set(key, {
        categoryName: category?.name ?? "Autres",
        position: category?.position ?? Number.MAX_SAFE_INTEGER,
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }
  return Array.from(groups.values()).sort((a, b) => a.position - b.position);
}

/** Ticket court utilisé par l'assistant de configuration pour vérifier qu'une imprimante répond avant de l'enregistrer. */
export function writeTestTicket(printer: ThermalPrinter) {
  printer.alignCenter();
  printer.setTextDoubleHeight();
  printer.bold(true);
  printer.println("LE TANDOOR");
  printer.bold(false);
  printer.setTextNormal();
  printer.println("TEST D'IMPRESSION");
  printer.drawLine();
  printer.alignLeft();
  printer.println(new Date().toLocaleString("fr-FR"));
  printer.println("Si vous lisez ce ticket, l'imprimante");
  printer.println("est correctement connectee.");
  printer.drawLine();
  printer.cut();
}

// Espacement de ligne par défaut ESC/POS (1/6 pouce ≈ 4,23 mm) — sert à convertir la marge
// d'accroche restante (après le logo) en nombre de sauts de ligne.
const DEFAULT_LINE_HEIGHT_MM = 4.23;
const KITCHEN_LOGO_HEIGHT_MM = 9; // hauteur imprimée réelle du logo (~64px à 180 dpi)
const KITCHEN_TICKET_HANG_MARGIN_MM = 50;
const KITCHEN_TICKET_PADDING_LINES = Math.round(
  (KITCHEN_TICKET_HANG_MARGIN_MM - KITCHEN_LOGO_HEIGHT_MM) / DEFAULT_LINE_HEIGHT_MM
);

/** Ticket cuisine volontairement minimal : juste le numéro, le contexte (type/table/horaire) et
 * les plats — pas de branding ni de coordonnées client, pour aller droit au but en cuisine. */
export async function writeKitchenTicket(printer: ThermalPrinter, order: OrderWithRelations) {
  const tableLabel = order.orderTables[0]?.table?.name;

  // Le logo occupe le haut de la marge d'accroche (~5cm) au lieu de la laisser vide, le reste de
  // la marge est complété en blanc pour qu'un clip/pince ne cache jamais le détail de la commande.
  printer.alignCenter();
  await printer.printImageBuffer(Buffer.from(LOGO_PNG_BASE64, "base64"));
  for (let i = 0; i < KITCHEN_TICKET_PADDING_LINES; i++) {
    printer.newLine();
  }

  printer.bold(true);
  printer.setTextQuadArea();
  printer.println(`#${ref(order)}`);
  printer.setTextNormal();
  printer.bold(false);

  printer.bold(true);
  printer.setTextDoubleHeight();
  printer.println(`${ORDER_TYPE_LABELS[order.type] ?? order.type}${tableLabel ? " - " + tableLabel : ""}`);
  printer.setTextNormal();
  printer.bold(false);

  const timeLabel = order.type === OrderType.LIVRAISON ? "Heure de livraison" : "Heure de retrait";
  printer.bold(true);
  printer.setTextDoubleHeight();
  printer.println(`${timeLabel}:`);
  if (order.requestedFor) {
    printer.setTextQuadArea();
    printer.println(formatTime(new Date(order.requestedFor)));
  } else {
    printer.println("Aucune donnee trouvee");
  }
  printer.setTextNormal();
  printer.bold(false);

  printer.alignLeft();
  printer.drawLine();

  const groups = groupItemsByCategory(order.items.filter((item) => item.status !== OrderItemStatus.ANNULE));
  for (const group of groups) {
    printer.bold(true);
    printer.println(`- ${group.categoryName.toUpperCase()} -`);
    printer.bold(false);
    for (const item of group.items) {
      printer.bold(true);
      printer.setTextQuadArea();
      printer.println(`${item.quantity}x ${shortenName(item.nameSnapshot)}`);
      printer.setTextNormal();
      printer.bold(false);
      for (const opt of item.options) {
        printer.println(`   + ${opt.name}`);
      }
      if (item.notes) {
        printer.println(`   Note: ${item.notes}`);
      }
    }
  }

  printer.drawLine();
  printer.cut();
}

/** Reçu caisse — mise en page inspirée d'un ticket Uber Eats : logo en haut, puis une barre
 * inversée (texte blanc sur fond noir) avec le numéro de commande en très gros et le nom du
 * client juste en dessous, avant le détail des articles et les totaux. */
export async function writeReceipt(printer: ThermalPrinter, order: OrderWithRelations) {
  const tableLabel = order.orderTables[0]?.table?.name;

  printer.alignCenter();
  await printer.printImageBuffer(Buffer.from(LOGO_PNG_BASE64, "base64"));
  printer.newLine();

  printer.invert(true);
  printer.bold(true);
  printer.setTextQuadArea();
  printer.println(`#${ref(order)}`);
  if (order.customerName) {
    printer.setTextDoubleHeight();
    printer.println(order.customerName);
  }
  printer.setTextNormal();
  printer.bold(false);
  printer.invert(false);

  printer.println(formatDateTime(new Date(order.createdAt)));
  if (order.requestedFor) {
    const label = order.type === OrderType.LIVRAISON ? "Livraison prevue" : "A preparer pour";
    printer.println(`${label}: ${formatTime(new Date(order.requestedFor))}`);
  }
  printer.newLine();

  printer.bold(true);
  printer.setTextDoubleHeight();
  printer.println(`${(ORDER_TYPE_LABELS[order.type] ?? order.type).toUpperCase()}${tableLabel ? " - " + tableLabel : ""}`);
  printer.setTextNormal();
  printer.bold(false);

  if (order.source === OrderSource.SITE_WEB) {
    printer.println("(Commande site web)");
  }
  if (order.type !== OrderType.SUR_PLACE && order.customerPhone) {
    printer.println(`Tel: ${order.customerPhone}`);
  }
  if (order.type === OrderType.LIVRAISON && order.deliveryAddress) {
    printer.bold(true);
    printer.println(`Adresse: ${order.deliveryAddress}`);
    printer.bold(false);
  }

  printer.alignLeft();
  printer.drawLine();

  const receiptGroups = groupItemsByCategory(order.items.filter((item) => item.status !== OrderItemStatus.ANNULE));
  for (const group of receiptGroups) {
    printer.bold(true);
    printer.println(`- ${group.categoryName.toUpperCase()} -`);
    printer.bold(false);
    for (const item of group.items) {
      const lineTotal = Number(item.unitPriceSnapshot) * item.quantity;
      printer.bold(true);
      printer.leftRight(`${item.quantity}x ${item.nameSnapshot}`, formatMoney(lineTotal));
      printer.bold(false);
      for (const opt of item.options) {
        if (Number(opt.priceDelta) !== 0) {
          printer.leftRight(`  + ${opt.name}`, formatMoney(opt.priceDelta));
        } else {
          printer.println(`  + ${opt.name}`);
        }
      }
    }
  }

  printer.drawLine();
  printer.leftRight("Sous-total", formatMoney(order.subtotal));
  if (Number(order.deliveryFee) > 0) {
    printer.leftRight("Livraison", formatMoney(order.deliveryFee));
  }
  if (Number(order.discountAmount) > 0) {
    printer.leftRight("Remise", `-${formatMoney(order.discountAmount)}`);
  }
  printer.bold(true);
  printer.leftRight("TOTAL", formatMoney(order.total));
  printer.bold(false);

  const lastPayment = order.payments[order.payments.length - 1];
  if (lastPayment) {
    printer.println(`Paiement: ${PAYMENT_LABELS[lastPayment.method] ?? lastPayment.method}`);
  }

  printer.drawLine();
  printer.alignCenter();
  printer.println("Merci de votre visite !");
  printer.cut();
}
