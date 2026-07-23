import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { PaymentMethod, type CloseOrderInput } from "@le-tandoor/shared";
import { api, ApiError } from "../../lib/api";
import { formatMoney, ORDER_TYPE_LABELS } from "../../lib/format";
import { useT, type TranslationKey } from "../../lib/i18n";
import type { Order } from "../../types";

const METHODS: { value: PaymentMethod; labelKey: TranslationKey }[] = [
  { value: PaymentMethod.ESPECES, labelKey: "close.especes" },
  { value: PaymentMethod.CARTE, labelKey: "close.carte" },
  { value: PaymentMethod.TICKET_RESTAURANT, labelKey: "close.ticketRestaurant" },
  { value: PaymentMethod.AUTRE, labelKey: "close.autre" },
];

export default function CloseOrderPanel({ order, onClose }: { order: Order; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CARTE);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = Math.max(0, Number(order.subtotal) - discountAmount);
  const tableLabel = order.orderTables[0]?.table?.name;

  const closeOrder = useMutation({
    mutationFn: (input: CloseOrderInput) => api.post(`/orders/${order.id}/close`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur lors de la clôture"),
  });

  function handleConfirm() {
    setError(null);
    if (discountAmount > 0 && !discountReason) {
      setError(t("close.reasonRequired"));
      return;
    }
    closeOrder.mutate({ paymentMethod: method, discountAmount, discountReason: discountReason || undefined });
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <h2 className={clsx("font-display text-xl font-semibold text-burgundy", urdu && "font-urdu")}>
          {t("caisse.pay")} — {urdu ? t(`orderType.${order.type}` as TranslationKey) : ORDER_TYPE_LABELS[order.type]}{" "}
          {tableLabel ? `· ${tableLabel}` : ""}
        </h2>

        <ul className="mt-4 max-h-40 space-y-1 overflow-auto text-sm text-burgundy/70">
          {order.items
            .filter((i) => i.status !== "ANNULE")
            .map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>
                  {i.quantity}× {i.nameSnapshot}
                </span>
                <span>{formatMoney(Number(i.unitPriceSnapshot) * i.quantity)}</span>
              </li>
            ))}
        </ul>

        <div className="mt-4 space-y-3">
          <div>
            <p className={clsx("mb-1 text-sm font-medium text-burgundy/80", urdu && "font-urdu text-base")}>
              {t("close.paymentMethod")}
            </p>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={clsx(
                    method === m.value ? "btn-primary !py-2 text-sm" : "btn-outline !py-2 text-sm",
                    urdu && "font-urdu text-base"
                  )}
                >
                  {t(m.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={clsx("mb-1 block text-sm font-medium text-burgundy/80", urdu && "font-urdu text-base")}>
                {t("close.discount")}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <label className={clsx("mb-1 block text-sm font-medium text-burgundy/80", urdu && "font-urdu text-base")}>
                {t("close.reason")}
              </label>
              <input
                className="input"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div
          className={clsx(
            "mt-4 flex justify-between border-t border-burgundy/10 pt-3 text-lg font-semibold text-burgundy",
            urdu && "font-urdu"
          )}
        >
          <span>{t("close.totalDue")}</span>
          <span>{formatMoney(total)}</span>
        </div>

        {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button className={clsx("btn-outline flex-1", urdu && "font-urdu text-base")} onClick={onClose}>
            {t("close.cancel")}
          </button>
          <button
            className={clsx("btn-primary flex-1", urdu && "font-urdu text-base")}
            disabled={closeOrder.isPending}
            onClick={handleConfirm}
          >
            {closeOrder.isPending ? t("close.confirming") : t("close.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
