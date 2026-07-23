import { OrderStatus, OrderType } from "@le-tandoor/shared";
import { sendCustomerEmail } from "../../mailer.js";
import { BRAND_COLORS as COLORS, brandedEmailShell, escapeHtml as esc, formatEuros } from "../../email-template.js";
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

function itemsTableHtml(order: OrderWithRelations): string {
  const rows = order.items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #EFE4D0;color:${COLORS.burgundy};font-size:15px;">
            <span style="color:${COLORS.goldDark};font-weight:600;">${i.quantity}×</span>&nbsp; ${esc(i.nameSnapshot)}
          </td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">${rows}</table>`;
}

function buildEmail(order: OrderWithRelations, status: OrderStatus): { subject: string; text: string; html: string } | null {
  const ref = order.externalRef ?? String(order.orderNumber);

  if (status === OrderStatus.NOUVELLE) {
    const itemLines = order.items.map((i) => `- ${i.quantity}x ${i.nameSnapshot}`).join("\n");
    return {
      subject: `Le Tandoor — Commande n°${ref} confirmée`,
      text: `Bonjour,

Nous avons bien reçu votre commande n°${ref} chez Le Tandoor, elle ${fulfillmentPhrase(order)}.

${itemLines}

Total : ${formatEuros(Number(order.total))}

Nous vous tiendrons informé de son avancement par email.

Le Tandoor — 1 Rue de Belgique, Lorient`,
      html: brandedEmailShell({
        badge: "Commande confirmée",
        heading: "Merci pour votre commande !",
        subheading: `Commande n°${esc(ref)}`,
        bodyHtml: `
          <p style="margin:0 0 8px;">Bonjour,</p>
          <p style="margin:0 0 4px;">Nous avons bien reçu votre commande, elle <strong>${fulfillmentPhrase(order)}</strong>.</p>
          ${itemsTableHtml(order)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${COLORS.burgundy};padding-top:10px;">
            <tr>
              <td style="font-size:16px;font-weight:700;color:${COLORS.burgundy};">Total</td>
              <td style="font-size:18px;font-weight:700;color:${COLORS.goldDark};text-align:right;">${formatEuros(Number(order.total))}</td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:14px;color:${COLORS.burgundyLight};">Nous vous tiendrons informé de la suite par email, à chaque étape.</p>`,
      }),
    };
  }

  if (status === OrderStatus.EN_PREPARATION) {
    return {
      subject: `Le Tandoor — Commande n°${ref} en préparation`,
      text: `Bonjour,

Votre commande n°${ref} est maintenant en cours de préparation en cuisine.

Le Tandoor — 1 Rue de Belgique, Lorient`,
      html: brandedEmailShell({
        badge: "En préparation",
        heading: "Ça chauffe en cuisine 🍛",
        subheading: `Commande n°${esc(ref)}`,
        bodyHtml: `
          <p style="margin:0 0 8px;">Bonjour,</p>
          <p style="margin:0;">Votre commande est maintenant <strong>en cours de préparation</strong> par notre équipe en cuisine.</p>`,
      }),
    };
  }

  if (status === OrderStatus.PRETE) {
    return {
      subject: `Le Tandoor — Commande n°${ref} prête`,
      text: `Bonjour,

${readyPhrase(order)}

Le Tandoor — 1 Rue de Belgique, Lorient`,
      html: brandedEmailShell({
        badge: "Prête",
        heading: "Votre commande est prête !",
        subheading: `Commande n°${esc(ref)}`,
        bodyHtml: `
          <p style="margin:0 0 8px;">Bonjour,</p>
          <p style="margin:0;">${readyPhrase(order)}</p>`,
      }),
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
    await sendCustomerEmail(order.customerEmail, email.subject, email.text, email.html);
    console.log(`[status-email] email "${order.status}" envoyé pour la commande ${order.id}`);
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
    await sendCustomerEmail(order.customerEmail, email.subject, email.text, email.html);
    console.log(`[status-email] email de confirmation envoyé pour la commande ${order.id}`);
  } catch (err) {
    console.error(`[status-email] échec d'envoi de confirmation pour la commande ${order.id}`, err);
  }
}
