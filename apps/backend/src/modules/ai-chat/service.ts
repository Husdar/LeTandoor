import { OrderStatus, ReservationStatus } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { getDashboardStats } from "../analytics/service.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

async function buildContextSnapshot() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const dayAfterTomorrowStart = addDays(todayStart, 2);
  const weekEnd = addDays(todayStart, 7);

  const [ordersToday, ordersTomorrowScheduled, activeOrders, reservationsToday, reservationsTomorrow, reservationsWeek, stats] =
    await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart, lt: tomorrowStart } } }),
      prisma.order.count({
        where: { requestedFor: { gte: tomorrowStart, lt: dayAfterTomorrowStart } },
      }),
      prisma.order.findMany({
        where: { status: { notIn: [OrderStatus.TERMINEE, OrderStatus.ANNULEE] } },
        select: { type: true, status: true, total: true },
      }),
      prisma.reservation.findMany({
        where: { dateTime: { gte: todayStart, lt: tomorrowStart }, status: { not: ReservationStatus.ANNULEE } },
        orderBy: { dateTime: "asc" },
        select: { customerName: true, dateTime: true, partySize: true, status: true },
      }),
      prisma.reservation.findMany({
        where: { dateTime: { gte: tomorrowStart, lt: dayAfterTomorrowStart }, status: { not: ReservationStatus.ANNULEE } },
        orderBy: { dateTime: "asc" },
        select: { customerName: true, dateTime: true, partySize: true, status: true },
      }),
      prisma.reservation.count({
        where: { dateTime: { gte: todayStart, lt: weekEnd }, status: { not: ReservationStatus.ANNULEE } },
      }),
      getDashboardStats(),
    ]);

  const fmtTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const fmtReservations = (list: typeof reservationsToday) =>
    list.length === 0
      ? "(aucune)"
      : list.map((r) => `${fmtTime(r.dateTime)} - ${r.customerName} (${r.partySize ?? "?"} pers., ${r.status})`).join("\n");

  return `Date et heure actuelles : ${now.toLocaleString("fr-FR")}

COMMANDES
- Commandes créées aujourd'hui : ${ordersToday}
- Commandes actives en ce moment (non terminées/annulées) : ${activeOrders.length}
- Commandes du site web avec un horaire de retrait/livraison prévu demain : ${ordersTomorrowScheduled}

RÉSERVATIONS
- Aujourd'hui (${reservationsToday.length} au total) :
${fmtReservations(reservationsToday)}
- Demain (${reservationsTomorrow.length} au total) :
${fmtReservations(reservationsTomorrow)}
- Cette semaine (total) : ${reservationsWeek}

PERFORMANCE (résumé)
- CA aujourd'hui : ${stats.revenue.today}€ (hier : ${stats.revenue.yesterday}€)
- CA ce mois : ${stats.revenue.thisMonth}€
- Panier moyen (ce mois) : ${stats.averageBasket}€
- Commandes ce mois : ${stats.orderCounts.thisMonth}
- Plats les plus vendus (30j) : ${stats.topItems.map((i) => `${i.name} (${i.quantity})`).join(", ") || "(aucune donnée)"}
- Répartition par canal (30j) : ${
    Object.entries(stats.channelSplit)
      .map(([type, d]) => `${type}: ${d.count}`)
      .join(", ") || "(aucune donnée)"
  }`;
}

const SYSTEM_PROMPT = `Tu es l'assistant du restaurant "Le Tandoor" (spécialités indiennes et pakistanaises, Lorient). Tu réponds en français, de façon brève et directe, aux questions du personnel sur l'activité du restaurant (commandes, réservations, ventes, plats populaires, etc.).

Règles strictes :
- Tu réponds UNIQUEMENT à partir des données réelles fournies ci-dessous (extraites de la vraie base de données au moment de la question). Ne jamais inventer de chiffres.
- Si la donnée demandée n'est pas dans le contexte fourni ou est insuffisante, dis-le honnêtement plutôt que d'inventer une réponse.
- Reste concis (2-4 phrases sauf si une liste est nécessaire).
- Tu ne donnes pas de conseils de gestion non sollicités ici (ce n'est pas ton rôle, contrairement à la page Conseils) — tu réponds à la question posée.`;

export async function askAssistant(messages: ChatMessage[]): Promise<string> {
  if (!env.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY non configurée sur le serveur");
  }
  if (messages.length === 0) {
    throw new Error("Message vide");
  }

  const context = await buildContextSnapshot();
  const recentMessages = messages.slice(-10);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openRouterModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `Données réelles actuelles :\n\n${context}` },
        ...recentMessages,
      ],
      temperature: 0.3,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Erreur API IA (${response.status}) : ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Réponse vide de l'IA");
  }
  return content;
}
