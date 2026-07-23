import { useState } from "react";
import clsx from "clsx";
import { OrderSource } from "@le-tandoor/shared";
import { useActiveOrders } from "../../hooks/queries";
import { formatMoney, formatTime, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from "../../lib/format";
import { useT, type TranslationKey } from "../../lib/i18n";
import StatusBadge from "../../components/StatusBadge";
import type { Order } from "../../types";
import CloseOrderPanel from "./CloseOrderPanel";

export default function CaissePage() {
  const { data: orders, isLoading } = useActiveOrders();
  const [selected, setSelected] = useState<Order | null>(null);
  const { t, lang } = useT();

  const fresh = selected ? orders?.find((o) => o.id === selected.id) ?? null : null;
  const urdu = lang === "ur";

  return (
    <div className="p-6">
      <h1 className={clsx("mb-4 font-display text-2xl font-semibold text-burgundy", urdu && "font-urdu")}>
        {t("caisse.title")}
      </h1>

      {isLoading && <p className="text-burgundy/60">{t("caisse.loading")}</p>}
      {orders && orders.length === 0 && <p className="text-burgundy/50">{t("caisse.empty")}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orders?.map((order) => {
          const tableLabel = order.orderTables[0]?.table?.name;
          return (
            <div key={order.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-burgundy">
                    {urdu ? t(`orderType.${order.type}` as TranslationKey) : ORDER_TYPE_LABELS[order.type]}
                    {tableLabel ? ` — ${tableLabel}` : ""}
                  </p>
                  <p className="text-xs text-burgundy/50">{formatTime(order.createdAt)}</p>
                  {order.source === OrderSource.SITE_WEB && (
                    <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                      {t("caisse.webBadge")}
                    </span>
                  )}
                </div>
                <StatusBadge
                  status={order.status}
                  label={urdu ? t(`orderStatus.${order.status}` as TranslationKey) : ORDER_STATUS_LABELS[order.status]}
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-burgundy/60">
                  {order.items.length} {t("caisse.items")}
                </span>
                <span className="font-semibold text-gold-dark">{formatMoney(order.total)}</span>
              </div>
              <button
                className={clsx("btn-primary mt-3 w-full", urdu && "font-urdu text-base")}
                onClick={() => setSelected(order)}
              >
                {t("caisse.pay")}
              </button>
            </div>
          );
        })}
      </div>

      {fresh && <CloseOrderPanel order={fresh} onClose={() => setSelected(null)} />}
    </div>
  );
}
