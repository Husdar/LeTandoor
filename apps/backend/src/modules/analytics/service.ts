import { OrderStatus, OrderItemStatus, OrderType } from "@le-tandoor/shared";
import { prisma } from "../../db.js";

const RESTAURANT_TIMEZONE = "Europe/Paris";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Décalage (en minutes) entre UTC et `timeZone` à l'instant `date`. Le serveur de production
 * tourne en UTC (Render) — sans ce calcul, les bornes "aujourd'hui / cette semaine / ce mois"
 * seraient décalées de 1 à 2h par rapport à la vraie journée du restaurant à Paris.
 */
function timezoneOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUTC - date.getTime()) / 60_000;
}

function parisDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Minuit (00:00) à Paris pour la journée calendaire de `d`, en instant UTC réel. */
function startOfDay(d: Date): Date {
  const { year, month, day } = parisDateParts(d);
  const offsetMinutes = timezoneOffsetMinutes(RESTAURANT_TIMEZONE, d);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60_000);
}

/** Date "calendaire" pure (minuit UTC, sans décalage) — pour comparer une colonne SQL DATE. */
function parisDateOnly(d: Date): Date {
  const { year, month, day } = parisDateParts(d);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function startOfWeek(d: Date): Date {
  const { year, month, day } = parisDateParts(d);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay(); // 0=dim...6=sam
  const diff = (weekday + 6) % 7; // lundi = 0
  return startOfDay(new Date(Date.UTC(year, month - 1, day - diff, 12)));
}

async function manualRevenueBetween(startDateOnly: Date, endDateOnly: Date): Promise<number> {
  const result = await prisma.manualRevenueEntry.aggregate({
    where: { date: { gte: startDateOnly, lt: endDateOnly } },
    _sum: { amount: true },
  });
  return round2(Number(result._sum.amount ?? 0));
}

async function revenueBetween(start: Date, end: Date) {
  const [orderResult, manual] = await Promise.all([
    prisma.order.aggregate({
      where: { status: OrderStatus.TERMINEE, closedAt: { gte: start, lt: end } },
      _sum: { total: true },
      _count: true,
    }),
    manualRevenueBetween(parisDateOnly(start), parisDateOnly(end)),
  ]);
  const orderRevenue = round2(Number(orderResult._sum.total ?? 0));
  return { revenue: round2(orderRevenue + manual), orderRevenue, manualRevenue: manual, count: orderResult._count };
}

/** Construit une date "sûre" (midi UTC, jamais ambiguë) pour le 1er d'un mois calendaire donné. */
function monthRef(year: number, monthIndex0: number): Date {
  // monthIndex0 peut être hors de [0,11] (ex: -1, 12) — Date.UTC gère le débordement correctement.
  return new Date(Date.UTC(year, monthIndex0, 1, 12));
}

export async function getDashboardStats() {
  const now = new Date();
  const { year, month } = parisDateParts(now); // month est 1-indexé ici
  const monthIndex0 = month - 1;

  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = startOfWeek(now);
  const lastWeekStart = addDays(weekStart, -7);
  const monthStart = startOfDay(monthRef(year, monthIndex0));
  const nextMonthStart = startOfDay(monthRef(year, monthIndex0 + 1));
  const lastMonthStart = startOfDay(monthRef(year, monthIndex0 - 1));
  const yearStart = startOfDay(new Date(Date.UTC(year, 0, 1, 12)));
  const nextYearStart = startOfDay(new Date(Date.UTC(year + 1, 0, 1, 12)));
  const lastYearStart = startOfDay(new Date(Date.UTC(year - 1, 0, 1, 12)));

  const [today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth, thisYear, lastYear] = await Promise.all([
    revenueBetween(todayStart, addDays(todayStart, 1)),
    revenueBetween(yesterdayStart, todayStart),
    revenueBetween(weekStart, addDays(weekStart, 7)),
    revenueBetween(lastWeekStart, weekStart),
    revenueBetween(monthStart, nextMonthStart),
    revenueBetween(lastMonthStart, monthStart),
    revenueBetween(yearStart, nextYearStart),
    revenueBetween(lastYearStart, yearStart),
  ]);

  const averageBasket = thisMonth.count > 0 ? round2(thisMonth.orderRevenue / thisMonth.count) : 0;

  const windowStart = addDays(todayStart, -30);
  const recentOrders = await prisma.order.findMany({
    where: { createdAt: { gte: windowStart } },
    include: { items: true },
  });

  const closedRecent = recentOrders.filter((o) => o.status === OrderStatus.TERMINEE);

  const hourCounts = new Array(24).fill(0);
  for (const o of recentOrders) {
    hourCounts[new Date(o.createdAt).getHours()]++;
  }
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const salesByItem = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const o of closedRecent) {
    for (const item of o.items) {
      if (item.status === OrderItemStatus.ANNULE) continue;
      const key = item.menuItemId ?? item.nameSnapshot;
      const entry = salesByItem.get(key) ?? { name: item.nameSnapshot, quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += Number(item.unitPriceSnapshot) * item.quantity;
      salesByItem.set(key, entry);
    }
  }
  const itemStats = Array.from(salesByItem.values()).map((i) => ({ ...i, revenue: round2(i.revenue) }));
  const topItems = [...itemStats].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const bottomItems = [...itemStats].sort((a, b) => a.quantity - b.quantity).slice(0, 5);

  const channelSplit: Record<OrderType, { count: number; revenue: number }> = {
    [OrderType.SUR_PLACE]: { count: 0, revenue: 0 },
    [OrderType.EMPORTER]: { count: 0, revenue: 0 },
    [OrderType.LIVRAISON]: { count: 0, revenue: 0 },
  };
  for (const o of closedRecent) {
    channelSplit[o.type].count++;
    channelSplit[o.type].revenue += Number(o.total);
  }
  for (const key of Object.keys(channelSplit) as OrderType[]) {
    channelSplit[key].revenue = round2(channelSplit[key].revenue);
  }

  const cancelledOrders = recentOrders.filter((o) => o.status === OrderStatus.ANNULEE);
  const cancelledItemsLoss = recentOrders
    .flatMap((o) => o.items)
    .filter((i) => i.status === OrderItemStatus.ANNULE)
    .reduce((sum, i) => sum + Number(i.unitPriceSnapshot) * i.quantity, 0);
  const totalDiscounts = closedRecent.reduce((sum, o) => sum + Number(o.discountAmount), 0);

  const dailySeries: { date: string; revenue: number; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = addDays(todayStart, -i);
    const dayEnd = addDays(dayStart, 1);
    const { revenue, count } = await revenueBetween(dayStart, dayEnd);
    dailySeries.push({ date: parisDateOnly(dayStart).toISOString().slice(0, 10), revenue, count });
  }

  return {
    revenue: {
      today: today.revenue,
      yesterday: yesterday.revenue,
      thisWeek: thisWeek.revenue,
      lastWeek: lastWeek.revenue,
      thisMonth: thisMonth.revenue,
      lastMonth: lastMonth.revenue,
      thisYear: thisYear.revenue,
      lastYear: lastYear.revenue,
    },
    manualRevenueToday: today.manualRevenue,
    orderCounts: {
      today: today.count,
      thisWeek: thisWeek.count,
      thisMonth: thisMonth.count,
      thisYear: thisYear.count,
    },
    averageBasket,
    peakHours,
    topItems,
    bottomItems,
    channelSplit,
    cancellations: { count: cancelledOrders.length, itemsLoss: round2(cancelledItemsLoss) },
    discounts: round2(totalDiscounts),
    dailySeries,
    generatedAt: now.toISOString(),
  };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
