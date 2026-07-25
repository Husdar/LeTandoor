import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { OrderItemStatus, OrderStatus } from "@le-tandoor/shared";
import { useActiveOrders } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import {
  displayOrderRef,
  formatMoney,
  formatTime,
  ORDER_ITEM_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_ACCENT,
  ORDER_TYPE_LABELS,
  ORDER_TYPE_TEXT,
} from "../../lib/format";
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
  const [actionError, setActionError] = useState<string | null>(null);

  const advanceOrder = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderItemStatus }) =>
      api.patch(`/orders/${orderId}/advance`, { status }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Échec de la mise à jour de la commande — vérifiez la connexion et réessayez."
      );
    },
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
      <div key={order.id} className={clsx("card border-l-4", ORDER_TYPE_ACCENT[order.type] ?? "border-l-burgundy/10")}>
        <button className="w-full text-left" onClick={() => toggle(order.id)}>
          <div className="flex items-center justify-between">
            <p className={clsx("font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
              {t("cuisine.orderLabel")}
              {displayOrderRef(order)}
            </p>
            <StatusBadge
              status={order.status}
              label={urdu ? t(`orderStatus.${order.status}` as TranslationKey) : ORDER_STATUS_LABELS[order.status]}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>
              <span className={clsx("font-semibold", ORDER_TYPE_TEXT[order.type] ?? "text-burgundy")}>
                {urdu ? t(`orderType.${order.type}` as TranslationKey) : ORDER_TYPE_LABELS[order.type]}
              </span>
              <span className="text-burgundy/60">{tableLabel ? ` · ${tableLabel}` : ""}</span>
              {!order.requestedFor && <span className="text-burgundy/60"> · {formatTime(order.createdAt)}</span>}
            </span>
            <span className="font-semibold text-gold-dark">{formatMoney(order.total)}</span>
          </div>
          {order.requestedFor && (
            <p className={clsx("mt-1 text-sm font-bold text-gold-dark", urdu && "font-urdu text-base")}>
              {order.type === "LIVRAISON" ? "Livraison" : "Retrait"} à {formatTime(order.requestedFor)}
            </p>
          )}
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
    <div className="flex flex-col p-4 sm:h-full sm:p-6">
      {actionError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <span>{actionError}</span>
          <button className="shrink-0 underline" onClick={() => setActionError(null)}>
            Fermer
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:flex-1 sm:grid-cols-3 sm:overflow-hidden">
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
    </div>
  );
}
