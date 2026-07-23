import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useMarketingContacts } from "../../hooks/queries";
import type { MarketingSuggestion } from "../../types";

export default function CampaignComposer() {
  const queryClient = useQueryClient();
  const { data: contacts } = useMarketingContacts();
  const subscribedCount = contacts?.filter((c) => c.subscribed).length ?? 0;

  const [brief, setBrief] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const suggestionsQuery = useQuery({
    queryKey: ["marketing-suggestions"],
    queryFn: () => api.get<MarketingSuggestion[]>("/marketing/suggestions"),
    enabled: false,
    retry: false,
  });

  const draftMutation = useMutation({
    mutationFn: (b: string) => api.post<{ subject: string; message: string }>("/marketing/campaigns/draft", { brief: b }),
    onSuccess: (data) => {
      setSubject(data.subject);
      setMessage(data.message);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur de génération IA"),
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post("/marketing/campaigns/send", { subject, message }),
    onSuccess: () => {
      setSendResult(`Campagne envoyée à ${subscribedCount} destinataire${subscribedCount > 1 ? "s" : ""}.`);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur d'envoi"),
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      api
        .post<{ html: string }>("/marketing/preview", { subject, message })
        .then((res) => setPreviewHtml(res.html))
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(timeout);
  }, [subject, message]);

  function handleSend() {
    if (!subject.trim() || !message.trim()) {
      setError("Sujet et message requis");
      return;
    }
    if (subscribedCount === 0) {
      setError("Aucun contact consentant à cibler");
      return;
    }
    const confirmed = window.confirm(
      `Envoyer cette campagne à ${subscribedCount} destinataire${subscribedCount > 1 ? "s" : ""} consentant${subscribedCount > 1 ? "s" : ""} ?`
    );
    if (confirmed) {
      setSendResult(null);
      sendMutation.mutate();
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card">
        <h2 className="mb-1 font-display text-lg font-semibold text-burgundy">Composer une campagne</h2>
        <p className="mb-3 text-xs text-burgundy/50">
          Décrivez ce que vous voulez annoncer, laissez l'IA rédiger un brouillon, puis ajustez avant l'envoi.
        </p>

        <div className="mb-3 flex flex-col gap-2 rounded-xl bg-cream/70 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-burgundy">Idées basées sur vos vraies données</p>
            <button
              className="self-start text-xs font-medium text-gold-dark hover:underline sm:self-auto"
              disabled={suggestionsQuery.isFetching}
              onClick={() => suggestionsQuery.refetch()}
            >
              {suggestionsQuery.isFetching ? "Analyse…" : "Obtenir des suggestions"}
            </button>
          </div>
          {suggestionsQuery.data?.map((s, i) => (
            <button
              key={i}
              className="rounded-lg border border-gold/30 bg-white p-2 text-left text-sm hover:border-gold"
              onClick={() => setBrief(s.brief)}
            >
              <p className="font-semibold text-burgundy">{s.title}</p>
              <p className="text-xs text-burgundy/60">{s.rationale}</p>
            </button>
          ))}
        </div>

        <textarea
          className="input mb-2 min-h-[60px] text-sm"
          placeholder="Ex: promotion sur le menu midi cette semaine, annoncer un nouveau plat…"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
        <button
          className="btn-gold mb-4 w-full !py-2 text-sm"
          disabled={!brief.trim() || draftMutation.isPending}
          onClick={() => draftMutation.mutate(brief)}
        >
          {draftMutation.isPending ? "Rédaction en cours…" : "Générer avec l'IA"}
        </button>

        <input
          className="input mb-2"
          placeholder="Sujet de l'email"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className="input min-h-[220px] text-sm"
          placeholder="Votre message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
        {sendResult && <p className="mt-2 text-sm font-medium text-green-700">{sendResult}</p>}

        <button
          className="btn-primary mt-3 w-full"
          disabled={sendMutation.isPending || !subject.trim() || !message.trim()}
          onClick={handleSend}
        >
          {sendMutation.isPending
            ? "Envoi…"
            : `Envoyer à ${subscribedCount} destinataire${subscribedCount > 1 ? "s" : ""} consentant${subscribedCount > 1 ? "s" : ""}`}
        </button>
      </div>

      <div className="card">
        <h2 className="mb-3 font-display text-lg font-semibold text-burgundy">Aperçu</h2>
        <div className="overflow-hidden rounded-xl border border-burgundy/10 bg-cream/40">
          <iframe title="Aperçu email" srcDoc={previewHtml} className="h-[420px] w-full sm:h-[560px]" />
        </div>
      </div>
    </div>
  );
}
