import type { FastifyInstance } from "fastify";
import { createTableSchema, updateTableStatusSchema, Role, WsEvent } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { broadcast } from "../../ws/hub.js";

const canManageTables = [Role.ADMIN, Role.MANAGER];

export default async function tablesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/api/tables", async (_request, reply) => {
    const tables = await prisma.restaurantTable.findMany({ orderBy: { name: "asc" } });
    return reply.send(tables);
  });

  fastify.post(
    "/api/tables",
    { preHandler: fastify.requireRole(canManageTables) },
    async (request, reply) => {
      const parsed = createTableSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      const table = await prisma.restaurantTable.create({ data: parsed.data });
      return reply.code(201).send(table);
    }
  );

  fastify.patch(
    "/api/tables/:id",
    { preHandler: fastify.requireRole(canManageTables) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = createTableSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      const table = await prisma.restaurantTable.update({ where: { id }, data: parsed.data });
      broadcast(WsEvent.TABLE_UPDATED, table);
      return reply.send(table);
    }
  );

  fastify.patch("/api/tables/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateTableStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Statut invalide", details: parsed.error.flatten() });
    }
    const table = await prisma.restaurantTable.update({ where: { id }, data: { status: parsed.data.status } });
    broadcast(WsEvent.TABLE_UPDATED, table);
    return reply.send(table);
  });

  fastify.delete(
    "/api/tables/:id",
    { preHandler: fastify.requireRole(canManageTables) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.restaurantTable.delete({ where: { id } });
      return reply.code(204).send();
    }
  );
}
