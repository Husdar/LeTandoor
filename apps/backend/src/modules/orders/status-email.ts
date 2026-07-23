import { OrderStatus, OrderType } from "@le-tandoor/shared";
import { sendCustomerEmail } from "../../mailer.js";
import type { OrderWithRelations } from "./order-include.js";

// La confirmation (NOUVELLE) est envoyée séparément à la création de la commande (voir
// sendConfirmationEmail) — ici on ne réagit qu'aux transitions de statut ultérieures.
const NOTIFIED_STATUSES: OrderStatus[] = [OrderStatus.EN_PREPARATION, OrderStatus.PRETE];

function fulfillmentPhrase(order: OrderWithRelations): string {
  if (order.type === OrderType.LIVRAISON) return "sera livrée";
  if (order.type === OrderType.EMPORTER) return "sera prête à récupérer sur place";
  return "sera servie à table";
}

function readyPhrase(order: OrderWithRelations): string {
  if (order.type === OrderType.LIVRAISON) return "Votre commande est prête et va être livrée sous peu.";
  if (order.type === OrderType.EMPORTER) return "Votre commande est prête, vous pouvez venir la récupérer.";
  return "Votre commande est prête.";
}

function buildEmail(order: OrderWithRelations, status: OrderStatus): { subject: string; text: string } | null {
  const ref = order.externalRef ?? String(order.orderNumber);
  const itemLines = order.items.map((i) => `- ${i.quantity}x ${i.nameSnapshot}`).join("\n");

  if (status === OrderStatus.NOUVELLE) {
    return {
      subject: `Le Tandoor — Commande n°${ref} confirmée`,
      text: `Bonjour,

Nous avons bien reçu votre commande n°${ref} chez Le Tandoor, elle ${fulfillmentPhrase(order)}.

${itemLines}

Total : ${Number(order.total).toFixed(2)}€

Nous vous tiendrons informé de son avancement par email.

Le Tandoor — 1 Rue de Belgique, Lorient`,
    };
  }

  if (status === OrderStatus.EN_PREPARATION) {
    return {
      subject: `Le Tandoor — Commande n°${ref} en préparation`,
      text: `Bonjour,

Votre commande n°${ref} est maintenant en cours de préparation en cuisine.

Le Tandoor — 1 Rue de Belgique, Lorient`,
    };
  }

  if (status === OrderStatus.PRETE) {
    return {
      subject: `Le Tandoor — Commande n°${ref} prête`,
      text: `Bonjour,

${readyPhrase(order)}

Le Tandoor — 1 Rue de Belgique, Lorient`,
    };
  }

  return null;
}

/** Envoie un email au client si le statut de la commande vient de changer vers une étape notifiable. */
export async function notifyOrderStatusChange(
  order: OrderWithRelations,
  previousStatus: OrderStatus
): Promise<void> {
  if (!order.customerEmail) return;
  if (order.status === previousStatus) return;
  if (!NOTIFIED_STATUSES.includes(order.status)) return;

  const email = buildEmail(order, order.status);
  if (!email) return;

  try {
    await sendCustomerEmail(order.customerEmail, email.subject, email.text);
  } catch (err) {
    console.error(`[status-email] échec d'envoi pour la commande ${order.id}`, err);
  }
}

/** Envoie l'email de confirmation à la création d'une commande (statut initial NOUVELLE). */
export async function sendConfirmationEmail(order: OrderWithRelations): Promise<void> {
  if (!order.customerEmail) return;
  const email = buildEmail(order, OrderStatus.NOUVELLE);
  if (!email) return;

  try {
    await sendCustomerEmail(order.customerEmail, email.subject, email.text);
  } catch (err) {
    console.error(`[status-email] échec d'envoi de confirmation pour la commande ${order.id}`, err);
  }
}
