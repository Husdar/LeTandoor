import type { WebSocket } from "@fastify/websocket";
import type { WsEvent, WsMessage } from "@le-tandoor/shared";

const clients = new Set<WebSocket>();

export function registerClient(socket: WebSocket) {
  clients.add(socket);
  socket.on("close", () => clients.delete(socket));
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
