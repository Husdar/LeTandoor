import { useState } from "react";
import clsx from "clsx";
import { useT, type TranslationKey } from "../../lib/i18n";
import MenuAdmin from "./MenuAdmin";
import TablesAdmin from "./TablesAdmin";
import UsersAdmin from "./UsersAdmin";
import PrintersAdmin from "./PrintersAdmin";

const TABS: { key: "menu" | "tables" | "users" | "printers"; labelKey: TranslationKey }[] = [
  { key: "menu", labelKey: "admin.tab.menu" },
  { key: "tables", labelKey: "admin.tab.tables" },
  { key: "users", labelKey: "admin.tab.users" },
  { key: "printers", labelKey: "admin.tab.printers" },
];

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("menu");
  const { t, lang } = useT();
  const urdu = lang === "ur";

  return (
    <div className="p-6">
      <h1 className={clsx("mb-4 font-display text-2xl font-semibold text-burgundy", urdu && "font-urdu")}>
        {t("admin.title")}
      </h1>
      <div className="mb-4 flex gap-2">
        {TABS.map((tItem) => (
          <button
            key={tItem.key}
            onClick={() => setTab(tItem.key)}
            className={clsx(tab === tItem.key ? "btn-primary" : "btn-outline", urdu && "font-urdu text-base")}
          >
            {t(tItem.labelKey)}
          </button>
        ))}
      </div>
      {tab === "menu" && <MenuAdmin />}
      {tab === "tables" && <TablesAdmin />}
      {tab === "users" && <UsersAdmin />}
      {tab === "printers" && <PrintersAdmin />}
    </div>
  );
}
