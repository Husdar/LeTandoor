export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export const ORDER_TYPE_LABELS: Record<string, string> = {
  SUR_PLACE: "Sur place",
  EMPORTER: "À emporter",
  LIVRAISON: "Livraison",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NOUVELLE: "Nouvelle",
  EN_PREPARATION: "En préparation",
  PRETE: "Prête",
  SERVIE: "Servie",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

export const ORDER_ITEM_STATUS_LABELS: Record<string, string> = {
  NOUVELLE: "Nouvelle",
  EN_PREPARATION: "En préparation",
  PRETE: "Prête",
  SERVIE: "Servie",
  ANNULE: "Annulée",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  NOUVELLE: "bg-gold/20 text-gold-dark",
  EN_PREPARATION: "bg-blue-100 text-blue-800",
  PRETE: "bg-green-100 text-green-800",
  SERVIE: "bg-burgundy/10 text-burgundy",
  TERMINEE: "bg-gray-100 text-gray-500",
  ANNULEE: "bg-red-100 text-red-700",
};

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  ARRIVEE: "Arrivée",
  ANNULEE: "Annulée",
  ABSENTE: "Absente",
};

export const RESERVATION_STATUS_COLORS: Record<string, string> = {
  EN_ATTENTE: "bg-gold/20 text-gold-dark",
  CONFIRMEE: "bg-blue-100 text-blue-800",
  ARRIVEE: "bg-green-100 text-green-800",
  ANNULEE: "bg-red-100 text-red-700",
  ABSENTE: "bg-gray-100 text-gray-500",
};

/** Couleur d'accent (bordure gauche) des cartes de commande, alignée sur ORDER_STATUS_COLORS. */
export const ORDER_STATUS_ACCENT: Record<string, string> = {
  NOUVELLE: "border-l-gold",
  EN_PREPARATION: "border-l-blue-400",
  PRETE: "border-l-green-500",
  SERVIE: "border-l-burgundy/40",
  TERMINEE: "border-l-gray-300",
  ANNULEE: "border-l-red-400",
};

/** Couleur par type de commande (sur place / à emporter / livraison), pour repérer le canal d'un coup d'œil. */
export const ORDER_TYPE_ACCENT: Record<string, string> = {
  SUR_PLACE: "border-l-burgundy",
  EMPORTER: "border-l-amber-500",
  LIVRAISON: "border-l-blue-500",
};

export const ORDER_TYPE_TEXT: Record<string, string> = {
  SUR_PLACE: "text-burgundy",
  EMPORTER: "text-amber-700",
  LIVRAISON: "text-blue-700",
};

/** Numéro affiché au client/personnel : celui du site web (externalRef) s'il existe, sinon le
 * numéro interne — pour qu'une commande "site web" porte le même numéro partout (app, ticket,
 * email de confirmation), au lieu d'un numéro interne différent de celui vu par le client. */
export function displayOrderRef(order: { orderNumber: number; externalRef?: string | null }): string {
  return order.externalRef ?? String(order.orderNumber);
}

/** Retire un suffixe descriptif entre parenthèses en fin de nom (ex: "Butter Chicken (spécialité
 * du chef)" -> "Butter Chicken"), pour l'aperçu du ticket cuisine simplifié. */
export function shortenItemName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

interface CategorizedItem {
  menuItem?: { category?: { name: string; position: number } | null } | null;
}

/** Regroupe et trie les articles par catégorie (position croissante), exactement comme le ticket
 * cuisine physique (voir ticket-builder.ts côté backend) — pour que l'aperçu dans l'appli
 * corresponde vraiment à ce qui sort de l'imprimante. */
export function groupItemsByCategory<T extends CategorizedItem>(items: T[]): { categoryName: string; items: T[] }[] {
  const groups = new Map<string, { categoryName: string; position: number; items: T[] }>();
  for (const item of items) {
    const category = item.menuItem?.category;
    const key = category?.name ?? "__autres__";
    if (!groups.has(key)) {
      groups.set(key, { categoryName: category?.name ?? "Autres", position: category?.position ?? Number.MAX_SAFE_INTEGER, items: [] });
    }
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()].sort((a, b) => a.position - b.position);
}
