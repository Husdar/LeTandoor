import { env } from "./env.js";

/**
 * iCloud (smtp.mail.me.com) bloque silencieusement les connexions SMTP sortantes depuis les IP
 * de datacenter (Render, AWS...) — Apple filtre ainsi les serveurs cloud pour lutter contre le
 * spam. La réception (IMAP) fonctionne normalement, seul l'envoi est concerné. On passe donc par
 * l'API HTTP de Brevo (gratuite, conçue pour l'envoi transactionnel depuis un serveur), qui
 * n'a besoin que d'un expéditeur vérifié — pas d'un nom de domaine.
 */
export async function sendCustomerEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  if (!env.brevoApiKey || !env.brevoSenderEmail) {
    console.warn("[mailer] BREVO_API_KEY/BREVO_SENDER_EMAIL non configurés — email client non envoyé");
    return;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Le Tandoor", email: env.brevoSenderEmail },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Erreur API Brevo (${response.status}) : ${body.slice(0, 300)}`);
  }
}
