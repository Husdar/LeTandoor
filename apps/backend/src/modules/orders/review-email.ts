import { OrderStatus } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { sendCustomerEmail } from "../../mailer.js";
import { BRAND_COLORS as COLORS, brandedEmailShell } from "../../email-template.js";
import { env } from "../../env.js";

const CHECK_INTERVAL_MS = 5 * 60_000;
const REVIEW_DELAY_MS = 30 * 60_000;

function buildReviewEmail(): { subject: string; text: string; html: string } {
  const subject = "Le Tandoor — Votre avis compte pour nous !";
  const text = `Bonjour,

Merci d'avoir choisi Le Tandoor ! Si vous avez apprécié votre repas, prendriez-vous une minute pour nous laisser un avis Google ? Cela nous aide énormément à nous améliorer.

${env.googleReviewUrl}

Merci et à bientôt !
Le Tandoor — 1 Rue de Belgique, Lorient`;

  const html = brandedEmailShell({
    heading: "Votre avis compte pour nous !",
    bodyHtml: `
      <p style="margin:0 0 8px;">Bonjour,</p>
      <p style="margin:0 0 18px;">Merci d'avoir choisi Le Tandoor ! Si vous avez apprécié votre repas, prendriez-vous une minute pour nous laisser un avis Google ? Cela nous aide énormément à nous améliorer.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:4px 0 6px;">
            <a href="${env.googleReviewUrl}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${COLORS.burgundy};color:${COLORS.goldLight};font-weight:700;text-decoration:none;font-size:15px;">Laisser un avis Google</a>
          </td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-size:13px;color:${COLORS.burgundyLight};">Merci et à bientôt !</p>`,
  });

  return { subject, text, html };
}

async function sendPendingReviewEmails() {
  const threshold = new Date(Date.now() - REVIEW_DELAY_MS);
  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.TERMINEE,
      customerEmail: { not: null },
      reviewEmailSentAt: null,
      closedAt: { lte: threshold },
    },
  });

  for (const order of orders) {
    if (!order.customerEmail) continue;
    const email = buildReviewEmail();
    try {
      await sendCustomerEmail(order.customerEmail, email.subject, email.text, email.html);
      await prisma.order.update({ where: { id: order.id }, data: { reviewEmailSentAt: new Date() } });
      console.log(`[review-email] email d'avis envoyé pour la commande ${order.id}`);
    } catch (err) {
      console.error(`[review-email] échec d'envoi pour la commande ${order.id}`, err);
    }
  }
}

/** Toutes les 5 min, envoie l'email "donnez votre avis" aux commandes clôturées depuis plus de
 * 30 min avec un email client connu, une seule fois par commande (reviewEmailSentAt). */
export function startReviewEmailScheduler(log: { error: (err: unknown, msg: string) => void }) {
  setInterval(() => {
    void sendPendingReviewEmails().catch((err) => log.error(err, "Échec du cycle d'envoi des emails d'avis"));
  }, CHECK_INTERVAL_MS);
}
