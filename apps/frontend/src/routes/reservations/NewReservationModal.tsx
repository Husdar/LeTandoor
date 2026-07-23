import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import type { CreateReservationInput } from "@le-tandoor/shared";
import { useTables } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import { useT } from "../../lib/i18n";

function defaultDateTimeLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function NewReservationModal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const { data: tables } = useTables();
  const queryClient = useQueryClient();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [dateTime, setDateTime] = useState(defaultDateTimeLocal());
  const [tableId, setTableId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createReservation = useMutation({
    mutationFn: (input: CreateReservationInput) => api.post("/reservations", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("reservation.error")),
  });

  function handleSubmit() {
    if (!customerName.trim()) {
      setError(t("reservation.nameRequired"));
      return;
    }
    if (!dateTime) {
      setError(t("reservation.timeRequired"));
      return;
    }
    setError(null);
    createReservation.mutate({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      partySize: partySize ? Number(partySize) : undefined,
      dateTime: new Date(dateTime).toISOString(),
      notes: notes.trim() || undefined,
      tableId: tableId || undefined,
    });
  }

  return (
    <div className="modal-overlay">
      <div className={clsx("modal-panel w-full max-w-md rounded-3xl bg-white p-6 shadow-xl", urdu && "font-urdu")}>
        <h2 className="mb-4 font-display text-xl font-semibold text-burgundy">{t("reservationsPage.newTitle")}</h2>

        <div className="space-y-3">
          <input
            className="input"
            placeholder={t("reservationsPage.customerName")}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              placeholder={t("reservationsPage.phone")}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <input
              className="input"
              type="number"
              min={1}
              placeholder={t("reservationsPage.partySize")}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
            />
          </div>
          <input
            className="input"
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
          />
          <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">{t("reservationsPage.noTable")}</option>
            {tables?.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name} ({table.seats} pl.)
              </option>
            ))}
          </select>
          <textarea
            className="input"
            rows={2}
            placeholder={t("reservationsPage.notes")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button className="btn-outline flex-1" onClick={onClose}>
            {t("reservation.cancel")}
          </button>
          <button className="btn-primary flex-1" disabled={createReservation.isPending} onClick={handleSubmit}>
            {createReservation.isPending ? t("reservation.submitting") : t("reservation.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
