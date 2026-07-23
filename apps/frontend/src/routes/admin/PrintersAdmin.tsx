import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { PrintTarget } from "@le-tandoor/shared";
import { api, ApiError } from "../../lib/api";
import { useT, type TranslationKey } from "../../lib/i18n";
import PrinterSetupWizard from "./PrinterSetupWizard";

interface PrinterRow {
  id: string;
  name: string;
  ip: string;
  port: number;
  target: PrintTarget;
  active: boolean;
}

const TARGETS: { value: PrintTarget; labelKey: TranslationKey }[] = [
  { value: PrintTarget.CUISINE, labelKey: "printersAdmin.target.CUISINE" },
  { value: PrintTarget.CAISSE, labelKey: "printersAdmin.target.CAISSE" },
  { value: PrintTarget.BAR, labelKey: "printersAdmin.target.BAR" },
];

export default function PrintersAdmin() {
  const { data: printers } = useQuery({ queryKey: ["printers"], queryFn: () => api.get<PrinterRow[]>("/printers") });
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const urdu = lang === "ur";

  const [wizardOpen, setWizardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message?: string } | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["printers"] });
  }

  const deletePrinter = useMutation({
    mutationFn: (id: string) => api.delete(`/printers/${id}`),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : t("menuAdmin.error")),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/printers/${id}`, { active }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : t("menuAdmin.error")),
  });

  async function handleTest(printer: PrinterRow) {
    setTestingId(printer.id);
    setTestResult(null);
    try {
      await api.post("/printers/test", { ip: printer.ip, port: printer.port });
      setTestResult({ id: printer.id, ok: true });
    } catch (err) {
      setTestResult({ id: printer.id, ok: false, message: err instanceof ApiError ? err.message : t("printerWizard.testUnknownError") });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={clsx("text-sm text-burgundy/60", urdu && "font-urdu text-base")}>{t("printersAdmin.newPrinter")}</p>
        <button className="btn-primary" onClick={() => setWizardOpen(true)}>
          + {t("printersAdmin.add")}
        </button>
      </div>
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}

      {printers && printers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-burgundy/15 py-12 text-center">
          <span className="text-4xl">🖨️</span>
          <p className="mt-3 text-burgundy/50">{t("printersAdmin.empty")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {printers?.map((printer) => (
          <div key={printer.id} className={clsx("card", !printer.active && "opacity-50")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-burgundy">{printer.name}</p>
                <p className="text-sm text-burgundy/60">
                  {printer.ip}:{printer.port}
                </p>
                <p className="text-xs text-burgundy/40">{t(TARGETS.find((tg) => tg.value === printer.target)!.labelKey)}</p>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-burgundy/50">
                <input
                  type="checkbox"
                  checked={printer.active}
                  onChange={(e) => toggleActive.mutate({ id: printer.id, active: e.target.checked })}
                  className="h-4 w-4 accent-gold"
                />
                {t("printersAdmin.activeLabel")}
              </label>
            </div>

            {testResult?.id === printer.id && (
              <p
                className={clsx(
                  "mt-2 rounded-lg px-2 py-1 text-xs font-medium",
                  testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}
              >
                {testResult.ok ? `✓ ${t("printerWizard.testSuccess")}` : `⚠ ${testResult.message}`}
              </p>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button
                className="text-sm font-medium text-burgundy/70 hover:text-burgundy"
                disabled={testingId === printer.id}
                onClick={() => handleTest(printer)}
              >
                {testingId === printer.id ? t("printerWizard.testing") : t("printerWizard.testButton")}
              </button>
              <button
                className={clsx("text-sm text-red-600 hover:text-red-800", urdu && "font-urdu text-base")}
                onClick={() => deletePrinter.mutate(printer.id)}
              >
                {t("printersAdmin.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {wizardOpen && <PrinterSetupWizard onClose={() => setWizardOpen(false)} />}
    </div>
  );
}
