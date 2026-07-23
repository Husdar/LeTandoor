import { OrderStatus, OrderItemStatus, OrderType } from "@le-tandoor/shared";
import { prisma } from "../../db.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // lundi = 0
  return addDays(x, -day);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

async function revenueBetween(start: Date, end: Date) {
  const result = await prisma.order.aggregate({
    where: { status: OrderStatus.TERMINEE, closedAt: { gte: start, lt: end } },
    _sum: { total: true },
    _count: true,
  });
  return { revenue: round2(Number(result._sum.total ?? 0)), count: result._count };
}

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = startOfWeek(now);
  const lastWeekStart = addDays(weekStart, -7);
  const monthStart = startOfMonth(now);
  const lastMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const yearStart = startOfYear(now);
  const lastYearStart = new Date(yearStart.getFullYear() - 1, 0, 1);

  const [today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth, thisYear, lastYear] = await Promise.all([
    revenueBetween(todayStart, addDays(todayStart, 1)),
    revenueBetween(yesterdayStart, todayStart),
    revenueBetween(weekStart, addDays(weekStart, 7)),
    revenueBetween(lastWeekStart, weekStart),
    revenueBetween(monthStart, new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)),
    revenueBetween(lastMonthStart, monthStart),
    revenueBetween(yearStart, new Date(yearStart.getFullYear() + 1, 0, 1)),
    revenueBetween(lastYearStart, yearStart),
  ]);

  const averageBasket = thisMonth.count > 0 ? round2(thisMonth.revenue / thisMonth.count) : 0;

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
    dailySeries.push({ date: dayStart.toISOString().slice(0, 10), revenue, count });
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
