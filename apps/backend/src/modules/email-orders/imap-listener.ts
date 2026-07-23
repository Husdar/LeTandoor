import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { env } from "../../env.js";
import { ingestOrderEmail } from "./ingest.js";

const RECONNECT_DELAY_MS = 10_000;
const FALLBACK_POLL_MS = 5 * 60 * 1000;

let client: ImapFlow | null = null;
let processing = false;
let stopped = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function processMailbox() {
  if (!client || processing) return;
  processing = true;
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // On ne filtre pas sur le statut lu/non-lu : si l'email est consulté depuis un téléphone
      // ou un autre client mail, il serait marqué "lu" avant notre passage et jamais traité.
      // La fenêtre de quelques jours + la déduplication par messageId (voir ingestOrderEmail)
      // suffisent à ne jamais rater ni traiter deux fois une commande.
      const since = new Date();
      since.setDate(since.getDate() - 3);
      const uids = await client.search({ since }, { uid: true });
      if (!uids || uids.length === 0) return;

      for (const uid of uids) {
        const message = await client.fetchOne(uid, { source: true }, { uid: true });
        if (!message || !message.source) continue;

        const parsed = await simpleParser(message.source);
        const fromAddress = parsed.from?.value[0]?.address?.toLowerCase();

        const senderMatches =
          env.orderEmailSenders.length === 0 || (!!fromAddress && env.orderEmailSenders.includes(fromAddress));
        const subjectMatches =
          !env.orderEmailSubjectPattern || (parsed.subject ?? "").includes(env.orderEmailSubjectPattern);

        if (!senderMatches || !subjectMatches) {
          continue;
        }

        const result = await ingestOrderEmail({
          messageId: parsed.messageId ?? `uid-${uid}@imap`,
          subject: parsed.subject ?? "",
          text: parsed.text ?? "",
          receivedAt: parsed.date ?? new Date(),
        });

        console.log(
          `[email-orders] uid=${uid} statut=${result.status}${result.errorMessage ? " — " + result.errorMessage : ""}`
        );

        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error("[email-orders] erreur de traitement de la boîte mail", err);
  } finally {
    processing = false;
  }
}

/**
 * imapflow n'entre en écoute temps réel (push serveur) que pendant l'exécution
 * de idle() — sans cette boucle, le connecteur reste connecté mais ne reçoit
 * jamais d'événement "exists" pour les nouveaux emails. Chaque appel se termine
 * après le timeout du serveur (~29 min) ou dès qu'une autre commande interrompt
 * l'IDLE (ex: le scan périodique) ; on relance alors immédiatement.
 */
async function idleLoop() {
  while (!stopped && client) {
    try {
      await client.idle();
    } catch (err) {
      if (!stopped) console.error("[email-orders] erreur pendant l'attente IMAP (idle)", err);
      return;
    }
  }
}

async function connectAndListen() {
  const imapClient = new ImapFlow({
    host: env.imapHost,
    port: env.imapPort,
    secure: true,
    auth: { user: env.imapUser!, pass: env.imapPassword! },
    logger: false,
  });
  client = imapClient;

  imapClient.on("exists", () => {
    processMailbox().catch((err) => console.error("[email-orders] erreur inattendue", err));
  });

  imapClient.on("error", (err) => {
    console.error("[email-orders] erreur de connexion IMAP", err);
  });

  imapClient.on("close", () => {
    if (client !== imapClient) return; // déjà remplacé par une reconnexion plus récente
    client = null;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (stopped) return;
    console.warn(`[email-orders] connexion IMAP fermée, nouvelle tentative dans ${RECONNECT_DELAY_MS / 1000}s`);
    setTimeout(() => {
      connectAndListen().catch((err) => console.error("[email-orders] échec de reconnexion IMAP", err));
    }, RECONNECT_DELAY_MS);
  });

  await imapClient.connect();
  await processMailbox();
  console.log(`[email-orders] écoute IMAP active sur ${env.imapHost} (compte ${env.imapUser})`);

  idleLoop();

  // Filet de sécurité : re-scan périodique au cas où une notification IDLE serait manquée.
  pollTimer = setInterval(() => {
    processMailbox().catch((err) => console.error("[email-orders] erreur de sondage périodique", err));
  }, FALLBACK_POLL_MS);
}

export async function startEmailOrderListener() {
  if (!env.imapUser || !env.imapPassword) {
    console.log("[email-orders] IMAP non configuré (IMAP_USER/IMAP_PASSWORD absents) — ingestion email désactivée");
    return;
  }
  stopped = false;
  await connectAndListen();
}

export async function stopEmailOrderListener() {
  stopped = true;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (client) {
    await client.logout().catch(() => undefined);
    client = null;
  }
}
