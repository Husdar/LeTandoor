import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env.js";

/**
 * Réutilise le compte iCloud déjà configuré pour la réception des commandes (IMAP) — le même
 * mot de passe d'application permet aussi l'envoi SMTP (smtp.mail.me.com:587) sans identifiant
 * distinct à gérer.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.imapUser || !env.imapPassword) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.mail.me.com",
      port: 587,
      secure: false,
      auth: { user: env.imapUser, pass: env.imapPassword },
    });
  }
  return transporter;
}

export async function sendCustomerEmail(to: string, subject: string, text: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn("[mailer] IMAP_USER/IMAP_PASSWORD non configurés — email client non envoyé");
    return;
  }
  await t.sendMail({
    from: `"Le Tandoor" <${env.imapUser}>`,
    to,
    subject,
    text,
  });
}
