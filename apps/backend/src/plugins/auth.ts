import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import type { Role } from "@le-tandoor/shared";
import { env } from "../env.js";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  name: string;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      roles: Role[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions["expiresIn"] });
}

export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}

export default fp(async (fastify) => {
  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!token) {
      return reply.code(401).send({ error: "Authentification requise" });
    }
    try {
      const payload = jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
      request.user = payload;
    } catch {
      return reply.code(401).send({ error: "Session expirée ou invalide" });
    }
  });

  fastify.decorate("requireRole", (roles: Role[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.code(401).send({ error: "Authentification requise" });
      }
      if (!roles.includes(request.user.role)) {
        return reply.code(403).send({ error: "Accès refusé pour ce rôle" });
      }
    };
  });
});
