import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useAiInsights } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useState } from "react";
import SimpleMarkdown from "../../components/SimpleMarkdown";

export default function ConseilsPage() {
  const { data: insights, isLoading } = useAiInsights();
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => api.post("/ai-insights/generate"),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["ai-insights"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={clsx("font-display text-2xl font-semibold text-burgundy", urdu && "font-urdu")}>
          {t("conseils.title")}
        </h1>
        <button
          className={clsx("btn-primary", urdu && "font-urdu text-base")}
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? t("conseils.generating") : t("conseils.generate")}
        </button>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-red-700">{error}</p>}

      {isLoading && <p className="text-burgundy/60">…</p>}
      {!isLoading && insights?.length === 0 && <p className="text-burgundy/50">{t("conseils.empty")}</p>}

      <div className="space-y-4">
        {insights?.map((insight) => (
          <div key={insight.id} className="card text-sm leading-relaxed text-burgundy/90">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gold-dark">
                {t("conseils.basedOn")}{" "}
                {new Date(insight.generatedAt).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {insight.kind === "QUOTIDIEN" && (
                <span className="rounded-full bg-burgundy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-burgundy">
                  {t("conseils.dailyBadge")}
                </span>
              )}
            </div>
            <SimpleMarkdown text={insight.content} />
          </div>
        ))}
      </div>
    </div>
  );
}
