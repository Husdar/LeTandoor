import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { WsEvent } from "@le-tandoor/shared";
import { env } from "../env.js";
import { registerClient, registerRelay, relayEvents } from "./hub.js";

export default async function wsRoute(fastify: FastifyInstance) {
  fastify.get("/ws", { websocket: true }, (socket, request) => {
    const query = request.query as { token?: string; relayToken?: string };

    if (query.relayToken !== undefined) {
      if (!env.printRelayToken || query.relayToken !== env.printRelayToken) {
        socket.close(4001, "Jeton de relais invalide");
        return;
      }
      registerRelay(socket);
      socket.on("message", (raw: Buffer) => {
        let message: { event?: string; payload?: unknown };
        try {
          message = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (message.event === WsEvent.PRINT_JOB_RESULT) {
          relayEvents.emit("result", message.payload);
        }
      });
      return;
    }

    const token = query.token;
    if (!token) {
      socket.close(4001, "Authentification requise");
      return;
    }
    try {
      jwt.verify(token, env.jwtSecret);
    } catch {
      socket.close(4001, "Authentification invalide");
      return;
    }
    registerClient(socket);
  });
}
