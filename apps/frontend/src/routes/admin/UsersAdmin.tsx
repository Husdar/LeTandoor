import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Role, type CreateUserInput } from "@le-tandoor/shared";
import { api, ApiError } from "../../lib/api";
import { useT, type TranslationKey } from "../../lib/i18n";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

const ROLE_KEYS: Record<Role, TranslationKey> = {
  [Role.ADMIN]: "role.ADMIN",
  [Role.MANAGER]: "role.MANAGER",
  [Role.SERVEUR]: "role.SERVEUR",
  [Role.CUISINE]: "role.CUISINE",
  [Role.CAISSE]: "role.CAISSE",
};

export default function UsersAdmin() {
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get<UserRow[]>("/users") });
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const urdu = lang === "ur";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(Role.SERVEUR);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  const createUser = useMutation({
    mutationFn: (input: CreateUserInput) => api.post("/users", input),
    onSuccess: () => {
      invalidate();
      setName("");
      setEmail("");
      setPassword("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("menuAdmin.error")),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/users/${id}/active`, { active }),
    onSuccess: invalidate,
  });

  function handleCreate() {
    if (!name || !email || password.length < 8) {
      setError(t("usersAdmin.validation"));
      return;
    }
    setError(null);
    createUser.mutate({ name, email, password, role });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className={clsx("mb-2 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
          {t("usersAdmin.newAccount")}
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            className="input"
            placeholder={t("usersAdmin.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder={t("usersAdmin.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            placeholder={t("usersAdmin.passwordPlaceholder")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {Object.values(Role).map((r) => (
              <option key={r} value={r}>
                {t(ROLE_KEYS[r])}
              </option>
            ))}
          </select>
          <button className={clsx("btn-primary", urdu && "font-urdu text-base")} onClick={handleCreate}>
            {t("usersAdmin.create")}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
      </div>

      <div className="card divide-y divide-burgundy/10">
        {users?.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-2">
            <div>
              <p className={u.active ? "font-medium text-burgundy" : "font-medium text-burgundy/40"}>{u.name}</p>
              <p className="text-xs text-burgundy/50">
                {u.email} · {t(ROLE_KEYS[u.role])}
              </p>
            </div>
            <button
              className={clsx(u.active ? "text-sm text-red-600" : "text-sm text-green-700", urdu && "font-urdu text-base")}
              onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
            >
              {u.active ? t("usersAdmin.deactivate") : t("usersAdmin.reactivate")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
