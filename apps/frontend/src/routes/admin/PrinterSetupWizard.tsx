import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PrintTarget, type CreatePrinterInput } from "@le-tandoor/shared";
import { api, ApiError } from "../../lib/api";
import { useT, type TranslationKey } from "../../lib/i18n";

const TARGETS: { value: PrintTarget; labelKey: TranslationKey; descKey: TranslationKey; icon: string }[] = [
  { value: PrintTarget.CUISINE, labelKey: "printersAdmin.target.CUISINE", descKey: "printerWizard.targetDesc.CUISINE", icon: "🍳" },
  { value: PrintTarget.CAISSE, labelKey: "printersAdmin.target.CAISSE", descKey: "printerWizard.targetDesc.CAISSE", icon: "🧾" },
  { value: PrintTarget.BAR, labelKey: "printersAdmin.target.BAR", descKey: "printerWizard.targetDesc.BAR", icon: "🍹" },
];

type TestStatus = "idle" | "testing" | "success" | "error";

export default function PrinterSetupWizard({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [target, setTarget] = useState<PrintTarget | null>(null);
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("9100");
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const testConnection = useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/printers/test", { ip, port: Number(port) || 9100 }),
    onMutate: () => {
      setTestStatus("testing");
      setTestMessage(null);
    },
    onSuccess: () => setTestStatus("success"),
    onError: (err) => {
      setTestStatus("error");
      setTestMessage(err instanceof ApiError ? err.message : t("printerWizard.testUnknownError"));
    },
  });

  const createPrinter = useMutation({
    mutationFn: (input: CreatePrinterInput) => api.post("/printers", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printers"] });
      onClose();
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : t("printerWizard.saveError")),
  });

  function handleTest() {
    if (!ip.trim()) {
      setFormError(t("printerWizard.ipRequired"));
      return;
    }
    setFormError(null);
    testConnection.mutate();
  }

  function handleSave() {
    if (!name.trim() || !ip.trim() || !target) {
      setFormError(t("printerWizard.ipRequired"));
      return;
    }
    setFormError(null);
    createPrinter.mutate({ name: name.trim(), ip: ip.trim(), port: Number(port) || 9100, target });
  }

  return (
    <div className="modal-overlay">
      <div className={clsx("modal-panel w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl", urdu && "font-urdu")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-burgundy">{t("printerWizard.title")}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-burgundy/40 hover:bg-burgundy/5 hover:text-burgundy">
            ✕
          </button>
        </div>

        <div className="mb-5 flex items-center gap-2">
          {[1, 2].map((s) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={clsx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  step >= s ? "bg-gold text-burgundy-dark" : "bg-burgundy/10 text-burgundy/40"
                )}
              >
                {s}
              </div>
              {s < 2 && <div className={clsx("h-0.5 flex-1 transition-colors", step > s ? "bg-gold" : "bg-burgundy/10")} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="list-item-in space-y-3">
            <p className="text-sm text-burgundy/60">{t("printerWizard.step1Intro")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {TARGETS.map((tg) => (
                <button
                  key={tg.value}
                  onClick={() => setTarget(tg.value)}
                  className={clsx(
                    "card-interactive text-center",
                    target === tg.value && "!border-gold ring-2 ring-gold/30"
                  )}
                >
                  <span className="text-3xl">{tg.icon}</span>
                  <p className="mt-2 font-semibold text-burgundy">{t(tg.labelKey)}</p>
                  <p className="mt-1 text-xs text-burgundy/50">{t(tg.descKey)}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button className="btn-primary" disabled={!target} onClick={() => setStep(2)}>
                {t("printerWizard.next")}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="list-item-in space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-burgundy/70">{t("printerWizard.nameLabel")}</label>
              <input className="input" placeholder={t("printersAdmin.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="rounded-xl bg-cream/70 p-3 text-xs leading-relaxed text-burgundy/60">
              {t("printerWizard.ipHelp")}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-burgundy/70">{t("printerWizard.ipLabel")}</label>
                <input
                  className="input"
                  placeholder="192.168.1.50"
                  value={ip}
                  onChange={(e) => {
                    setIp(e.target.value);
                    setTestStatus("idle");
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-burgundy/70">{t("printerWizard.portLabel")}</label>
                <input
                  className="input"
                  type="number"
                  value={port}
                  onChange={(e) => {
                    setPort(e.target.value);
                    setTestStatus("idle");
                  }}
                />
              </div>
            </div>

            <div>
              <button
                className="btn-outline w-full"
                disabled={testStatus === "testing"}
                onClick={handleTest}
              >
                {testStatus === "testing" ? t("printerWizard.testing") : t("printerWizard.testButton")}
              </button>

              {testStatus === "success" && (
                <p className="mt-2 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-700">
                  ✓ {t("printerWizard.testSuccess")}
                </p>
              )}
              {testStatus === "error" && (
                <div className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-medium">⚠ {testMessage}</p>
                  <p className="mt-1 text-xs text-red-600/80">{t("printerWizard.testErrorHint")}</p>
                </div>
              )}
            </div>

            {formError && <p className="text-sm font-medium text-red-700">{formError}</p>}

            <div className="flex items-center justify-between pt-1">
              <button className="btn-outline" onClick={() => setStep(1)}>
                {t("printerWizard.back")}
              </button>
              <div className="flex items-center gap-3">
                {testStatus !== "success" && (
                  <button className="text-sm text-burgundy/50 underline hover:text-burgundy" onClick={handleSave}>
                    {t("printerWizard.saveAnyway")}
                  </button>
                )}
                <button className="btn-gold" disabled={createPrinter.isPending} onClick={handleSave}>
                  {createPrinter.isPending ? t("printerWizard.saving") : t("printerWizard.save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
