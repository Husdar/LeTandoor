import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { OrderItemStatus, OrderSource, OrderStatus } from "@le-tandoor/shared";
import { useActiveOrders } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import {
  formatMoney,
  formatTime,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_ACCENT,
  ORDER_TYPE_LABELS,
  ORDER_TYPE_TEXT,
} from "../../lib/format";
import StatusBadge from "../../components/StatusBadge";
import { IconBell, IconOrders } from "../../components/icons";
import { usePendingWebOrders } from "../../store/pendingWebOrders";
import type { Order } from "../../types";
import NewOrderPanel from "./NewOrderPanel";
import OrderDetailPanel from "./OrderDetailPanel";

const COLUMNS: { status: OrderStatus; title: string; next?: OrderItemStatus; actionLabel?: string }[] = [
  { status: OrderStatus.NOUVELLE, title: "À accepter", next: OrderItemStatus.EN_PREPARATION, actionLabel: "Accepter" },
  { status: OrderStatus.EN_PREPARATION, title: "En préparation", next: OrderItemStatus.PRETE, actionLabel: "Marquer prête" },
  { status: OrderStatus.PRETE, title: "Prête" },
];

export default function CommandesPage() {
  const { data: orders, isLoading } = useActiveOrders();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const freshSelectedOrder = selectedOrder ? orders?.find((o) => o.id === selectedOrder.id) ?? selectedOrder : null;
  const pendingWebOrderIds = usePendingWebOrders((s) => s.ids);

  // Commande la plus ancienne encore non acceptée (site web) : c'est elle qu'on montre en plein écran.
  const orderAwaitingAcceptance = useMemo(() => {
    if (!orders || pendingWebOrderIds.size === 0) return null;
    const candidates = orders.filter((o) => pendingWebOrderIds.has(o.id) && o.status === OrderStatus.NOUVELLE);
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => a.orderNumber - b.orderNumber)[0];
  }, [orders, pendingWebOrderIds]);

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

  function handleOpenOrder(order: Order) {
    usePendingWebOrders.getState().acknowledge(order.id);
    setSelectedOrder(order);
  }

  // La sonnerie ne doit s'arrêter QUE si le serveur confirme le changement de statut — sinon un
  // échec silencieux (réseau, session expirée) ferait disparaître le popup/la sonnerie sur cet
  // appareil sans que la commande soit réellement acceptée, alors qu'elle continuerait de sonner,
  // à raison, sur tous les autres appareils.
  function handleAccept(order: Order) {
    advanceOrder.mutate(
      { orderId: order.id, status: OrderItemStatus.EN_PREPARATION },
      { onSuccess: () => usePendingWebOrders.getState().acknowledge(order.id) }
    );
  }

  const sorted = [...(orders ?? [])].sort((a, b) => a.orderNumber - b.orderNumber);

  function renderOrderCard(order: Order, col: (typeof COLUMNS)[number]) {
    const tableLabel = order.orderTables[0]?.table?.name;
    return (
      <div
        key={order.id}
        role="button"
        tabIndex={0}
        onClick={() => handleOpenOrder(order)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleOpenOrder(order);
        }}
        className={clsx(
          "card-interactive w-full border-l-4 text-left tap-target",
          ORDER_TYPE_ACCENT[order.type] ?? "border-l-burgundy/10",
          pendingWebOrderIds.has(order.id) && "animate-pulse ring-2 ring-gold"
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className={clsx("font-semibold", ORDER_TYPE_TEXT[order.type] ?? "text-burgundy")}>
              {ORDER_TYPE_LABELS[order.type]}
              {tableLabel ? ` — ${tableLabel}` : ""}
            </p>
            {order.requestedFor ? (
              <p className="text-xs font-bold text-gold-dark">
                {order.type === "LIVRAISON" ? "Livraison" : "Retrait"} à {formatTime(order.requestedFor)}
              </p>
            ) : (
              <p className="text-xs text-burgundy/50">{formatTime(order.createdAt)}</p>
            )}
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
        {col.next && (
          <button
            type="button"
            disabled={advanceOrder.isPending}
            className="btn-gold mt-3 w-full !py-2 text-sm"
            onClick={(e) => {
              e.stopPropagation();
              if (col.status === OrderStatus.NOUVELLE) {
                handleAccept(order);
              } else {
                advanceOrder.mutate({ orderId: order.id, status: col.next! });
              }
            }}
          >
            {col.actionLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 sm:h-full sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-burgundy">Commandes en cours</h1>
          {orders && orders.length > 0 && (
            <p className="mt-0.5 text-sm text-burgundy/50">
              {orders.length} commande{orders.length > 1 ? "s" : ""} active{orders.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button className="btn-primary sm:w-auto" onClick={() => setCreating(true)}>
          + Nouvelle commande
        </button>
      </div>

      {actionError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <span>{actionError}</span>
          <button className="shrink-0 underline" onClick={() => setActionError(null)}>
            Fermer
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      {orders && orders.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:flex-1 sm:grid-cols-3 sm:overflow-hidden">
          {COLUMNS.map((col) => {
            const columnOrders = sorted.filter((order) => order.status === col.status);
            return (
              <div key={col.status} className="flex flex-col overflow-hidden rounded-2xl bg-white/60">
                <h2 className="border-b border-burgundy/10 px-4 py-3 font-display text-lg font-semibold text-burgundy">
                  {col.title} <span className="text-sm text-burgundy/40">({columnOrders.length})</span>
                </h2>
                <div className="flex-1 space-y-3 overflow-auto p-3">
                  {columnOrders.length === 0 && <p className="text-sm text-burgundy/40">Aucune commande</p>}
                  {columnOrders.map((order) => renderOrderCard(order, col))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && <NewOrderPanel onClose={() => setCreating(false)} />}
      {freshSelectedOrder && (
        <OrderDetailPanel order={freshSelectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      {orderAwaitingAcceptance && (
        <NewOrderAcceptPopup
          order={orderAwaitingAcceptance}
          isPending={advanceOrder.isPending}
          onAccept={() => handleAccept(orderAwaitingAcceptance)}
          onView={() => handleOpenOrder(orderAwaitingAcceptance)}
        />
      )}
    </div>
  );
}

function NewOrderAcceptPopup({
  order,
  onAccept,
  onView,
  isPending,
}: {
  order: Order;
  onAccept: () => void;
  onView: () => void;
  isPending: boolean;
}) {
  const tableLabel = order.orderTables[0]?.table?.name;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-burgundy/85 p-4 backdrop-blur-sm">
      <div className="modal-panel w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 text-gold-dark">
          <IconBell className="h-8 w-8" />
        </div>
        <p className="font-display text-2xl font-bold text-burgundy">Nouvelle commande !</p>
        <p className="mt-1 text-burgundy/60">
          {ORDER_TYPE_LABELS[order.type]}
          {tableLabel ? ` — ${tableLabel}` : ""}
        </p>
        <p className="mt-4 text-3xl font-bold text-gold-dark">{formatMoney(order.total)}</p>
        <p className="mt-1 text-sm text-burgundy/50">
          {order.items.length} article{order.items.length > 1 ? "s" : ""}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button className="btn-outline sm:flex-1" onClick={onView}>
            Voir le détail
          </button>
          <button className="btn-gold sm:flex-1" disabled={isPending} onClick={onAccept}>
            {isPending ? "…" : "Accepter"}
          </button>
        </div>
      </div>
    </div>
  );
}
