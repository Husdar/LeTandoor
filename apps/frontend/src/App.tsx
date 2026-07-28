import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Role } from "@le-tandoor/shared";
import { useAuthStore } from "./store/auth";
import { refreshSession } from "./lib/api";
import { useRealtimeSync } from "./lib/ws";
import { initAudioUnlock } from "./lib/sound";
import { useWakeLock } from "./hooks/useWakeLock";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import LoginPage from "./routes/LoginPage";

// Chargées à la demande (une seule route à la fois est réellement utile à un instant donné) —
// avant ce découpage, tout partait dans un unique bundle de 760 Ko (dont Recharts, utilisé
// uniquement par Performances), téléchargé et exécuté même pour ouvrir simplement Commandes.
const CommandesPage = lazy(() => import("./routes/commandes/CommandesPage"));
const CaissePage = lazy(() => import("./routes/caisse/CaissePage"));
const SallePage = lazy(() => import("./routes/salle/SallePage"));
const ReservationsPage = lazy(() => import("./routes/reservations/ReservationsPage"));
const PerformancesPage = lazy(() => import("./routes/performances/PerformancesPage"));
const ConseilsPage = lazy(() => import("./routes/conseils/ConseilsPage"));
const ClientsPage = lazy(() => import("./routes/clients/ClientsPage"));
const HistoriquePage = lazy(() => import("./routes/historique/HistoriquePage"));
const AdminPage = lazy(() => import("./routes/admin/AdminPage"));

export default function App() {
  const initialized = useAuthStore((s) => s.initialized);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    refreshSession().finally(() => setInitialized(true));
  }, [setInitialized]);

  useEffect(() => {
    initAudioUnlock();
  }, []);

  useRealtimeSync();
  useWakeLock();

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream">
        <span className="font-display text-xl text-burgundy">Le Tandoor</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/commandes" replace />} />
          <Route
            path="/commandes"
            element={
              <RequireRole roles={[Role.ADMIN, Role.MANAGER, Role.SERVEUR, Role.CUISINE]}>
                <CommandesPage />
              </RequireRole>
            }
          />
          <Route
            path="/caisse"
            element={
              <RequireRole roles={[Role.ADMIN, Role.MANAGER, Role.CAISSE]}>
                <CaissePage />
              </RequireRole>
            }
          />
          <Route
            path="/salle"
            element={
              <RequireRole roles={[Role.ADMIN, Role.MANAGER, Role.SERVEUR]}>
                <SallePage />
              </RequireRole>
            }
          />
          <Route
            path="/reservations"
            element={
              <RequireRole roles={[Role.ADMIN, Role.MANAGER, Role.SERVEUR]}>
                <ReservationsPage />
              </RequireRole>
            }
          />
          <Route
            path="/performances"
            element={
              <RequireRole roles={[Role.ADMIN, Role.MANAGER]}>
                <PerformancesPage />
              </RequireRole>
            }
          />
          <Route
            path="/conseils"
            element={
              <RequireRole roles={[Role.ADMIN, Role.MANAGER]}>
                <ConseilsPage />
              </RequireRole>
            }
          />
          <Route
            path="/clients"
            element={
              <RequireRole roles={[Role.ADMIN, Role.MANAGER]}>
                <ClientsPage />
              </RequireRole>
            }
          />
          <Route
            path="/historique"
            element={
              <RequireRole roles={[Role.ADMIN, Role.MANAGER]}>
                <HistoriquePage />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole roles={[Role.ADMIN]}>
                <AdminPage />
              </RequireRole>
            }
          />
          {/* Toute URL inconnue (ex: un ancien lien /marketing supprimé) renvoie vers l'accueil
              plutôt que d'afficher une page blanche. */}
          <Route path="*" element={<Navigate to="/commandes" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
