import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { OrderItemStatus, OrderStatus } from "@le-tandoor/shared";
import { useActiveOrders } from "../../hooks/queries";
import { api } from "../../lib/api";
import { formatMoney, formatTime, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from "../../lib/format";
import { useT, type TranslationKey } from "../../lib/i18n";
import StatusBadge from "../../components/StatusBadge";
import type { Order } from "../../types";

const COLUMNS: { status: OrderStatus; titleKey: TranslationKey; next?: OrderItemStatus; actionKey?: TranslationKey }[] = [
  { status: OrderStatus.NOUVELLE, titleKey: "cuisine.new", next: OrderItemStatus.EN_PREPARATION, actionKey: "cuisine.start" },
  { status: OrderStatus.EN_PREPARATION, titleKey: "cuisine.preparing", next: OrderItemStatus.PRETE, actionKey: "cuisine.markReady" },
  { status: OrderStatus.PRETE, titleKey: "cuisine.ready" },
];

export default function CuisinePage() {
  const { data: orders } = useActiveOrders();
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const advanceOrder = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderItemStatus }) =>
      api.patch(`/orders/${orderId}/advance`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  function toggle(orderId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  const sorted = [...(orders ?? [])].sort((a, b) => a.orderNumber - b.orderNumber);

  function renderOrderCard(order: Order, col: (typeof COLUMNS)[number]) {
    const isOpen = expanded.has(order.id);
    const tableLabel = order.orderTables[0]?.table?.name;
    return (
      <div key={order.id} className="card">
        <button className="w-full text-left" onClick={() => toggle(order.id)}>
          <div className="flex items-center justify-between">
            <p className={clsx("font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
              {t("cuisine.orderLabel")}
              {order.orderNumber}
            </p>
            <StatusBadge
              status={order.status}
              label={urdu ? t(`orderStatus.${order.status}` as TranslationKey) : ORDER_STATUS_LABELS[order.status]}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-burgundy/60">
            <span>
              {urdu ? t(`orderType.${order.type}` as TranslationKey) : ORDER_TYPE_LABELS[order.type]}
              {tableLabel ? ` · ${tableLabel}` : ""} · {formatTime(order.createdAt)}
            </span>
            <span className="font-semibold text-gold-dark">{formatMoney(order.total)}</span>
          </div>
        </button>

        {isOpen && (
          <div className="mt-3 space-y-2 border-t border-burgundy/10 pt-3">
            {order.items
              .filter((item) => item.status !== OrderItemStatus.ANNULE)
              .map((item) => (
                <div key={item.id} className="rounded-lg bg-cream/70 p-2">
                  <p className="font-medium text-burgundy">
                    {item.quantity}× {item.nameSnapshot}
                  </p>
                  {item.options.length > 0 && (
                    <p className="text-sm text-burgundy/60">{item.options.map((o) => o.name).join(", ")}</p>
                  )}
                  {item.notes && <p className="text-sm italic text-burgundy/50">{item.notes}</p>}
                </div>
              ))}
          </div>
        )}

        {col.next && (
          <button
            className={clsx("btn-gold mt-3 w-full !py-2 text-sm", urdu && "font-urdu text-base")}
            disabled={advanceOrder.isPending}
            onClick={() => advanceOrder.mutate({ orderId: order.id, status: col.next! })}
          >
            {col.actionKey ? t(col.actionKey) : null}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:h-full sm:grid-cols-3 sm:p-6">
      {COLUMNS.map((col) => {
        const columnOrders = sorted.filter((order) => order.status === col.status);
        return (
          <div key={col.status} className="flex flex-col overflow-hidden rounded-2xl bg-white/60">
            <h2
              className={clsx(
                "border-b border-burgundy/10 px-4 py-3 font-display text-lg font-semibold text-burgundy",
                urdu && "font-urdu text-xl"
              )}
            >
              {t(col.titleKey)} <span className="text-sm text-burgundy/40">({columnOrders.length})</span>
            </h2>
            <div className="flex-1 space-y-3 overflow-auto p-3">
              {columnOrders.length === 0 && <p className="text-sm text-burgundy/40">{t("cuisine.empty")}</p>}
              {columnOrders.map((order) => renderOrderCard(order, col))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
