import { useEffect, useState } from "react";
import clsx from "clsx";
import { useOrderHistory } from "../../hooks/queries";
import {
  displayOrderRef,
  formatMoney,
  ORDER_STATUS_ACCENT,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
} from "../../lib/format";
import { IconHistory } from "../../components/icons";
import type { Order } from "../../types";
import OrderDetailPanel from "../commandes/OrderDetailPanel";

/** Convertit la liste affichée (déjà filtrée par la recherche/les dates) en CSV compatible Excel
 * FR : point-virgule (Excel FR utilise la virgule comme séparateur décimal) et BOM UTF-8 (sinon
 * les accents s'affichent mal à l'ouverture). */
function exportCsv(orders: Order[]) {
  const headers = ["Numéro", "Date", "Client", "Téléphone", "Email", "Type", "Statut", "Total (€)"];
  const rows = orders.map((o) => [
    displayOrderRef(o),
    new Date(o.createdAt).toLocaleString("fr-FR"),
    o.customerName ?? "",
    o.customerPhone ?? "",
    o.customerEmail ?? "",
    ORDER_TYPE_LABELS[o.type] ?? o.type,
    ORDER_STATUS_LABELS[o.status] ?? o.status,
    Number(o.total).toFixed(2).replace(".", ","),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HistoriquePage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Petite pause avant de lancer la recherche pour ne pas interroger le serveur à chaque frappe.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: orders, isLoading } = useOrderHistory({
    search,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  });

  const freshSelectedOrder = selectedOrder ? orders?.find((o) => o.id === selectedOrder.id) ?? selectedOrder : null;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-burgundy">Historique des commandes</h1>
          {orders && <p className="mt-0.5 text-sm text-burgundy/50">{orders.length} résultat{orders.length > 1 ? "s" : ""}</p>}
        </div>
        <button
          className="btn-outline sm:w-auto"
          disabled={!orders || orders.length === 0}
          onClick={() => orders && exportCsv(orders)}
        >
          Exporter CSV
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <input
          className="input"
          placeholder="Rechercher (nom, téléphone, email, numéro)…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-burgundy/5" />
          ))}
        </div>
      )}

      {orders && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-burgundy/15 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-burgundy/5 text-burgundy/30">
            <IconHistory className="h-7 w-7" />
          </span>
          <p className="mt-3 text-burgundy/50">Aucune commande ne correspond.</p>
        </div>
      )}

      <div className="space-y-2">
        {orders?.map((order) => (
          <button
            key={order.id}
            onClick={() => setSelectedOrder(order)}
            className={clsx(
              "card-interactive flex w-full items-center justify-between gap-4 border-l-4 text-left",
              ORDER_STATUS_ACCENT[order.status] ?? "border-l-burgundy/10"
            )}
          >
            <div className="min-w-0">
              <p className="font-semibold text-burgundy">
                #{displayOrderRef(order)} — {order.customerName ?? "Client"}
              </p>
              <p className="truncate text-sm text-burgundy/60">
                {new Date(order.createdAt).toLocaleString("fr-FR")} · {ORDER_TYPE_LABELS[order.type]}
                {order.customerPhone ? ` · ${order.customerPhone}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-medium text-burgundy/70">{ORDER_STATUS_LABELS[order.status]}</span>
              <span className="font-semibold text-gold-dark">{formatMoney(order.total)}</span>
            </div>
          </button>
        ))}
      </div>

      {freshSelectedOrder && (
        <OrderDetailPanel order={freshSelectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}
