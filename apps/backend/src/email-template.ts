export const BRAND_COLORS = {
  burgundy: "#6E1423",
  burgundyLight: "#8C1B2E",
  burgundyDark: "#4A0D18",
  gold: "#C9A227",
  goldLight: "#E0C463",
  goldDark: "#9C7D1E",
  cream: "#FAF3E7",
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")}€`;
}

export function badgeHtml(label: string, bg: string, fg: string): string {
  return `<span style="display:inline-block;padding:6px 16px;border-radius:999px;background:${bg};color:${fg};font-size:13px;font-weight:700;letter-spacing:0.3px;">${label}</span>`;
}

/** Enveloppe HTML aux couleurs Le Tandoor (bordeaux/or), réutilisée pour les emails commande et marketing. */
export function brandedEmailShell(params: {
  badge?: string;
  heading: string;
  subheading?: string;
  bodyHtml: string;
}): string {
  const { badge, heading, subheading, bodyHtml } = params;
  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:0;background:${BRAND_COLORS.cream};font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_COLORS.cream};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(110,20,35,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_COLORS.burgundyLight},${BRAND_COLORS.burgundy} 60%,${BRAND_COLORS.burgundyDark});padding:32px 32px 26px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.08);border:1.5px solid ${BRAND_COLORS.gold};margin-bottom:14px;">
                <span style="font-size:24px;line-height:52px;">🔥</span>
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:${BRAND_COLORS.goldLight};letter-spacing:0.5px;">Le Tandoor</div>
              <div style="font-size:12px;color:#EADFCB;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px;">Cuisine indienne &amp; pakistanaise — Lorient</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 32px 8px;text-align:center;">
              ${badge ? badgeHtml(badge, BRAND_COLORS.cream, BRAND_COLORS.burgundy) : ""}
              <h1 style="margin:16px 0 4px;font-size:21px;color:${BRAND_COLORS.burgundy};font-weight:700;">${heading}</h1>
              ${subheading ? `<p style="margin:0;font-size:13px;color:#9C8C7A;">${subheading}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 6px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,${BRAND_COLORS.gold},transparent);margin:10px 0 4px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 8px;color:${BRAND_COLORS.burgundy};font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:26px 32px 30px;text-align:center;">
              <div style="height:1px;background:${BRAND_COLORS.cream};margin-bottom:20px;"></div>
              <p style="margin:0;font-size:12px;color:#B2A28D;">Le Tandoor — 1 Rue de Belgique, 56100 Lorient</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
