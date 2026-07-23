import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ReservationStatus } from "@le-tandoor/shared";
import { useReservations } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import { RESERVATION_STATUS_LABELS } from "../../lib/format";
import { useT } from "../../lib/i18n";
import StatusBadge from "../../components/StatusBadge";
import type { Reservation } from "../../types";
import NewReservationModal from "./NewReservationModal";

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function ReservationsPage() {
  const { data: reservations, isLoading } = useReservations();
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
      api.patch(`/reservations/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("reservation.error")),
  });

  const now = new Date();
  const today = reservations?.filter((r) => isSameDay(new Date(r.dateTime), now)) ?? [];
  const upcoming = reservations?.filter((r) => new Date(r.dateTime) > now && !isSameDay(new Date(r.dateTime), now)) ?? [];
  const past = reservations?.filter((r) => new Date(r.dateTime) < now && !isSameDay(new Date(r.dateTime), now)) ?? [];

  function renderRow(r: Reservation, i: number) {
    const isPending = r.status === ReservationStatus.EN_ATTENTE || r.status === ReservationStatus.CONFIRMEE;
    return (
      <div
        key={r.id}
        style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
        className="card list-item-in flex items-center justify-between gap-4"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-burgundy">
              {new Date(r.dateTime).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <StatusBadge status={r.status} label={RESERVATION_STATUS_LABELS[r.status] ?? r.status} />
          </div>
          <p className="truncate text-sm text-burgundy/70">
            {r.customerName}
            {r.partySize ? ` · ${r.partySize} pers.` : ""}
            {r.customerPhone ? ` · ${r.customerPhone}` : ""}
          </p>
          {r.table && <p className="text-xs text-burgundy/40">{r.table.name}</p>}
          {r.notes && <p className="text-xs italic text-burgundy/40">{r.notes}</p>}
        </div>
        {isPending && (
          <div className="flex shrink-0 gap-2">
            <button
              className="btn-gold !px-3 !py-1.5 text-sm"
              onClick={() => updateStatus.mutate({ id: r.id, status: ReservationStatus.ARRIVEE })}
            >
              {t("reservationsPage.markArrived")}
            </button>
            <button
              className="btn-outline !px-3 !py-1.5 text-sm"
              onClick={() => updateStatus.mutate({ id: r.id, status: ReservationStatus.ABSENTE })}
            >
              {t("reservationsPage.markAbsent")}
            </button>
            <button
              className="btn-outline !px-3 !py-1.5 text-sm !border-red-200 !text-red-700"
              onClick={() => updateStatus.mutate({ id: r.id, status: ReservationStatus.ANNULEE })}
            >
              {t("reservation.cancel")}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderSection(titleKey: Parameters<typeof t>[0], items: Reservation[]) {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <h2 className={clsx("mb-2 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
          {t(titleKey)} <span className="text-sm font-normal text-burgundy/40">({items.length})</span>
        </h2>
        <div className="space-y-2">{items.map((r, i) => renderRow(r, i))}</div>
      </div>
    );
  }

  const isEmpty = !isLoading && (reservations?.length ?? 0) === 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className={clsx("font-display text-2xl font-semibold text-burgundy", urdu && "font-urdu")}>
          {t("reservationsPage.title")}
        </h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + {t("reservationsPage.newTitle")}
        </button>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-red-700">{error}</p>}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-burgundy/5" />
          ))}
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-burgundy/15 py-16 text-center">
          <span className="text-4xl">📅</span>
          <p className="mt-3 text-burgundy/50">{t("reservationsPage.empty")}</p>
        </div>
      )}

      {renderSection("reservationsPage.today", today)}
      {renderSection("reservationsPage.upcoming", upcoming)}
      {renderSection("reservationsPage.past", past)}

      {creating && <NewReservationModal onClose={() => setCreating(false)} />}
    </div>
  );
}
