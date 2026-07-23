import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import type { CreateTableInput } from "@le-tandoor/shared";
import { useTables } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import { useT } from "../../lib/i18n";

export default function TablesAdmin() {
  const { data: tables } = useTables();
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("4");
  const [zone, setZone] = useState("");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["tables"] });
  }

  const createTable = useMutation({
    mutationFn: (input: CreateTableInput) => api.post("/tables", input),
    onSuccess: () => {
      invalidate();
      setName("");
      setSeats("4");
      setZone("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("menuAdmin.error")),
  });

  const deleteTable = useMutation({
    mutationFn: (id: string) => api.delete(`/tables/${id}`),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : t("menuAdmin.error")),
  });

  function handleCreate() {
    if (!name) {
      setError(t("tablesAdmin.nameRequired"));
      return;
    }
    setError(null);
    createTable.mutate({ name, seats: Number(seats), zone: zone || undefined, posX: 0, posY: 0, shape: "CARREE" });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className={clsx("mb-2 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
          {t("tablesAdmin.newTable")}
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            className="input"
            placeholder={t("tablesAdmin.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder={t("tablesAdmin.seatsPlaceholder")}
            type="number"
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
          <input
            className="input"
            placeholder={t("tablesAdmin.zonePlaceholder")}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          />
          <button className={clsx("btn-primary", urdu && "font-urdu text-base")} onClick={handleCreate}>
            {t("tablesAdmin.add")}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tables?.map((table) => (
          <div key={table.id} className="card">
            <p className="font-semibold text-burgundy">{table.name}</p>
            <p className="text-sm text-burgundy/60">
              {table.seats} {t("tablesAdmin.seatsSuffix")}
            </p>
            {table.zone && <p className="text-xs text-burgundy/40">{table.zone}</p>}
            <button
              className={clsx("mt-2 text-sm text-red-600", urdu && "font-urdu text-base")}
              onClick={() => deleteTable.mutate(table.id)}
            >
              {t("tablesAdmin.delete")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
