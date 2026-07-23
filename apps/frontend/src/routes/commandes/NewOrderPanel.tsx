import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OrderType, applyChannelPricing, type CreateOrderInput } from "@le-tandoor/shared";
import { useMenu, useTables } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import type { MenuItem } from "../../types";
import ItemOptionsModal, { type AddedLine } from "./ItemOptionsModal";

interface CartLine extends AddedLine {
  localId: string;
}

export default function NewOrderPanel({ onClose }: { onClose: () => void }) {
  const { data: menu } = useMenu();
  const { data: tables } = useTables();
  const queryClient = useQueryClient();

  const [type, setType] = useState<CreateOrderInput["type"]>(OrderType.SUR_PLACE);
  const [tableId, setTableId] = useState<string | undefined>(undefined);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(menu?.[0]?.id ?? null);
  const [pickingItem, setPickingItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const categoryId = activeCategoryId ?? menu?.[0]?.id ?? null;
  const activeCategory = menu?.find((c) => c.id === categoryId) ?? menu?.[0];

  const total = cart.reduce(
    (sum, line) => sum + applyChannelPricing(line.basePrice, type) * line.quantity,
    0
  );

  const createOrder = useMutation({
    mutationFn: (input: CreateOrderInput) => api.post("/orders", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur lors de la création"),
  });

  function handleItemTap(item: MenuItem) {
    if (item.options.length > 0) {
      setPickingItem(item);
    } else {
      setCart((prev) => [
        ...prev,
        {
          localId: crypto.randomUUID(),
          menuItemId: item.id,
          name: item.name,
          quantity: 1,
          notes: "",
          selectedOptionIds: [],
          basePrice: Number(item.price),
        },
      ]);
    }
  }

  function addFromModal(line: AddedLine) {
    setCart((prev) => [...prev, { ...line, localId: crypto.randomUUID() }]);
    setPickingItem(null);
  }

  function updateQuantity(localId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.localId === localId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(localId: string) {
    setCart((prev) => prev.filter((l) => l.localId !== localId));
  }

  function handleSubmit() {
    setError(null);
    if (cart.length === 0) {
      setError("Ajoutez au moins un article");
      return;
    }
    if (type === OrderType.SUR_PLACE && !tableId) {
      setError("Choisissez une table");
      return;
    }
    if (type === OrderType.LIVRAISON && !deliveryAddress) {
      setError("Renseignez l'adresse de livraison");
      return;
    }
    createOrder.mutate({
      type,
      tableId: type === OrderType.SUR_PLACE ? tableId : undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      deliveryAddress: type === OrderType.LIVRAISON ? deliveryAddress : undefined,
      items: cart.map((l) => ({
        menuItemId: l.menuItemId,
        quantity: l.quantity,
        notes: l.notes || undefined,
        selectedOptionIds: l.selectedOptionIds,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-cream [animation:fade-in_0.15s_ease-out]">
      <header className="flex items-center justify-between border-b border-burgundy/10 bg-white px-6 py-4">
        <h2 className="font-display text-2xl font-semibold text-burgundy">Nouvelle commande</h2>
        <button className="btn-outline" onClick={onClose}>
          Fermer
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-4 flex gap-2">
            {(
              [
                { value: OrderType.SUR_PLACE, label: "Sur place" },
                { value: OrderType.EMPORTER, label: "À emporter" },
                { value: OrderType.LIVRAISON, label: "Livraison" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={type === opt.value ? "btn-primary" : "btn-outline"}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {type === OrderType.SUR_PLACE && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-burgundy/80">Table</p>
              <div className="flex flex-wrap gap-2">
                {tables?.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTableId(t.id)}
                    className={`tap-target rounded-xl border-2 px-4 py-2 text-sm font-medium ${
                      tableId === t.id ? "border-gold bg-gold/20 text-burgundy" : "border-burgundy/15 text-burgundy/70"
                    }`}
                  >
                    {t.name} ({t.seats} pl.)
                  </button>
                ))}
              </div>
            </div>
          )}

          {(type === OrderType.EMPORTER || type === OrderType.LIVRAISON) && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Nom du client"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                className="input"
                placeholder="Téléphone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              {type === OrderType.LIVRAISON && (
                <input
                  className="input sm:col-span-2"
                  placeholder="Adresse de livraison"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              )}
            </div>
          )}

          <div className="mb-3 flex gap-2 overflow-x-auto border-b border-burgundy/10 pb-2">
            {menu?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
                  categoryId === cat.id ? "bg-burgundy text-cream" : "bg-white text-burgundy/70"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {activeCategory?.items
              .filter((i) => i.active)
              .map((item) => (
                <button key={item.id} onClick={() => handleItemTap(item)} className="card-interactive text-left tap-target">
                  <p className="font-medium text-burgundy">{item.name}</p>
                  <p className="mt-1 text-sm text-gold-dark">
                    {formatMoney(applyChannelPricing(Number(item.price), type))}
                  </p>
                </button>
              ))}
          </div>
        </div>

        <aside className="flex w-80 flex-col border-l border-burgundy/10 bg-white p-4">
          <h3 className="mb-3 font-display text-lg font-semibold text-burgundy">Panier</h3>
          <div className="flex-1 space-y-2 overflow-auto">
            {cart.length === 0 && <p className="text-sm text-burgundy/50">Aucun article ajouté</p>}
            {cart.map((line) => (
              <div key={line.localId} className="rounded-xl border border-burgundy/10 p-3">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-burgundy">{line.name}</p>
                  <button onClick={() => removeLine(line.localId)} className="text-sm text-red-600">
                    ✕
                  </button>
                </div>
                {line.notes && <p className="text-xs text-burgundy/60">{line.notes}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      className="tap-target rounded-full bg-burgundy/10 px-2 font-bold text-burgundy"
                      onClick={() => updateQuantity(line.localId, -1)}
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      className="tap-target rounded-full bg-burgundy/10 px-2 font-bold text-burgundy"
                      onClick={() => updateQuantity(line.localId, 1)}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatMoney(applyChannelPricing(line.basePrice, type) * line.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-burgundy/10 pt-3">
            <div className="flex justify-between text-lg font-semibold text-burgundy">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
            {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
            <button
              className="btn-primary mt-3 w-full"
              disabled={createOrder.isPending}
              onClick={handleSubmit}
            >
              {createOrder.isPending ? "Envoi…" : "Envoyer en cuisine"}
            </button>
          </div>
        </aside>
      </div>

      {pickingItem && (
        <ItemOptionsModal
          item={pickingItem}
          orderType={type}
          onClose={() => setPickingItem(null)}
          onAdd={addFromModal}
        />
      )}
    </div>
  );
}
