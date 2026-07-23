import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useManualRevenue } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { useT } from "../../lib/i18n";

function todayIso(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export default function ManualRevenueForm() {
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const queryClient = useQueryClient();
  const today = todayIso();
  const monthAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const { data: entries } = useManualRevenue(monthAgo, today);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["manual-revenue"] });
    queryClient.invalidateQueries({ queryKey: ["analytics", "dashboard"] });
  }

  const addEntry = useMutation({
    mutationFn: () => api.post("/manual-revenue", { date, amount: Number(amount), label: label || undefined }),
    onSuccess: () => {
      invalidate();
      setAmount("");
      setLabel("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("performances.manualError")),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => api.delete(`/manual-revenue/${id}`),
    onSuccess: invalidate,
  });

  function handleSubmit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError(t("performances.manualAmountRequired"));
      return;
    }
    setError(null);
    addEntry.mutate();
  }

  const todayEntries = entries?.filter((e) => e.date.slice(0, 10) === today) ?? [];

  return (
    <div className="card">
      <h2 className={clsx("mb-3 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
        {t("performances.manualTitle")}
      </h2>
      <p className={clsx("mb-3 text-xs text-burgundy/50", urdu && "font-urdu text-sm")}>{t("performances.manualHint")}</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          type="number"
          min="0"
          step="0.01"
          className="input"
          placeholder={t("performances.manualAmount")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="input"
          placeholder={t("performances.manualLabel")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className="btn-gold" disabled={addEntry.isPending} onClick={handleSubmit}>
          {addEntry.isPending ? "…" : t("performances.manualAdd")}
        </button>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}

      {todayEntries.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-burgundy/10 pt-3">
          {todayEntries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between text-sm">
              <span className="text-burgundy/70">
                {entry.label || t("performances.manualTitle")}
                {entry.creator?.name ? ` · ${entry.creator.name}` : ""}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gold-dark">{formatMoney(entry.amount)}</span>
                <button
                  onClick={() => deleteEntry.mutate(entry.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  {t("printersAdmin.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
