import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { getDashboardStats, type DashboardStats } from "../analytics/service.js";

function buildPrompt(stats: DashboardStats): string {
  const channelLines = Object.entries(stats.channelSplit)
    .map(([type, d]) => `- ${type} : ${d.count} commandes, ${d.revenue}€`)
    .join("\n");
  const topLines = stats.topItems.map((i) => `- ${i.name} : ${i.quantity} vendus, ${i.revenue}€`).join("\n") || "(aucune donnée)";
  const bottomLines = stats.bottomItems.map((i) => `- ${i.name} : ${i.quantity} vendus`).join("\n") || "(aucune donnée)";
  const peakLines = stats.peakHours.map((h) => `${h.hour}h (${h.count} commandes)`).join(", ") || "(pas assez de données)";

  return `Voici les données réelles du restaurant "Le Tandoor" (spécialités indiennes et pakistanaises, Lorient).

CHIFFRE D'AFFAIRES
- Aujourd'hui : ${stats.revenue.today}€ (hier : ${stats.revenue.yesterday}€)
- Cette semaine : ${stats.revenue.thisWeek}€ (semaine dernière : ${stats.revenue.lastWeek}€)
- Ce mois : ${stats.revenue.thisMonth}€ (mois dernier : ${stats.revenue.lastMonth}€)
- Cette année : ${stats.revenue.thisYear}€ (année dernière : ${stats.revenue.lastYear}€)

COMMANDES
- Nombre de commandes ce mois : ${stats.orderCounts.thisMonth}
- Panier moyen (ce mois) : ${stats.averageBasket}€
- Heures les plus actives (30 derniers jours) : ${peakLines}

RÉPARTITION PAR CANAL (30 derniers jours)
${channelLines}

PLATS LES PLUS VENDUS (30 derniers jours)
${topLines}

PLATS LES MOINS VENDUS (30 derniers jours)
${bottomLines}

PERTES ET REMISES (30 derniers jours)
- Commandes annulées : ${stats.cancellations.count}
- Articles annulés (perte estimée) : ${stats.cancellations.itemsLoss}€
- Total des remises accordées : ${stats.discounts}€

Analyse ces données et donne 4 à 6 conseils concrets et directement actionnables pour améliorer les ventes, réduire les pertes, et mieux organiser le personnel et les horaires. Compare aux périodes précédentes quand c'est pertinent (ex: hausse/baisse). Si une donnée manque ou est à zéro, dis-le simplement plutôt que d'inventer. Réponds uniquement en français, de façon directe et pratique, sans généralités vagues.`;
}

export async function generateInsight() {
  if (!env.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY non configurée sur le serveur");
  }

  const stats = await getDashboardStats();
  const prompt = buildPrompt(stats);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openRouterModel,
      messages: [
        {
          role: "system",
          content:
            "Tu es un consultant en gestion de restaurant. Tu analyses des données réelles de vente et donnes des conseils concrets, courts et actionnables en français, toujours basés sur les chiffres fournis, jamais de généralités vagues.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Erreur API IA (${response.status}) : ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Réponse vide de l'IA");
  }

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - 30);

  const insight = await prisma.aiInsight.create({
    data: {
      periodStart,
      periodEnd: new Date(),
      content,
      dataSnapshot: stats as unknown as Prisma.InputJsonValue,
    },
  });

  return insight;
}

export async function listInsights() {
  return prisma.aiInsight.findMany({ orderBy: { generatedAt: "desc" }, take: 20 });
}
