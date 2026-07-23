import type { FastifyInstance } from "fastify";
import { createMenuCategorySchema, createMenuItemSchema, Role } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { recordAudit } from "../../audit.js";

const canManageMenu = [Role.ADMIN, Role.MANAGER];

export default async function menuRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/api/menu/categories", async (_request, reply) => {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { position: "asc" },
      include: {
        items: {
          include: { options: true },
          orderBy: { name: "asc" },
        },
      },
    });
    return reply.send(categories);
  });

  fastify.post(
    "/api/menu/categories",
    { preHandler: fastify.requireRole(canManageMenu) },
    async (request, reply) => {
      const parsed = createMenuCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      const category = await prisma.menuCategory.create({ data: parsed.data });
      return reply.code(201).send(category);
    }
  );

  fastify.patch(
    "/api/menu/categories/:id",
    { preHandler: fastify.requireRole(canManageMenu) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = createMenuCategorySchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      const category = await prisma.menuCategory.update({ where: { id }, data: parsed.data });
      return reply.send(category);
    }
  );

  fastify.delete(
    "/api/menu/categories/:id",
    { preHandler: fastify.requireRole(canManageMenu) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.menuCategory.delete({ where: { id } });
      return reply.code(204).send();
    }
  );

  fastify.post(
    "/api/menu/items",
    { preHandler: fastify.requireRole(canManageMenu) },
    async (request, reply) => {
      const parsed = createMenuItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      const { categoryId, name, description, price, active, options } = parsed.data;

      const item = await prisma.menuItem.create({
        data: {
          categoryId,
          name,
          description,
          price,
          active,
          options: { create: options.map((o) => ({ name: o.name, priceDelta: o.priceDelta, groupName: o.groupName })) },
        },
        include: { options: true },
      });

      await recordAudit({
        userId: request.user!.sub,
        action: "MENU_ITEM_CREATED",
        entityType: "MenuItem",
        entityId: item.id,
        details: { name, price },
      });

      return reply.code(201).send(item);
    }
  );

  fastify.patch(
    "/api/menu/items/:id",
    { preHandler: fastify.requireRole(canManageMenu) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = createMenuItemSchema.partial().omit({ options: true }).safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      const item = await prisma.menuItem.update({ where: { id }, data: parsed.data });
      return reply.send(item);
    }
  );

  fastify.delete(
    "/api/menu/items/:id",
    { preHandler: fastify.requireRole(canManageMenu) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      // On désactive plutôt que supprimer : l'historique des commandes référence ces plats.
      const item = await prisma.menuItem.update({ where: { id }, data: { active: false } });
      return reply.send(item);
    }
  );
}
