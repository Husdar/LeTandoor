import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Role } from "@le-tandoor/shared";
import { useAuthStore } from "../store/auth";
import { api } from "../lib/api";
import { useT, type TranslationKey } from "../lib/i18n";
import LanguageToggle from "./LanguageToggle";
import AssistantWidget from "./AssistantWidget";
import ChangePasswordModal from "./ChangePasswordModal";

const NAV_ITEMS: { to: string; labelKey: TranslationKey; roles: Role[] }[] = [
  { to: "/commandes", labelKey: "nav.commandes", roles: [Role.ADMIN, Role.MANAGER, Role.SERVEUR] },
  { to: "/cuisine", labelKey: "nav.cuisine", roles: [Role.ADMIN, Role.MANAGER, Role.CUISINE] },
  { to: "/caisse", labelKey: "nav.caisse", roles: [Role.ADMIN, Role.MANAGER, Role.CAISSE] },
  { to: "/salle", labelKey: "nav.salle", roles: [Role.ADMIN, Role.MANAGER, Role.SERVEUR] },
  { to: "/reservations", labelKey: "nav.reservations", roles: [Role.ADMIN, Role.MANAGER, Role.SERVEUR] },
  { to: "/performances", labelKey: "nav.performances", roles: [Role.ADMIN, Role.MANAGER] },
  { to: "/conseils", labelKey: "nav.conseils", roles: [Role.ADMIN, Role.MANAGER] },
  { to: "/admin", labelKey: "nav.admin", roles: [Role.ADMIN] },
];

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useT();
  const [changingPassword, setChangingPassword] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  // La page Commandes reste toujours en français / LTR, quel que soit le réglage de langue.
  const isCommandesRoute = location.pathname.startsWith("/commandes");
  const contentIsUrdu = lang === "ur" && !isCommandesRoute;

  async function handleLogout() {
    await api.post("/auth/logout").catch(() => undefined);
    clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen flex-col bg-cream">
      <header
        className={clsx(
          "flex items-center justify-between bg-burgundy px-6 py-3 text-cream shadow-lg",
          lang === "ur" && "flex-row-reverse"
        )}
        dir={lang === "ur" ? "rtl" : "ltr"}
        style={{ boxShadow: "0 4px 16px -4px rgba(74, 13, 24, 0.35)" }}
      >
        <div className={clsx("flex items-center gap-3", lang === "ur" && "flex-row-reverse")}>
          <LanguageToggle />
          <span className="font-display text-2xl font-bold tracking-wide text-gold">Le Tandoor</span>
          <span className={clsx("hidden text-sm text-cream/70 sm:inline", lang === "ur" && "font-urdu text-base")}>
            {t("layout.subtitle")}
          </span>
        </div>
        <div className={clsx("flex items-center gap-4", lang === "ur" && "flex-row-reverse")}>
          <button
            onClick={() => setChangingPassword(true)}
            title={t("changePassword.open")}
            className="text-sm text-cream/90 underline-offset-2 hover:underline"
          >
            {user?.name} <span className="text-gold">· {user?.role}</span>
          </button>
          <button
            onClick={handleLogout}
            className={clsx("btn-outline !border-cream/30 !text-cream !bg-transparent", lang === "ur" && "font-urdu text-base")}
          >
            {t("layout.logout")}
          </button>
        </div>
      </header>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}

      <nav
        className={clsx(
          "flex gap-1 overflow-x-auto border-b border-burgundy/10 bg-white px-4",
          lang === "ur" && "flex-row-reverse"
        )}
        dir={lang === "ur" ? "rtl" : "ltr"}
      >
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                "tap-target flex items-center border-b-[3px] px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200",
                lang === "ur" && "font-urdu text-base",
                isActive
                  ? "border-gold text-burgundy"
                  : "border-transparent text-burgundy/50 hover:border-gold/30 hover:text-burgundy"
              )
            }
          >
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <main
        className={clsx("flex-1 overflow-auto", contentIsUrdu && "font-urdu text-lg")}
        dir={contentIsUrdu ? "rtl" : "ltr"}
      >
        <Outlet />
      </main>

      <AssistantWidget />
    </div>
  );
}
