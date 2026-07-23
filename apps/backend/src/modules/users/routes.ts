import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { createUserSchema, Role } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { recordAudit } from "../../audit.js";

export default async function usersRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole([Role.ADMIN]));

  fastify.get("/api/users", async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return reply.send(users);
  });

  fastify.post("/api/users", async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
    }
    const { name, email, password, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "Un compte existe déjà avec cet email" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
    });

    await recordAudit({
      userId: request.user!.sub,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      details: { email, role },
    });

    return reply.code(201).send({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  fastify.patch("/api/users/:id/active", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { active } = request.body as { active: boolean };

    const user = await prisma.user.update({ where: { id }, data: { active } });

    await recordAudit({
      userId: request.user!.sub,
      action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "User",
      entityId: id,
    });

    return reply.send({ id: user.id, active: user.active });
  });
}
