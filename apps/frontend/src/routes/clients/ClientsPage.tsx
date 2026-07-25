import { useMemo, useState } from "react";
import { useCustomers } from "../../hooks/queries";
import { formatDate, formatMoney } from "../../lib/format";
import { IconCustomers, IconMail, IconPhone, IconStar } from "../../components/icons";
import type { CustomerProfile } from "../../types";

type SortKey = "totalSpent" | "orderCount" | "lastOrderAt";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "totalSpent", label: "Total dépensé" },
  { key: "orderCount", label: "Nb. commandes" },
  { key: "lastOrderAt", label: "Dernière visite" },
];

// Seuil au-delà duquel un client est mis en avant comme habitué — purement indicatif, ajustable
// selon la clientèle réelle du restaurant (petite structure : 5 commandes est déjà un habitué).
const VIP_ORDER_THRESHOLD = 5;

function matchesSearch(customer: CustomerProfile, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [customer.name, customer.phone, customer.email].some((v) => v?.toLowerCase().includes(q));
}

export default function ClientsPage() {
  const { data: customers, isLoading } = useCustomers();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalSpent");

  const filtered = useMemo(() => {
    if (!customers) return [];
    const list = customers.filter((c) => matchesSearch(c, search));
    return [...list].sort((a, b) => {
      if (sortKey === "lastOrderAt") return b.lastOrderAt.localeCompare(a.lastOrderAt);
      return b[sortKey] - a[sortKey];
    });
  }, [customers, search, sortKey]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-burgundy">Clients</h1>
          {customers && customers.length > 0 && (
            <p className="mt-0.5 text-sm text-burgundy/50">
              {customers.length} client{customers.length > 1 ? "s" : ""} identifié{customers.length > 1 ? "s" : ""} à
              partir des commandes
            </p>
          )}
        </div>
        <input
          className="input sm:max-w-xs"
          placeholder="Rechercher (nom, téléphone, email)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {customers && customers.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              className={`rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-colors ${
                sortKey === opt.key
                  ? "border-burgundy bg-burgundy text-cream"
                  : "border-burgundy/15 bg-white text-burgundy/60 hover:border-burgundy/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-32 animate-pulse bg-burgundy/5" />
          ))}
        </div>
      )}

      {customers && customers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-burgundy/15 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-burgundy/5 text-burgundy/30">
            <IconCustomers className="h-7 w-7" />
          </span>
          <p className="mt-3 text-burgundy/50">
            Aucun client identifié pour l'instant — dès qu'une commande à emporter, en livraison ou du
            site web avec un email ou un numéro de téléphone sera clôturée, elle apparaîtra ici.
          </p>
        </div>
      )}

      {customers && customers.length > 0 && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-burgundy/50">Aucun client ne correspond à cette recherche.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((customer) => {
          const isVip = customer.orderCount >= VIP_ORDER_THRESHOLD;
          return (
            <div key={customer.key} className="card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg font-semibold text-burgundy">
                  {customer.name ?? "Client"}
                </p>
                {isVip && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                    <IconStar className="h-3 w-3" />
                    Habitué
                  </span>
                )}
              </div>

              <div className="mt-1.5 space-y-1 text-sm text-burgundy/60">
                {customer.phone && (
                  <p className="flex items-center gap-1.5">
                    <IconPhone className="h-3.5 w-3.5 shrink-0" />
                    {customer.phone}
                  </p>
                )}
                {customer.email && (
                  <p className="flex items-center gap-1.5 truncate">
                    <IconMail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-end justify-between border-t border-burgundy/10 pt-3">
                <div>
                  <p className="text-xs text-burgundy/50">
                    {customer.orderCount} commande{customer.orderCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-burgundy/50">Dernière visite : {formatDate(customer.lastOrderAt)}</p>
                </div>
                <p className="text-lg font-semibold text-gold-dark">{formatMoney(customer.totalSpent)}</p>
              </div>

              {customer.favoriteItem && (
                <p className="mt-2 text-xs italic text-burgundy/50">Plat favori : {customer.favoriteItem}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
