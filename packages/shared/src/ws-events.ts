export const WsEvent = {
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_UPDATED: "ORDER_UPDATED",
  ORDER_ITEM_UPDATED: "ORDER_ITEM_UPDATED",
  ORDER_CLOSED: "ORDER_CLOSED",
  TABLE_UPDATED: "TABLE_UPDATED",
  RESERVATION_CREATED: "RESERVATION_CREATED",
  RESERVATION_UPDATED: "RESERVATION_UPDATED",
  PRINT_JOB_UPDATED: "PRINT_JOB_UPDATED",
} as const;
export type WsEvent = (typeof WsEvent)[keyof typeof WsEvent];

export interface WsMessage<T = unknown> {
  event: WsEvent;
  payload: T;
  timestamp: string;
}
