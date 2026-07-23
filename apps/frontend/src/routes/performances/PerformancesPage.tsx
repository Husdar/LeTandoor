import clsx from "clsx";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboardStats } from "../../hooks/queries";
import { useT } from "../../lib/i18n";
import { formatMoney } from "../../lib/format";

const CHANNEL_LABELS: Record<string, string> = {
  SUR_PLACE: "Sur place",
  EMPORTER: "À emporter",
  LIVRAISON: "Livraison",
};

function variation(current: number, previous: number): { pct: number | null; positive: boolean } {
  if (previous === 0) return { pct: current > 0 ? 100 : null, positive: current >= 0 };
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.round(pct), positive: pct >= 0 };
}

function KpiCard({
  label,
  value,
  previous,
  urdu,
}: {
  label: string;
  value: number;
  previous?: number;
  urdu: boolean;
}) {
  const v = previous !== undefined ? variation(value, previous) : null;
  return (
    <div className="card">
      <p className={clsx("text-sm text-burgundy/60", urdu && "font-urdu text-base")}>{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-burgundy">{formatMoney(value)}</p>
      {v && v.pct !== null && (
        <p className={clsx("mt-1 text-xs font-medium", v.positive ? "text-green-700" : "text-red-600")}>
          {v.positive ? "▲" : "▼"} {Math.abs(v.pct)}%
        </p>
      )}
    </div>
  );
}

export default function PerformancesPage() {
  const { data: stats, isLoading } = useDashboardStats();
  const { t, lang } = useT();
  const urdu = lang === "ur";

  if (isLoading || !stats) {
    return (
      <div className="p-6">
        <p className="text-burgundy/60">…</p>
      </div>
    );
  }

  const chartData = stats.dailySeries.map((d) => ({
    date: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    revenue: d.revenue,
  }));

  return (
    <div className="p-6">
      <h1 className={clsx("mb-4 font-display text-2xl font-semibold text-burgundy", urdu && "font-urdu")}>
        {t("performances.title")}
      </h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label={t("performances.today")} value={stats.revenue.today} previous={stats.revenue.yesterday} urdu={urdu} />
        <KpiCard label={t("performances.week")} value={stats.revenue.thisWeek} previous={stats.revenue.lastWeek} urdu={urdu} />
        <KpiCard label={t("performances.month")} value={stats.revenue.thisMonth} previous={stats.revenue.lastMonth} urdu={urdu} />
        <KpiCard label={t("performances.year")} value={stats.revenue.thisYear} previous={stats.revenue.lastYear} urdu={urdu} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className={clsx("text-sm text-burgundy/60", urdu && "font-urdu text-base")}>{t("performances.avgBasket")}</p>
          <p className="mt-1 font-display text-xl font-semibold text-burgundy">{formatMoney(stats.averageBasket)}</p>
        </div>
        <div className="card">
          <p className={clsx("text-sm text-burgundy/60", urdu && "font-urdu text-base")}>{t("performances.ordersMonth")}</p>
          <p className="mt-1 font-display text-xl font-semibold text-burgundy">{stats.orderCounts.thisMonth}</p>
        </div>
        <div className="card">
          <p className={clsx("text-sm text-burgundy/60", urdu && "font-urdu text-base")}>{t("performances.discounts")}</p>
          <p className="mt-1 font-display text-xl font-semibold text-burgundy">{formatMoney(stats.discounts)}</p>
        </div>
      </div>

      <div className="card mt-4">
        <h2 className={clsx("mb-3 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
          {t("performances.dailyRevenue")}
        </h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#6E142320" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6E1423" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6E1423" />
              <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
              <Bar dataKey="revenue" fill="#C9A227" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className={clsx("mb-3 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
            {t("performances.topItems")}
          </h2>
          {stats.topItems.length === 0 ? (
            <p className="text-sm text-burgundy/50">{t("performances.noData")}</p>
          ) : (
            <ul className="space-y-2">
              {stats.topItems.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-burgundy">{item.name}</span>
                  <span className="text-burgundy/60">
                    {item.quantity} {t("performances.sold")} · {formatMoney(item.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className={clsx("mb-3 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
            {t("performances.bottomItems")}
          </h2>
          {stats.bottomItems.length === 0 ? (
            <p className="text-sm text-burgundy/50">{t("performances.noData")}</p>
          ) : (
            <ul className="space-y-2">
              {stats.bottomItems.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-burgundy">{item.name}</span>
                  <span className="text-burgundy/60">
                    {item.quantity} {t("performances.sold")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className={clsx("mb-3 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
            {t("performances.channelSplit")}
          </h2>
          <ul className="space-y-2">
            {Object.entries(stats.channelSplit).map(([type, d]) => (
              <li key={type} className="flex items-center justify-between text-sm">
                <span className="text-burgundy">{CHANNEL_LABELS[type] ?? type}</span>
                <span className="text-burgundy/60">
                  {d.count} {t("performances.orders")} · {formatMoney(d.revenue)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className={clsx("mb-3 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
            {t("performances.peakHours")}
          </h2>
          {stats.peakHours.length === 0 ? (
            <p className="text-sm text-burgundy/50">{t("performances.noData")}</p>
          ) : (
            <ul className="space-y-2">
              {stats.peakHours.map((h) => (
                <li key={h.hour} className="flex items-center justify-between text-sm">
                  <span className="text-burgundy">{h.hour}h</span>
                  <span className="text-burgundy/60">
                    {h.count} {t("performances.orders")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-4">
        <h2 className={clsx("font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
          {t("performances.cancellations")}
        </h2>
        <p className="mt-2 text-sm text-burgundy/70">
          {stats.cancellations.count} — {formatMoney(stats.cancellations.itemsLoss)}
        </p>
      </div>
    </div>
  );
}
