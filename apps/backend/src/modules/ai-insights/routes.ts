import type { FastifyInstance } from "fastify";
import { Role } from "@le-tandoor/shared";
import { generateInsight, listInsights } from "./service.js";

const canView = [Role.ADMIN, Role.MANAGER];

export default async function aiInsightsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(canView));

  fastify.get("/api/ai-insights", async (_request, reply) => {
    const insights = await listInsights();
    return reply.send(insights);
  });

  fastify.post("/api/ai-insights/generate", async (_request, reply) => {
    try {
      const insight = await generateInsight();
      return reply.code(201).send(insight);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
}
