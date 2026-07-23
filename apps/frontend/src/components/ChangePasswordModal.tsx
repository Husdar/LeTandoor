import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "../lib/api";
import { useT } from "../lib/i18n";

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT();
  const urdu = lang === "ur";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const changePassword = useMutation({
    mutationFn: () => api.post("/auth/change-password", { currentPassword, newPassword }),
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err instanceof ApiError ? err.message : t("changePassword.error")),
  });

  function handleSubmit() {
    if (newPassword.length < 8) {
      setError(t("changePassword.tooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("changePassword.mismatch"));
      return;
    }
    setError(null);
    changePassword.mutate();
  }

  return (
    <div className="modal-overlay">
      <div className={clsx("modal-panel w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl", urdu && "font-urdu")}>
        <h2 className="mb-4 font-display text-xl font-semibold text-burgundy">{t("changePassword.title")}</h2>

        {success ? (
          <div>
            <p className="text-sm font-medium text-green-700">{t("changePassword.success")}</p>
            <button className="btn-primary mt-4 w-full" onClick={onClose}>
              {t("printerWizard.back") /* "Retour" — libellé générique déjà traduit */}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <input
                className="input"
                type="password"
                placeholder={t("changePassword.current")}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder={t("changePassword.new")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder={t("changePassword.confirm")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button className="btn-outline flex-1" onClick={onClose}>
                {t("reservation.cancel")}
              </button>
              <button
                className="btn-primary flex-1"
                disabled={changePassword.isPending || !currentPassword || !newPassword}
                onClick={handleSubmit}
              >
                {changePassword.isPending ? t("changePassword.saving") : t("changePassword.submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
