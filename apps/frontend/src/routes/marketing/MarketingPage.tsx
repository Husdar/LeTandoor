import ContactsPanel from "./ContactsPanel";
import CampaignComposer from "./CampaignComposer";
import CampaignHistory from "./CampaignHistory";

export default function MarketingPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 font-display text-2xl font-semibold text-burgundy">Marketing</h1>

      <div className="mb-4">
        <ContactsPanel />
      </div>

      <div className="mb-4">
        <CampaignComposer />
      </div>

      <CampaignHistory />
    </div>
  );
}
