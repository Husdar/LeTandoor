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
import {
  IconOrders,
  IconKitchen,
  IconCashier,
  IconFloorPlan,
  IconReservations,
  IconPerformance,
  IconAdvice,
  IconAdmin,
  IconMenu,
  IconClose,
  LogoMark,
} from "./icons";

const NAV_ITEMS: { to: string; labelKey: TranslationKey; roles: Role[]; icon: typeof IconOrders }[] = [
  { to: "/commandes", labelKey: "nav.commandes", roles: [Role.ADMIN, Role.MANAGER, Role.SERVEUR], icon: IconOrders },
  { to: "/cuisine", labelKey: "nav.cuisine", roles: [Role.ADMIN, Role.MANAGER, Role.CUISINE], icon: IconKitchen },
  { to: "/caisse", labelKey: "nav.caisse", roles: [Role.ADMIN, Role.MANAGER, Role.CAISSE], icon: IconCashier },
  { to: "/salle", labelKey: "nav.salle", roles: [Role.ADMIN, Role.MANAGER, Role.SERVEUR], icon: IconFloorPlan },
  { to: "/reservations", labelKey: "nav.reservations", roles: [Role.ADMIN, Role.MANAGER, Role.SERVEUR], icon: IconReservations },
  { to: "/performances", labelKey: "nav.performances", roles: [Role.ADMIN, Role.MANAGER], icon: IconPerformance },
  { to: "/conseils", labelKey: "nav.conseils", roles: [Role.ADMIN, Role.MANAGER], icon: IconAdvice },
  { to: "/admin", labelKey: "nav.admin", roles: [Role.ADMIN], icon: IconAdmin },
];

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useT();
  const [changingPassword, setChangingPassword] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));
  const urdu = lang === "ur";

  // La page Commandes reste toujours en français / LTR, quel que soit le réglage de langue.
  const isCommandesRoute = location.pathname.startsWith("/commandes");
  const contentIsUrdu = urdu && !isCommandesRoute;

  async function handleLogout() {
    await api.post("/auth/logout").catch(() => undefined);
    clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen flex-col bg-cream">
      <header
        className={clsx(
          "flex items-center justify-between bg-gradient-to-b from-burgundy-light to-burgundy px-4 py-3 text-cream sm:px-6",
          urdu && "flex-row-reverse"
        )}
        dir={urdu ? "rtl" : "ltr"}
        style={{ boxShadow: "0 4px 20px -4px rgba(74, 13, 24, 0.45)" }}
      >
        <div className={clsx("flex min-w-0 items-center gap-2 sm:gap-3", urdu && "flex-row-reverse")}>
          <LanguageToggle />
          <LogoMark className="hidden h-9 w-9 shrink-0 text-gold sm:block" />
          <span className="truncate font-display text-lg font-bold tracking-wide text-gold sm:text-2xl">Le Tandoor</span>
          <span className={clsx("hidden text-sm text-cream/70 sm:inline", urdu && "font-urdu text-base")}>
            {t("layout.subtitle")}
          </span>
        </div>

        {/* Écrans larges : tout affiché en ligne. Sur mobile, un seul bouton menu ouvre le tiroir ci-dessous. */}
        <div className={clsx("hidden items-center gap-4 sm:flex", urdu && "flex-row-reverse")}>
          <button
            onClick={() => setChangingPassword(true)}
            title={t("changePassword.open")}
            className={clsx("group flex items-center gap-2 text-sm text-cream/90", urdu && "flex-row-reverse")}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold ring-1 ring-gold/40">
              {user?.name?.trim().charAt(0).toUpperCase() ?? "?"}
            </span>
            <span className="underline-offset-2 group-hover:underline">
              {user?.name} <span className="text-gold">· {user?.role}</span>
            </span>
          </button>
          <button
            onClick={handleLogout}
            className={clsx("btn-outline !border-cream/30 !text-cream !bg-transparent", urdu && "font-urdu text-base")}
          >
            {t("layout.logout")}
          </button>
        </div>

        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? t("layout.closeMenu") : t("layout.openMenu")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gold transition hover:bg-cream/10 sm:hidden"
        >
          {mobileMenuOpen ? <IconClose className="h-6 w-6" /> : <IconMenu className="h-6 w-6" />}
        </button>
      </header>

      {/* Tiroir de navigation mobile : remplace la barre horizontale + regroupe compte/langue/déconnexion. */}
      {mobileMenuOpen && (
        <div className="border-b border-burgundy/10 bg-white p-3 shadow-md sm:hidden" dir={urdu ? "rtl" : "ltr"}>
          <nav className="flex flex-col gap-1">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    "tap-target flex items-center gap-3 rounded-xl px-4 text-base font-medium transition-colors",
                    urdu && "font-urdu text-lg",
                    isActive ? "bg-gold/15 text-burgundy" : "text-burgundy/60 hover:bg-cream"
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-burgundy/10 pt-3">
            <button
              onClick={() => {
                setChangingPassword(true);
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 text-sm text-burgundy/70"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold-dark ring-1 ring-gold/30">
                {user?.name?.trim().charAt(0).toUpperCase() ?? "?"}
              </span>
              <span className="underline-offset-2 hover:underline">
                {user?.name} · {user?.role}
              </span>
            </button>
          </div>
          <button onClick={handleLogout} className="btn-outline mt-3 w-full">
            {t("layout.logout")}
          </button>
        </div>
      )}

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}

      <nav
        className={clsx("hidden gap-1 overflow-x-auto border-b border-burgundy/10 bg-white px-4 sm:flex", urdu && "flex-row-reverse")}
        dir={urdu ? "rtl" : "ltr"}
      >
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-medium transition-all duration-200",
                urdu && "font-urdu text-base",
                isActive
                  ? "border-gold text-burgundy"
                  : "border-transparent text-burgundy/50 hover:border-gold/30 hover:text-burgundy"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
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
