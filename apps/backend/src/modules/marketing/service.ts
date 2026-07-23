import { MarketingCampaignStatus } from "@prisma/client";
import { prisma } from "../../db.js";
import { callOpenRouter } from "../../ai/openrouter.js";
import { escapeHtml, brandedEmailShell } from "../../email-template.js";
import { getDashboardStats } from "../analytics/service.js";
import { parseContactsText } from "./contact-parser.js";
import { importContactsToBrevoList, createAndSendBrevoCampaign } from "./brevo-client.js";

export async function importContacts(text: string) {
  const parsed = parseContactsText(text);

  for (const contact of parsed) {
    await prisma.marketingContact.upsert({
      where: { email: contact.email },
      update: { name: contact.name, subscribed: contact.subscribed },
      create: { email: contact.email, name: contact.name, subscribed: contact.subscribed, source: "IMPORT" },
    });
  }

  const total = await prisma.marketingContact.count();
  const subscribed = await prisma.marketingContact.count({ where: { subscribed: true } });
  return { imported: parsed.length, total, subscribed, unsubscribed: total - subscribed };
}

export async function listContacts() {
  return prisma.marketingContact.findMany({ orderBy: { createdAt: "desc" } });
}

export async function deleteContact(id: string) {
  await prisma.marketingContact.delete({ where: { id } });
}

function textToHtml(message: string): string {
  return message
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px;">${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export function buildCampaignPreviewHtml(subject: string, message: string): string {
  return brandedEmailShell({
    badge: "Actualité",
    heading: subject || "Votre annonce",
    bodyHtml: textToHtml(message || "Votre message apparaîtra ici…"),
  });
}

function buildMarketingSystemPrompt(): string {
  return `Tu es le rédacteur marketing du restaurant "Le Tandoor" (spécialités indiennes et pakistanaises, Lorient). Tu écris des emails promotionnels courts, chaleureux et engageants en français, dans le ton d'un restaurant indépendant convivial (jamais corporate ou générique). Réponds UNIQUEMENT avec un objet JSON valide de la forme {"subject": "...", "message": "..."} — "message" peut contenir des sauts de ligne (\\n) pour les paragraphes, pas de HTML.`;
}

/**
 * L'IA respecte rarement à 100% la consigne "réponds uniquement en JSON" — elle ajoute parfois une
 * note avant/après. On extrait la première structure JSON complète plutôt que de parser tel quel.
 */
function extractJson<T>(raw: string): T {
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error("Réponse IA sans JSON exploitable");
  const openChar = raw[start];
  const closeChar = openChar === "[" ? "]" : "}";
  const end = raw.lastIndexOf(closeChar);
  if (end === -1 || end < start) throw new Error("Réponse IA sans JSON exploitable");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

function parseJsonResponse(raw: string): { subject: string; message: string } {
  const parsed = extractJson<{ subject?: string; message?: string }>(raw);
  if (!parsed.subject || !parsed.message) {
    throw new Error("Réponse IA incomplète (sujet ou message manquant)");
  }
  return { subject: parsed.subject, message: parsed.message };
}

export async function generateCampaignDraft(brief: string): Promise<{ subject: string; message: string }> {
  const prompt = `Rédige un email marketing pour Le Tandoor à partir de ce besoin exprimé par le gérant : "${brief}".`;
  const raw = await callOpenRouter(buildMarketingSystemPrompt(), prompt, { temperature: 0.7 });
  return parseJsonResponse(raw);
}

export interface MarketingSuggestion {
  title: string;
  rationale: string;
  brief: string;
}

export async function getMarketingSuggestions(): Promise<MarketingSuggestion[]> {
  const stats = await getDashboardStats();
  const peakLines = stats.peakHours.map((h) => `${h.hour}h (${h.count} commandes)`).join(", ") || "(pas assez de données)";
  const topLines = stats.topItems.map((i) => `${i.name} (${i.quantity} vendus)`).join(", ") || "(aucune donnée)";
  const bottomLines = stats.bottomItems.map((i) => `${i.name} (${i.quantity} vendus)`).join(", ") || "(aucune donnée)";

  const prompt = `Voici les données réelles du restaurant Le Tandoor (30 derniers jours) :
- Répartition par canal : ${Object.entries(stats.channelSplit).map(([t, d]) => `${t} ${d.count} commandes`).join(", ")}
- Heures les plus actives : ${peakLines}
- Plats les plus vendus : ${topLines}
- Plats les moins vendus : ${bottomLines}
- Commandes annulées : ${stats.cancellations.count}

Propose 3 idées concrètes de campagne email marketing basées uniquement sur ces données réelles (ex: mettre en avant un plat qui se vend peu, cibler un créneau creux, etc.). Réponds UNIQUEMENT avec un tableau JSON de la forme [{"title": "titre court", "rationale": "pourquoi, basé sur les chiffres", "brief": "phrase à donner à un rédacteur pour écrire l'email complet"}].`;

  const raw = await callOpenRouter(
    "Tu es consultant marketing pour un restaurant indépendant. Tu proposes des idées de campagnes email concrètes, toujours justifiées par des données réelles, jamais de généralités.",
    prompt,
    { temperature: 0.6 }
  );
  return extractJson<MarketingSuggestion[]>(raw);
}

export async function sendCampaign(params: {
  subject: string;
  message: string;
  contactIds: string[] | undefined;
  userId: string;
}) {
  const { subject, message, contactIds, userId } = params;

  const recipients = await prisma.marketingContact.findMany({
    where: {
      subscribed: true,
      ...(contactIds && contactIds.length > 0 ? { id: { in: contactIds } } : {}),
    },
  });

  if (recipients.length === 0) {
    throw new Error("Aucun destinataire consentant à cibler (vérifiez le consentement marketing des contacts)");
  }

  const html = buildCampaignPreviewHtml(subject, message);

  const campaign = await prisma.marketingCampaign.create({
    data: {
      subject,
      bodyHtml: html,
      bodyText: message,
      status: MarketingCampaignStatus.BROUILLON,
      recipientCount: recipients.length,
      createdBy: userId,
    },
  });

  try {
    await importContactsToBrevoList(recipients.map((r) => ({ email: r.email, name: r.name ?? undefined })));
    const brevoCampaignId = await createAndSendBrevoCampaign({
      name: `Le Tandoor — ${subject} — ${new Date().toISOString().slice(0, 10)}`,
      subject,
      htmlContent: html,
    });

    return prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: { status: MarketingCampaignStatus.ENVOYEE, brevoCampaignId, sentAt: new Date() },
    });
  } catch (err) {
    const errorMessage = (err as Error).message;
    await prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: { status: MarketingCampaignStatus.ECHEC, errorMessage },
    });
    throw err;
  }
}

export async function listCampaigns() {
  return prisma.marketingCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { creator: { select: { name: true } } },
  });
}
