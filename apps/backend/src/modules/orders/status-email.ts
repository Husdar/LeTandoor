import { OrderStatus, OrderType } from "@le-tandoor/shared";
import { sendCustomerEmail } from "../../mailer.js";
import type { OrderWithRelations } from "./order-include.js";

// La confirmation (NOUVELLE) est envoyée séparément à la création de la commande (voir
// sendConfirmationEmail) — ici on ne réagit qu'aux transitions de statut ultérieures.
const NOTIFIED_STATUSES: OrderStatus[] = [OrderStatus.EN_PREPARATION, OrderStatus.PRETE];

const COLORS = {
  burgundy: "#6E1423",
  burgundyLight: "#8C1B2E",
  burgundyDark: "#4A0D18",
  gold: "#C9A227",
  goldLight: "#E0C463",
  goldDark: "#9C7D1E",
  cream: "#FAF3E7",
  green: "#2E7D32",
};

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")}€`;
}

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

function badgeHtml(label: string, bg: string, fg: string): string {
  return `<span style="display:inline-block;padding:6px 16px;border-radius:999px;background:${bg};color:${fg};font-size:13px;font-weight:700;letter-spacing:0.3px;">${label}</span>`;
}

function emailShell(params: { badge: string; heading: string; bodyHtml: string; ref: string }): string {
  const { badge, heading, bodyHtml, ref } = params;
  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:0;background:${COLORS.cream};font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cream};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(110,20,35,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,${COLORS.burgundyLight},${COLORS.burgundy} 60%,${COLORS.burgundyDark});padding:32px 32px 26px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.08);border:1.5px solid ${COLORS.gold};margin-bottom:14px;">
                <span style="font-size:24px;line-height:52px;">🔥</span>
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:${COLORS.goldLight};letter-spacing:0.5px;">Le Tandoor</div>
              <div style="font-size:12px;color:#EADFCB;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px;">Cuisine indienne &amp; pakistanaise — Lorient</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 32px 8px;text-align:center;">
              ${badgeHtml(badge, COLORS.cream, COLORS.burgundy)}
              <h1 style="margin:16px 0 4px;font-size:21px;color:${COLORS.burgundy};font-weight:700;">${heading}</h1>
              <p style="margin:0;font-size:13px;color:#9C8C7A;">Commande n°${esc(ref)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 6px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,${COLORS.gold},transparent);margin:10px 0 4px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 8px;color:${COLORS.burgundy};font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:26px 32px 30px;text-align:center;">
              <div style="height:1px;background:${COLORS.cream};margin-bottom:20px;"></div>
              <p style="margin:0;font-size:12px;color:#B2A28D;">Le Tandoor — 1 Rue de Belgique, 56100 Lorient</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
      html: emailShell({
        badge: "Commande confirmée",
        heading: "Merci pour votre commande !",
        ref,
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
      html: emailShell({
        badge: "En préparation",
        heading: "Ça chauffe en cuisine 🍛",
        ref,
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
      html: emailShell({
        badge: "Prête",
        heading: "Votre commande est prête !",
        ref,
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
  } catch (err) {
    console.error(`[status-email] échec d'envoi de confirmation pour la commande ${order.id}`, err);
  }
}
