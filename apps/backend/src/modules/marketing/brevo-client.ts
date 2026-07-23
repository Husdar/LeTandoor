import { env } from "../../env.js";

class BrevoError extends Error {}

async function brevoFetch(path: string, init: RequestInit): Promise<unknown> {
  if (!env.brevoApiKey) {
    throw new BrevoError("BREVO_API_KEY non configurée sur le serveur");
  }
  const response = await fetch(`https://api.brevo.com/v3${path}`, {
    ...init,
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new BrevoError(`Erreur API Brevo ${path} (${response.status}) : ${body.slice(0, 400)}`);
  }
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

/** Ajoute/synchronise en masse les contacts (email + nom) dans la liste Brevo ciblée par le marketing. */
export async function importContactsToBrevoList(
  contacts: { email: string; name?: string }[]
): Promise<void> {
  if (!env.brevoListId) {
    throw new BrevoError("BREVO_LIST_ID non configuré sur le serveur");
  }
  if (contacts.length === 0) return;

  const header = "EMAIL;NOM";
  const rows = contacts.map((c) => `${c.email};${(c.name ?? "").replace(/;/g, ",")}`);
  const fileBody = [header, ...rows].join("\n");

  await brevoFetch("/contacts/import", {
    method: "POST",
    body: JSON.stringify({
      listIds: [env.brevoListId],
      updateExistingContacts: true,
      emptyContactsAttributes: false,
      fileBody,
    }),
  });
}

/** Crée une campagne email Brevo ciblant la liste configurée, et l'envoie immédiatement. */
export async function createAndSendBrevoCampaign(params: {
  name: string;
  subject: string;
  htmlContent: string;
}): Promise<number> {
  if (!env.brevoListId) {
    throw new BrevoError("BREVO_LIST_ID non configuré sur le serveur");
  }
  if (!env.brevoSenderEmail) {
    throw new BrevoError("BREVO_SENDER_EMAIL non configuré sur le serveur");
  }

  const created = (await brevoFetch("/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      subject: params.subject,
      sender: { name: "Le Tandoor", email: env.brevoSenderEmail },
      type: "classic",
      htmlContent: params.htmlContent,
      recipients: { listIds: [env.brevoListId] },
    }),
  })) as { id: number };

  await brevoFetch(`/emailCampaigns/${created.id}/sendNow`, { method: "POST" });

  return created.id;
}
