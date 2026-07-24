import { printer as ThermalPrinter, types as PrinterTypes, characterSet as CharacterSet } from "node-thermal-printer";
import { OrderItemStatus, OrderSource, OrderType, PaymentMethod } from "@le-tandoor/shared";
import { RESTAURANT_TIMEZONE } from "../../timezone.js";
import type { OrderWithRelations } from "../orders/order-include.js";

function formatDateTime(date: Date): string {
  return date.toLocaleString("fr-FR", { timeZone: RESTAURANT_TIMEZONE });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { timeZone: RESTAURANT_TIMEZONE, hour: "2-digit", minute: "2-digit" });
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

/** Type, table ou coordonnées client selon le canal — essentiel pour l'emporter/la livraison. */
function writeOrderContext(printer: ThermalPrinter, order: OrderWithRelations) {
  const tableLabel = order.orderTables[0]?.table?.name;

  printer.setTextDoubleHeight();
  printer.bold(true);
  printer.println(`${ORDER_TYPE_LABELS[order.type] ?? order.type}${tableLabel ? " - " + tableLabel : ""}`);
  printer.bold(false);
  printer.setTextNormal();

  if (order.source === OrderSource.SITE_WEB) {
    printer.println("(Commande site web)");
  }

  if (order.type !== OrderType.SUR_PLACE) {
    if (order.customerName) printer.println(`Client: ${order.customerName}`);
    if (order.customerPhone) printer.println(`Tel: ${order.customerPhone}`);
  }
  if (order.type === OrderType.LIVRAISON && order.deliveryAddress) {
    printer.bold(true);
    printer.println(`Adresse: ${order.deliveryAddress}`);
    printer.bold(false);
  }
  if (order.requestedFor) {
    const label = order.type === OrderType.LIVRAISON ? "Livraison souhaitee" : "Retrait souhaite";
    printer.bold(true);
    printer.setTextQuadArea();
    printer.println(`${label}:`);
    printer.println(formatTime(new Date(order.requestedFor)));
    printer.setTextNormal();
    printer.bold(false);
  }
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

export function writeKitchenTicket(printer: ThermalPrinter, order: OrderWithRelations) {
  printer.alignCenter();
  printer.setTextDoubleHeight();
  printer.bold(true);
  printer.println("LE TANDOOR");
  printer.bold(false);
  printer.setTextNormal();
  printer.println("TICKET CUISINE");
  printer.drawLine();

  printer.alignLeft();
  printer.setTextDoubleHeight();
  printer.println(`Commande #${order.orderNumber}`);
  printer.setTextNormal();
  printer.println(formatDateTime(new Date(order.createdAt)));
  writeOrderContext(printer, order);
  printer.drawLine();

  for (const item of order.items) {
    if (item.status === OrderItemStatus.ANNULE) continue;
    printer.bold(true);
    printer.setTextQuadArea();
    printer.println(`${item.quantity}x ${item.nameSnapshot}`);
    printer.setTextNormal();
    printer.bold(false);
    for (const opt of item.options) {
      printer.println(`   + ${opt.name}`);
    }
    if (item.notes) {
      printer.println(`   Note: ${item.notes}`);
    }
  }

  printer.drawLine();
  printer.cut();
}

export function writeReceipt(printer: ThermalPrinter, order: OrderWithRelations) {
  printer.alignCenter();
  printer.bold(true);
  printer.setTextDoubleHeight();
  printer.println("LE TANDOOR");
  printer.setTextNormal();
  printer.bold(false);
  printer.println("Specialites Indienne et Pakistanaise");
  printer.println("1 Rue de Belgique, Lorient");
  printer.drawLine();

  printer.alignLeft();
  printer.println(`Commande #${order.orderNumber}`);
  printer.println(formatDateTime(new Date(order.createdAt)));
  writeOrderContext(printer, order);
  printer.drawLine();

  for (const item of order.items) {
    if (item.status === OrderItemStatus.ANNULE) continue;
    const lineTotal = Number(item.unitPriceSnapshot) * item.quantity;
    printer.leftRight(`${item.quantity}x ${item.nameSnapshot}`, formatMoney(lineTotal));
    for (const opt of item.options) {
      if (Number(opt.priceDelta) !== 0) {
        printer.leftRight(`  + ${opt.name}`, formatMoney(opt.priceDelta));
      } else {
        printer.println(`  + ${opt.name}`);
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
