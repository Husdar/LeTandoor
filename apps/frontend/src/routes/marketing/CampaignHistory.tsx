import { useMarketingCampaigns } from "../../hooks/queries";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  ECHEC: "Échec",
};

const STATUS_COLORS: Record<string, string> = {
  BROUILLON: "bg-gray-100 text-gray-600",
  ENVOYEE: "bg-green-100 text-green-800",
  ECHEC: "bg-red-100 text-red-700",
};

export default function CampaignHistory() {
  const { data: campaigns, isLoading } = useMarketingCampaigns();

  return (
    <div className="card">
      <h2 className="mb-3 font-display text-lg font-semibold text-burgundy">Historique des campagnes</h2>
      {isLoading && <p className="text-sm text-burgundy/50">…</p>}
      {campaigns?.length === 0 && <p className="text-sm text-burgundy/40">Aucune campagne envoyée pour le moment.</p>}
      <ul className="space-y-2">
        {campaigns?.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg border border-burgundy/10 p-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-burgundy">{c.subject}</p>
              <p className="text-xs text-burgundy/50">
                {new Date(c.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {c.creator?.name ? ` · ${c.creator.name}` : ""}
              </p>
              {c.status === "ECHEC" && c.errorMessage && (
                <p className="mt-1 text-xs text-red-600">{c.errorMessage}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-burgundy/60">{c.recipientCount} destinataires</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[c.status]}`}>
                {STATUS_LABELS[c.status]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
