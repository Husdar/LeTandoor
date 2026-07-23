export const Role = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  SERVEUR: "SERVEUR",
  CUISINE: "CUISINE",
  CAISSE: "CAISSE",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const OrderType = {
  SUR_PLACE: "SUR_PLACE",
  EMPORTER: "EMPORTER",
  LIVRAISON: "LIVRAISON",
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderStatus = {
  NOUVELLE: "NOUVELLE",
  EN_PREPARATION: "EN_PREPARATION",
  PRETE: "PRETE",
  SERVIE: "SERVIE",
  TERMINEE: "TERMINEE",
  ANNULEE: "ANNULEE",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderItemStatus = {
  NOUVELLE: "NOUVELLE",
  EN_PREPARATION: "EN_PREPARATION",
  PRETE: "PRETE",
  SERVIE: "SERVIE",
  ANNULE: "ANNULE",
} as const;
export type OrderItemStatus = (typeof OrderItemStatus)[keyof typeof OrderItemStatus];

export const TableStatus = {
  LIBRE: "LIBRE",
  RESERVEE: "RESERVEE",
  OCCUPEE: "OCCUPEE",
  A_NETTOYER: "A_NETTOYER",
} as const;
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];

export const ReservationStatus = {
  EN_ATTENTE: "EN_ATTENTE",
  CONFIRMEE: "CONFIRMEE",
  ARRIVEE: "ARRIVEE",
  ANNULEE: "ANNULEE",
  ABSENTE: "ABSENTE",
} as const;
export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const PaymentMethod = {
  ESPECES: "ESPECES",
  CARTE: "CARTE",
  TICKET_RESTAURANT: "TICKET_RESTAURANT",
  AUTRE: "AUTRE",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PrintTarget = {
  CUISINE: "CUISINE",
  CAISSE: "CAISSE",
  BAR: "BAR",
} as const;
export type PrintTarget = (typeof PrintTarget)[keyof typeof PrintTarget];

export const PrintJobStatus = {
  EN_ATTENTE: "EN_ATTENTE",
  IMPRIME: "IMPRIME",
  ECHEC: "ECHEC",
} as const;
export type PrintJobStatus = (typeof PrintJobStatus)[keyof typeof PrintJobStatus];

export const PrintTicketType = {
  CUISINE: "CUISINE",
  RECU: "RECU",
} as const;
export type PrintTicketType = (typeof PrintTicketType)[keyof typeof PrintTicketType];

export const OrderSource = {
  MANUEL: "MANUEL",
  SITE_WEB: "SITE_WEB",
} as const;
export type OrderSource = (typeof OrderSource)[keyof typeof OrderSource];

export const EmailIngestStatus = {
  TRAITE: "TRAITE",
  ECHEC: "ECHEC",
  IGNORE: "IGNORE",
} as const;
export type EmailIngestStatus = (typeof EmailIngestStatus)[keyof typeof EmailIngestStatus];
