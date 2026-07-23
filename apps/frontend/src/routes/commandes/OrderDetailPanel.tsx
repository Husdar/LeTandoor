import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OrderItemStatus, OrderStatus, applyChannelPricing, type OrderItemInput } from "@le-tandoor/shared";
import { useMenu } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import { formatMoney, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from "../../lib/format";
import StatusBadge from "../../components/StatusBadge";
import type { Order, MenuItem } from "../../types";
import ItemOptionsModal, { type AddedLine } from "./ItemOptionsModal";
import TicketPreview from "./TicketPreview";

export default function OrderDetailPanel({ order, onClose }: { order: Order; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: menu } = useMenu();
  const [addingItem, setAddingItem] = useState(false);
  const [pickingItem, setPickingItem] = useState<MenuItem | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tableLabel = order.orderTables[0]?.table?.name;
  const closed = order.status === OrderStatus.TERMINEE || order.status === OrderStatus.ANNULEE;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["tables"] });
  }

  const addItem = useMutation({
    mutationFn: (input: OrderItemInput) => api.post(`/orders/${order.id}/items`, input),
    onSuccess: () => {
      invalidate();
      setPickingItem(null);
      setAddingItem(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const cancelItem = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) =>
      api.patch(`/orders/${order.id}/items/${itemId}/status`, { status: OrderItemStatus.ANNULE, reason }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const markItemServed = useMutation({
    mutationFn: (itemId: string) =>
      api.patch(`/orders/${order.id}/items/${itemId}/status`, { status: OrderItemStatus.SERVIE }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const markOrderServed = useMutation({
    mutationFn: () => api.patch(`/orders/${order.id}/status`, { status: OrderStatus.SERVIE }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const cancelOrder = useMutation({
    mutationFn: (reason: string) => api.patch(`/orders/${order.id}/status`, { status: OrderStatus.ANNULEE, reason }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const reprintTicket = useMutation({
    mutationFn: () => api.post(`/orders/${order.id}/print/CUISINE`),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur d'impression"),
  });

  function handleCancelItem(itemId: string) {
    const reason = window.prompt("Motif d'annulation de l'article ?");
    if (reason) cancelItem.mutate({ itemId, reason });
  }

  function handleCancelOrder() {
    const reason = window.prompt("Motif d'annulation de la commande ?");
    if (reason) cancelOrder.mutate(reason);
  }

  function handleAddItem(item: MenuItem) {
    if (item.options.length > 0) {
      setPickingItem(item);
    } else {
      addItem.mutate({ menuItemId: item.id, quantity: 1, selectedOptionIds: [] });
    }
  }

  function addFromModal(line: AddedLine) {
    addItem.mutate({
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      notes: line.notes || undefined,
      selectedOptionIds: line.selectedOptionIds,
    });
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-burgundy/10 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-burgundy">
              {ORDER_TYPE_LABELS[order.type]} {tableLabel ? `— ${tableLabel}` : ""}
            </h2>
            <p className="text-sm text-burgundy/60">
              {order.customerName ?? ""} {order.customerPhone ?? ""}
            </p>
            {order.customerEmail && <p className="text-sm text-burgundy/60">{order.customerEmail}</p>}
            {order.deliveryAddress && <p className="text-sm text-burgundy/60">{order.deliveryAddress}</p>}
            {order.requestedFor && (
              <p className="mt-1 text-sm font-semibold text-gold-dark">
                {order.type === "LIVRAISON" ? "Livraison souhaitée" : "Retrait souhaité"} à{" "}
                {new Date(order.requestedFor).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
        </header>

        <div className="flex-1 space-y-2 overflow-auto p-6">
          {order.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-burgundy/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-burgundy">
                    {item.quantity}× {item.nameSnapshot}
                  </p>
                  {item.options.length > 0 && (
                    <p className="text-xs text-burgundy/60">{item.options.map((o) => o.name).join(", ")}</p>
                  )}
                  {item.notes && <p className="text-xs italic text-burgundy/50">{item.notes}</p>}
                  {!item.menuItemId && (
                    <p className="text-xs font-medium text-red-600">
                      ⚠ Article non reconnu dans le menu — vérifier le nom
                    </p>
                  )}
                </div>
                <StatusBadge status={item.status} label={ORDER_ITEM_STATUS_LABELS[item.status]} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gold-dark">
                  {formatMoney(Number(item.unitPriceSnapshot) * item.quantity)}
                </span>
                {!closed && item.status !== OrderItemStatus.ANNULE && (
                  <div className="flex gap-2">
                    {item.status === OrderItemStatus.PRETE && (
                      <button
                        className="btn-gold !px-3 !py-1.5 text-sm"
                        onClick={() => markItemServed.mutate(item.id)}
                      >
                        Servi
                      </button>
                    )}
                    <button
                      className="btn-outline !px-3 !py-1.5 text-sm !border-red-200 !text-red-700"
                      onClick={() => handleCancelItem(item.id)}
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {!closed && (
            <div className="pt-2">
              {!addingItem ? (
                <button className="btn-outline w-full" onClick={() => setAddingItem(true)}>
                  + Ajouter un article
                </button>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-burgundy/80">Choisir un article</p>
                    <button className="text-sm text-burgundy/60" onClick={() => setAddingItem(false)}>
                      Fermer
                    </button>
                  </div>
                  <div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto">
                    {menu
                      ?.flatMap((c) => c.items)
                      .filter((i) => i.active)
                      .map((item) => (
                        <button key={item.id} onClick={() => handleAddItem(item)} className="card-interactive text-left tap-target">
                          <p className="text-sm font-medium text-burgundy">{item.name}</p>
                          <p className="text-xs text-gold-dark">
                            {formatMoney(applyChannelPricing(Number(item.price), order.type))}
                          </p>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            <button className="btn-outline w-full" onClick={() => setShowTicket((v) => !v)}>
              {showTicket ? "Masquer l'aperçu du ticket" : "Aperçu du ticket"}
            </button>
            {showTicket && (
              <div className="mt-3">
                <TicketPreview order={order} />
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-burgundy/10 p-6">
          <div className="mb-3 flex justify-between text-lg font-semibold text-burgundy">
            <span>Total</span>
            <span>{formatMoney(order.total)}</span>
          </div>
          {error && <p className="mb-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="flex gap-3">
            <button className="btn-outline flex-1" onClick={onClose}>
              Fermer
            </button>
            {!closed && (
              <>
                <button
                  className="btn-outline flex-1"
                  disabled={reprintTicket.isPending}
                  onClick={() => reprintTicket.mutate()}
                >
                  {reprintTicket.isPending ? "Impression…" : "Réimprimer ticket"}
                </button>
                {order.status !== OrderStatus.SERVIE && (
                  <button className="btn-gold flex-1" onClick={() => markOrderServed.mutate()}>
                    Marquer servie
                  </button>
                )}
                <button className="btn-danger flex-1" onClick={handleCancelOrder}>
                  Annuler la commande
                </button>
              </>
            )}
          </div>
        </footer>
      </div>

      {pickingItem && (
        <ItemOptionsModal
          item={pickingItem}
          orderType={order.type}
          onClose={() => setPickingItem(null)}
          onAdd={addFromModal}
        />
      )}
    </div>
  );
}
