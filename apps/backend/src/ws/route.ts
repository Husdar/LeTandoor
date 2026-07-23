import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { registerClient } from "./hub.js";

export default async function wsRoute(fastify: FastifyInstance) {
  fastify.get("/ws", { websocket: true }, (socket, request) => {
    const token = (request.query as { token?: string }).token;
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
