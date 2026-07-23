import type { FastifyInstance } from "fastify";
import { createManualRevenueSchema, Role } from "@le-tandoor/shared";
import { prisma } from "../../db.js";

const canManage = [Role.ADMIN, Role.MANAGER, Role.CAISSE];

export default async function manualRevenueRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(canManage));

  fastify.get("/api/manual-revenue", async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const entries = await prisma.manualRevenueEntry.findMany({
      where: {
        date: {
          gte: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
          lte: to ? new Date(`${to}T00:00:00.000Z`) : undefined,
        },
      },
      include: { creator: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    return reply.send(entries);
  });

  fastify.post("/api/manual-revenue", async (request, reply) => {
    const parsed = createManualRevenueSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
    }
    const entry = await prisma.manualRevenueEntry.create({
      data: {
        date: new Date(`${parsed.data.date}T00:00:00.000Z`),
        amount: parsed.data.amount,
        label: parsed.data.label,
        createdBy: request.user!.sub,
      },
      include: { creator: { select: { name: true } } },
    });
    return reply.code(201).send(entry);
  });

  fastify.delete("/api/manual-revenue/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.manualRevenueEntry.delete({ where: { id } });
    return reply.code(204).send();
  });
}
