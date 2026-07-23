import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { TableStatus } from "@le-tandoor/shared";
import { useTables, useReservations } from "../../hooks/queries";
import { api } from "../../lib/api";
import { useT, type TranslationKey } from "../../lib/i18n";
import type { RestaurantTable } from "../../types";
import TableReservationModal from "./TableReservationModal";
import TableMarker from "./TableMarker";

const STATUS_KEYS: Record<string, TranslationKey> = {
  LIBRE: "table.LIBRE",
  RESERVEE: "table.RESERVEE",
  OCCUPEE: "table.OCCUPEE",
  A_NETTOYER: "table.A_NETTOYER",
};

const STATUS_COLORS: Record<string, string> = {
  LIBRE: "bg-green-50 border-green-400 text-green-800",
  RESERVEE: "bg-gold/25 border-gold text-burgundy",
  OCCUPEE: "bg-burgundy/10 border-burgundy text-burgundy",
  A_NETTOYER: "bg-gray-100 border-gray-400 text-gray-600",
};

const MANUAL_CYCLE: Record<string, string> = {
  OCCUPEE: TableStatus.A_NETTOYER,
  A_NETTOYER: TableStatus.LIBRE,
};

const ROOM_ASPECT: Record<string, string> = {
  "Salle 1": "10 / 7",
  "Salle 2": "7 / 10",
};

function sizeForSeats(seats: number): { width: string; height: string } {
  if (seats <= 2) return { width: "8%", height: "10%" };
  if (seats <= 4) return { width: "12%", height: "10%" };
  return { width: "15%", height: "12%" };
}

export default function SallePage() {
  const { data: tables } = useTables();
  const { data: reservations } = useReservations();
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/tables/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  function handleTableClick(table: RestaurantTable) {
    if (table.status === TableStatus.LIBRE || table.status === TableStatus.RESERVEE) {
      setSelectedTable(table);
      return;
    }
    const next = MANUAL_CYCLE[table.status];
    if (next) updateStatus.mutate({ id: table.id, status: next });
  }

  const zones = Array.from(new Set((tables ?? []).map((tb) => tb.zone || "Salle"))).sort();
  const reservationByTableId = new Map((reservations ?? []).filter((r) => r.tableId).map((r) => [r.tableId!, r]));

  return (
    <div className="p-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className={clsx("font-display text-2xl font-semibold text-burgundy", urdu && "font-urdu")}>
          {t("salle.title")}
        </h1>
        <p className={clsx("text-sm text-burgundy/50", urdu && "font-urdu text-base")}>{t("salle.hint")}</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white/70 px-4 py-2.5 shadow-sm">
        {Object.entries(STATUS_KEYS).map(([status, key]) => (
          <span
            key={status}
            className={clsx(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              STATUS_COLORS[status],
              urdu && "font-urdu text-sm"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {t(key)}
          </span>
        ))}
      </div>

      {tables?.length === 0 && <p className="text-burgundy/50">{t("salle.empty")}</p>}

      <div className="flex flex-col items-center gap-10">
        {zones.map((zone) => (
          <div key={zone} className="w-full max-w-[520px]">
            <h2 className={clsx("mb-3 text-center font-display text-lg font-semibold text-burgundy/80", urdu && "font-urdu")}>
              {zone}
            </h2>
            <div
              className="relative mx-auto w-full rounded-[2rem] border-[6px] border-burgundy/15 bg-[#fffaf1] shadow-md"
              style={{ aspectRatio: ROOM_ASPECT[zone] ?? "4 / 3" }}
            >
              {/* Porte : ouverture dans le mur + arc d'ouverture, dessinés en CSS */}
              <span className="absolute bottom-[-6px] left-[3%] h-[6px] w-[9%] rounded-full bg-[#fffaf1]" />
              <span className="absolute bottom-0 left-[3%] h-14 w-14 rounded-tr-full border-t-2 border-r-2 border-burgundy/20" />

              {tables
                ?.filter((tb) => (tb.zone || "Salle") === zone)
                .map((table) => (
                  <TableMarker
                    key={table.id}
                    table={table}
                    colorClass={STATUS_COLORS[table.status]}
                    size={sizeForSeats(table.seats)}
                    onClick={() => handleTableClick(table)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {selectedTable && (
        <TableReservationModal
          table={selectedTable}
          reservation={reservationByTableId.get(selectedTable.id) ?? null}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}
