import { useState } from "react";
import clsx from "clsx";
import { OrderSource } from "@le-tandoor/shared";
import { useActiveOrders } from "../../hooks/queries";
import { formatMoney, formatTime, ORDER_STATUS_ACCENT, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from "../../lib/format";
import StatusBadge from "../../components/StatusBadge";
import { IconBell, IconOrders } from "../../components/icons";
import { usePendingWebOrders } from "../../store/pendingWebOrders";
import type { Order } from "../../types";
import NewOrderPanel from "./NewOrderPanel";
import OrderDetailPanel from "./OrderDetailPanel";

export default function CommandesPage() {
  const { data: orders, isLoading } = useActiveOrders();
  const [creating, setCreating] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const freshSelectedOrder = selectedOrder ? orders?.find((o) => o.id === selectedOrder.id) ?? selectedOrder : null;
  const pendingWebOrderIds = usePendingWebOrders((s) => s.ids);

  function handleOpenOrder(order: Order) {
    usePendingWebOrders.getState().acknowledge(order.id);
    setSelectedOrder(order);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-burgundy">Commandes en cours</h1>
          {orders && orders.length > 0 && (
            <p className="mt-0.5 text-sm text-burgundy/50">
              {orders.length} commande{orders.length > 1 ? "s" : ""} active{orders.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + Nouvelle commande
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-32 animate-pulse bg-burgundy/5" />
          ))}
        </div>
      )}

      {orders && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-burgundy/15 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-burgundy/5 text-burgundy/30">
            <IconOrders className="h-7 w-7" />
          </span>
          <p className="mt-3 text-burgundy/50">Aucune commande active pour le moment.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orders?.map((order, i) => {
          const tableLabel = order.orderTables[0]?.table?.name;
          return (
            <button
              key={order.id}
              onClick={() => handleOpenOrder(order)}
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
              className={clsx(
                "card-interactive list-item-in border-l-4 text-left tap-target",
                ORDER_STATUS_ACCENT[order.status] ?? "border-l-burgundy/10",
                pendingWebOrderIds.has(order.id) && "animate-pulse ring-2 ring-gold"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-burgundy">
                    {ORDER_TYPE_LABELS[order.type]}
                    {tableLabel ? ` — ${tableLabel}` : ""}
                  </p>
                  <p className="text-xs text-burgundy/50">{formatTime(order.createdAt)}</p>
                  {order.source === OrderSource.SITE_WEB && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                      {pendingWebOrderIds.has(order.id) && <IconBell className="h-3 w-3" />}
                      Site web
                    </span>
                  )}
                </div>
                <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-burgundy/60">
                  {order.items.length} article{order.items.length > 1 ? "s" : ""}
                </span>
                <span className="font-semibold text-gold-dark">{formatMoney(order.total)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {creating && <NewOrderPanel onClose={() => setCreating(false)} />}
      {freshSelectedOrder && (
        <OrderDetailPanel order={freshSelectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}
