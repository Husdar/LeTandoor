import { useState } from "react";
import clsx from "clsx";
import { useMarketingContacts, useMarketingCampaigns } from "../../hooks/queries";
import { IconMarketing } from "../../components/icons";
import ContactsPanel from "./ContactsPanel";
import CampaignComposer from "./CampaignComposer";
import CampaignHistory from "./CampaignHistory";

type Tab = "contacts" | "composer" | "history";

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>("contacts");
  const { data: contacts } = useMarketingContacts();
  const { data: campaigns } = useMarketingCampaigns();

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "contacts", label: "Contacts", count: contacts?.length },
    { id: "composer", label: "Composer" },
    { id: "history", label: "Historique", count: campaigns?.length },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy/10 text-burgundy">
          <IconMarketing className="h-5 w-5" />
        </span>
        <h1 className="font-display text-xl font-semibold text-burgundy sm:text-2xl">Marketing</h1>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-burgundy/10 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-burgundy text-cream" : "bg-white text-burgundy/70 hover:bg-cream"
            )}
          >
            {t.label}
            {typeof t.count === "number" && <span className="ml-1.5 opacity-70">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === "contacts" && <ContactsPanel />}
      {tab === "composer" && <CampaignComposer />}
      {tab === "history" && <CampaignHistory />}
    </div>
  );
}
