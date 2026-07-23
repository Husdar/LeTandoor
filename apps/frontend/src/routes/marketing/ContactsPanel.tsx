import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMarketingContacts } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";

export default function ContactsPanel() {
  const { data: contacts, isLoading } = useMarketingContacts();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; subscribed: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (raw: string) => api.post<{ imported: number; subscribed: number; total: number }>("/marketing/contacts/import", { text: raw }),
    onSuccess: (data) => {
      setResult(data);
      setText("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur d'import"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/marketing/contacts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] }),
  });

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => importMutation.mutate(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  const subscribedCount = contacts?.filter((c) => c.subscribed).length ?? 0;
  const total = contacts?.length ?? 0;

  return (
    <div className="card">
      <h2 className="mb-1 font-display text-lg font-semibold text-burgundy">Contacts</h2>
      <p className="mb-3 text-xs text-burgundy/50">
        Importez un fichier (CSV/texte) avec vos emails clients. Seuls les contacts ayant donné leur consentement
        marketing peuvent être ciblés par une campagne — les autres restent visibles mais protégés.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <textarea
          className="input min-h-[80px] flex-1 font-mono text-xs"
          placeholder="Collez ici : un email par ligne, ou CSV email,nom,consentement…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          className="btn-gold w-full !py-2 text-sm sm:w-auto"
          disabled={!text.trim() || importMutation.isPending}
          onClick={() => importMutation.mutate(text)}
        >
          {importMutation.isPending ? "Import…" : "Importer le texte collé"}
        </button>
        <button className="btn-outline w-full !py-2 text-sm sm:w-auto" onClick={() => fileInputRef.current?.click()}>
          Importer un fichier
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="mb-2 text-sm font-medium text-red-700">{error}</p>}
      {result && (
        <p className="mb-3 text-sm font-medium text-green-700">
          {result.imported} contact{result.imported > 1 ? "s" : ""} traité{result.imported > 1 ? "s" : ""}.
        </p>
      )}

      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-burgundy/70">
          {isLoading ? "…" : `${total} contact${total > 1 ? "s" : ""} au total`}
        </span>
        <span className="font-semibold text-green-700">{subscribedCount} consentant{subscribedCount > 1 ? "s" : ""}</span>
      </div>

      <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-burgundy/10 p-2">
        {contacts?.length === 0 && <p className="p-2 text-sm text-burgundy/40">Aucun contact importé.</p>}
        {contacts?.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-1.5 rounded-lg px-2 py-2 text-sm hover:bg-cream/70 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate text-burgundy">{c.name || c.email}</p>
              {c.name && <p className="truncate text-xs text-burgundy/50">{c.email}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={
                  c.subscribed
                    ? "rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800"
                    : "rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500"
                }
              >
                {c.subscribed ? "Consentant" : "Non consentant"}
              </span>
              <button
                className="text-xs text-red-600 hover:text-red-800"
                onClick={() => deleteMutation.mutate(c.id)}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
