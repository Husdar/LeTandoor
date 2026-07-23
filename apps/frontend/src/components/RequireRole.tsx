import type { ReactNode } from "react";
import type { Role } from "@le-tandoor/shared";
import { useAuthStore } from "../store/auth";

export default function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="card max-w-md text-center">
          <p className="text-lg font-semibold text-burgundy">Accès refusé</p>
          <p className="mt-2 text-sm text-burgundy/70">
            Votre rôle ne permet pas d'accéder à cet espace.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
