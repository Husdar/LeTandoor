import type { FastifyInstance } from "fastify";
import { Role } from "@le-tandoor/shared";
import { getDashboardStats } from "./service.js";

const canView = [Role.ADMIN, Role.MANAGER];

export default async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(canView));

  fastify.get("/api/analytics/dashboard", async (_request, reply) => {
    const stats = await getDashboardStats();
    return reply.send(stats);
  });
}
