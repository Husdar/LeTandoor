import { EventEmitter } from "node:events";
import type { WebSocket } from "@fastify/websocket";
import type { WsEvent, WsMessage } from "@le-tandoor/shared";

const clients = new Set<WebSocket>();
let relaySocket: WebSocket | null = null;

/** Émet un événement "result" avec le payload d'un PRINT_JOB_RESULT reçu du relais d'impression. */
export const relayEvents = new EventEmitter();

export function registerClient(socket: WebSocket) {
  clients.add(socket);
  socket.on("close", () => clients.delete(socket));
}

export function registerRelay(socket: WebSocket) {
  relaySocket = socket;
  socket.on("close", () => {
    if (relaySocket === socket) relaySocket = null;
  });
}

export function isRelayConnected(): boolean {
  return relaySocket !== null && relaySocket.readyState === relaySocket.OPEN;
}

/** Envoie un message uniquement au relais d'impression connecté. Retourne false s'il est hors ligne. */
export function sendToRelay<T>(event: WsEvent, payload: T): boolean {
  if (!isRelayConnected()) return false;
  const message: WsMessage<T> = { event, payload, timestamp: new Date().toISOString() };
  relaySocket!.send(JSON.stringify(message));
  return true;
}

export function broadcast<T>(event: WsEvent, payload: T) {
  const message: WsMessage<T> = {
    event,
    payload,
    timestamp: new Date().toISOString(),
  };
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}
