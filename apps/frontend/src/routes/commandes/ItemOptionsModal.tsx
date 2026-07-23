import { useState } from "react";
import { applyChannelPricing, type OrderType } from "@le-tandoor/shared";
import type { MenuItem } from "../../types";
import { formatMoney } from "../../lib/format";

export interface AddedLine {
  menuItemId: string;
  name: string;
  quantity: number;
  notes: string;
  selectedOptionIds: string[];
  basePrice: number;
}

export default function ItemOptionsModal({
  item,
  orderType,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  orderType: OrderType;
  onClose: () => void;
  onAdd: (line: AddedLine) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);

  const freeOptions = item.options.filter((o) => !o.groupName);
  const groupNames = Array.from(new Set(item.options.filter((o) => o.groupName).map((o) => o.groupName as string)));

  const optionsTotal = item.options
    .filter((o) => selectedOptionIds.includes(o.id))
    .reduce((sum, o) => sum + Number(o.priceDelta), 0);
  const basePrice = Number(item.price) + optionsTotal;
  const unitPrice = applyChannelPricing(basePrice, orderType);

  const missingGroups = groupNames.filter(
    (group) => !item.options.some((o) => o.groupName === group && selectedOptionIds.includes(o.id))
  );

  function toggleFreeOption(id: string) {
    setSelectedOptionIds((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  }

  function selectGroupOption(group: string, id: string) {
    setSelectedOptionIds((prev) => [...prev.filter((existing) => !item.options.some((o) => o.id === existing && o.groupName === group)), id]);
  }

  return (
    <div className="modal-overlay z-50 !items-end sm:!items-center">
      <div className="modal-panel max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
        <h3 className="font-display text-xl font-semibold text-burgundy">{item.name}</h3>
        {item.description && <p className="mt-1 text-sm text-burgundy/60">{item.description}</p>}

        {groupNames.map((group) => (
          <div key={group} className="mt-4">
            <p className="mb-2 text-sm font-medium text-burgundy/80">
              {group} <span className="text-red-600">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {item.options
                .filter((o) => o.groupName === group)
                .map((o) => (
                  <button
                    key={o.id}
                    onClick={() => selectGroupOption(group, o.id)}
                    className={`tap-target rounded-xl border-2 px-3 py-2 text-sm ${
                      selectedOptionIds.includes(o.id)
                        ? "border-gold bg-gold/20 text-burgundy"
                        : "border-burgundy/15 text-burgundy/70"
                    }`}
                  >
                    {o.name}
                    {Number(o.priceDelta) !== 0 && (
                      <span className="ml-1 text-xs opacity-70">
                        ({Number(o.priceDelta) > 0 ? "+" : ""}
                        {formatMoney(o.priceDelta)})
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        ))}

        {freeOptions.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-burgundy/80">Suppléments / sauces</p>
            <div className="flex flex-wrap gap-2">
              {freeOptions.map((o) => (
                <button
                  key={o.id}
                  onClick={() => toggleFreeOption(o.id)}
                  className={`tap-target rounded-xl border-2 px-3 py-2 text-sm ${
                    selectedOptionIds.includes(o.id)
                      ? "border-gold bg-gold/20 text-burgundy"
                      : "border-burgundy/15 text-burgundy/70"
                  }`}
                >
                  {o.name}
                  {Number(o.priceDelta) !== 0 && (
                    <span className="ml-1 text-xs opacity-70">
                      ({Number(o.priceDelta) > 0 ? "+" : ""}
                      {formatMoney(o.priceDelta)})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-burgundy/80">Remarque</label>
          <input
            className="input"
            placeholder="Ex : sans coriandre, peu épicé…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="tap-target rounded-full bg-burgundy/10 text-xl font-bold text-burgundy"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              −
            </button>
            <span className="w-6 text-center text-lg font-semibold">{quantity}</span>
            <button
              className="tap-target rounded-full bg-burgundy/10 text-xl font-bold text-burgundy"
              onClick={() => setQuantity((q) => q + 1)}
            >
              +
            </button>
          </div>
          <span className="text-lg font-semibold text-burgundy">{formatMoney(unitPrice * quantity)}</span>
        </div>

        {missingGroups.length > 0 && (
          <p className="mt-2 text-sm font-medium text-red-600">
            Choisissez une option pour : {missingGroups.join(", ")}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button className="btn-outline flex-1" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn-primary flex-1"
            disabled={missingGroups.length > 0}
            onClick={() =>
              onAdd({
                menuItemId: item.id,
                name: item.name,
                quantity,
                notes,
                selectedOptionIds,
                basePrice,
              })
            }
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
