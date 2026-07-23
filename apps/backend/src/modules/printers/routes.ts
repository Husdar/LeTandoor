import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPrinterSchema, testPrinterSchema, Role } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { testPrinterConnection } from "../print/service.js";

const canManagePrinters = [Role.ADMIN, Role.MANAGER];

export default async function printersRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(canManagePrinters));

  fastify.get("/api/printers", async (_request, reply) => {
    const printers = await prisma.printer.findMany({ orderBy: { name: "asc" } });
    return reply.send(printers);
  });

  fastify.post("/api/printers/test", async (request, reply) => {
    const parsed = testPrinterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Adresse IP ou port invalide" });
    }
    try {
      await testPrinterConnection(parsed.data.ip, parsed.data.port);
      return reply.send({ success: true });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  fastify.post("/api/printers", async (request, reply) => {
    const parsed = createPrinterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
    }
    const printer = await prisma.printer.create({ data: parsed.data });
    return reply.code(201).send(printer);
  });

  fastify.patch("/api/printers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createPrinterSchema.partial().extend({ active: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
    }
    const printer = await prisma.printer.update({ where: { id }, data: parsed.data });
    return reply.send(printer);
  });

  fastify.delete("/api/printers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.printer.delete({ where: { id } });
    } catch {
      return reply
        .code(409)
        .send({ error: "Impossible de supprimer : cette imprimante a un historique d'impression. Désactivez-la à la place." });
    }
    return reply.code(204).send();
  });
}
