import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ReservationStatus, type CreateReservationInput } from "@le-tandoor/shared";
import { api, ApiError } from "../../lib/api";
import { useT } from "../../lib/i18n";
import type { RestaurantTable, Reservation } from "../../types";

function defaultDateTimeLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TableReservationModal({
  table,
  reservation,
  onClose,
}: {
  table: RestaurantTable;
  reservation: Reservation | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [time, setTime] = useState(defaultDateTimeLocal());
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["reservations"] });
    queryClient.invalidateQueries({ queryKey: ["tables"] });
  }

  const createReservation = useMutation({
    mutationFn: (input: CreateReservationInput) => api.post("/reservations", input),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("reservation.error")),
  });

  const cancelReservation = useMutation({
    mutationFn: (id: string) => api.patch(`/reservations/${id}/status`, { status: ReservationStatus.ANNULEE }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("reservation.error")),
  });

  function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError(t("reservation.nameRequired"));
      return;
    }
    if (!time) {
      setError(t("reservation.timeRequired"));
      return;
    }
    setError(null);
    createReservation.mutate({
      customerName: `${firstName.trim()} ${lastName.trim()}`,
      dateTime: new Date(time).toISOString(),
      tableId: table.id,
    });
  }

  return (
    <div className="modal-overlay">
      <div className={clsx("modal-panel w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl", urdu && "font-urdu")}>
        <h2 className="font-display text-xl font-semibold text-burgundy">
          {t("reservation.title")} — {table.name}
        </h2>

        {reservation ? (
          <div className="mt-4">
            <p className="text-burgundy/80">
              {t("reservation.reservedFor")} <span className="font-semibold">{reservation.customerName}</span>
            </p>
            <p className="text-sm text-burgundy/60">
              {t("reservation.at")} {formatDateTime(reservation.dateTime)}
            </p>
            {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button className="btn-outline flex-1" onClick={onClose}>
                {t("reservation.close")}
              </button>
              <button
                className="btn-danger flex-1"
                disabled={cancelReservation.isPending}
                onClick={() => cancelReservation.mutate(reservation.id)}
              >
                {t("reservation.cancelReservation")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="space-y-3">
              <input
                className="input"
                placeholder={t("reservation.firstName")}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="input"
                placeholder={t("reservation.lastName")}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <input
                className="input"
                type="datetime-local"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button className="btn-outline flex-1" onClick={onClose}>
                {t("reservation.cancel")}
              </button>
              <button className="btn-primary flex-1" disabled={createReservation.isPending} onClick={handleSubmit}>
                {createReservation.isPending ? t("reservation.submitting") : t("reservation.submit")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
