import { InsightKind, type Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { callOpenRouter } from "../../ai/openrouter.js";
import { startOfParisDay } from "../../timezone.js";
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
  const stats = await getDashboardStats();
  const content = await callOpenRouter(
    "Tu es un consultant en gestion de restaurant. Tu analyses des données réelles de vente et donnes des conseils concrets, courts et actionnables en français, toujours basés sur les chiffres fournis, jamais de généralités vagues.",
    buildPrompt(stats)
  );

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - 30);

  return prisma.aiInsight.create({
    data: {
      kind: InsightKind.MANUEL,
      periodStart,
      periodEnd: new Date(),
      content,
      dataSnapshot: stats as unknown as Prisma.InputJsonValue,
    },
  });
}

function buildDailyPrompt(stats: DashboardStats): string {
  const topLines = stats.topItems.map((i) => `- ${i.name} : ${i.quantity} vendus`).join("\n") || "(aucune donnée)";

  return `Voici le bilan du jour pour le restaurant "Le Tandoor" (spécialités indiennes et pakistanaises, Lorient), à la clôture de la soirée.

CHIFFRE D'AFFAIRES
- Aujourd'hui : ${stats.revenue.today}€ (hier : ${stats.revenue.yesterday}€)
- Cette semaine : ${stats.revenue.thisWeek}€ (semaine dernière : ${stats.revenue.lastWeek}€)
- Nombre de commandes ce mois : ${stats.orderCounts.thisMonth}
- Panier moyen (ce mois) : ${stats.averageBasket}€

PLATS LES PLUS VENDUS (30 derniers jours, pour contexte)
${topLines}

ANNULATIONS DU JOUR (30 derniers jours, pour contexte)
- Commandes annulées : ${stats.cancellations.count}
- Perte estimée : ${stats.cancellations.itemsLoss}€

Rédige un bilan très court de la soirée : 2-3 phrases maximum sur la performance du jour (comparée à hier/la semaine dernière), puis 2 à 3 suggestions concrètes et courtes pour demain. Si une donnée manque ou est à zéro, dis-le simplement. Réponds uniquement en français, de façon directe, sans généralités vagues, format compact (pas de longues listes).`;
}

export async function generateDailyInsight() {
  const stats = await getDashboardStats();
  const content = await callOpenRouter(
    "Tu es un consultant en gestion de restaurant qui rédige un bilan de clôture très court, chaque soir, à partir de données réelles de vente. Direct, concret, jamais de généralités vagues.",
    buildDailyPrompt(stats)
  );

  const now = new Date();
  return prisma.aiInsight.create({
    data: {
      kind: InsightKind.QUOTIDIEN,
      periodStart: startOfParisDay(now),
      periodEnd: now,
      content,
      dataSnapshot: stats as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function hasDailyInsightToday(): Promise<boolean> {
  const count = await prisma.aiInsight.count({
    where: { kind: InsightKind.QUOTIDIEN, generatedAt: { gte: startOfParisDay(new Date()) } },
  });
  return count > 0;
}

export async function listInsights() {
  return prisma.aiInsight.findMany({ orderBy: { generatedAt: "desc" }, take: 20 });
}
