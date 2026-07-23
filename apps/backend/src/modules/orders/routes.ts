import type { FastifyInstance } from "fastify";
import {
  createOrderSchema,
  addOrderItemSchema,
  updateOrderItemStatusSchema,
  updateOrderStatusSchema,
  advanceOrderItemsSchema,
  closeOrderSchema,
  PrintTicketType,
  Role,
} from "@le-tandoor/shared";
import {
  createOrder,
  addOrderItem,
  updateOrderItemStatus,
  advanceOrderItems,
  updateOrderStatus,
  closeOrder,
  listActiveOrders,
  getOrder,
} from "./service.js";
import { printOrder } from "../print/service.js";

const canTakeOrders = [Role.ADMIN, Role.MANAGER, Role.SERVEUR];
const canUpdateItemStatus = [Role.ADMIN, Role.MANAGER, Role.SERVEUR, Role.CUISINE];
const canClose = [Role.ADMIN, Role.MANAGER, Role.CAISSE];
const canPrint = [Role.ADMIN, Role.MANAGER, Role.SERVEUR, Role.CUISINE, Role.CAISSE];

export default async function ordersRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/api/orders/active", async (_request, reply) => {
    const orders = await listActiveOrders();
    return reply.send(orders);
  });

  fastify.get("/api/orders/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const order = await getOrder(id);
      return reply.send(order);
    } catch {
      return reply.code(404).send({ error: "Commande introuvable" });
    }
  });

  fastify.post(
    "/api/orders",
    { preHandler: fastify.requireRole(canTakeOrders) },
    async (request, reply) => {
      const parsed = createOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      try {
        const order = await createOrder(parsed.data, request.user!.sub);
        return reply.code(201).send(order);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  fastify.post(
    "/api/orders/:id/items",
    { preHandler: fastify.requireRole(canTakeOrders) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = addOrderItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      try {
        const order = await addOrderItem(id, parsed.data, request.user!.sub);
        return reply.send(order);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  fastify.patch(
    "/api/orders/:id/items/:itemId/status",
    { preHandler: fastify.requireRole(canUpdateItemStatus) },
    async (request, reply) => {
      const { itemId } = request.params as { id: string; itemId: string };
      const parsed = updateOrderItemStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Statut invalide", details: parsed.error.flatten() });
      }
      try {
        const order = await updateOrderItemStatus(
          itemId,
          parsed.data.status,
          parsed.data.reason,
          request.user!.sub
        );
        return reply.send(order);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  fastify.patch(
    "/api/orders/:id/advance",
    { preHandler: fastify.requireRole(canUpdateItemStatus) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = advanceOrderItemsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Statut invalide", details: parsed.error.flatten() });
      }
      try {
        const order = await advanceOrderItems(id, parsed.data.status, request.user!.sub);
        return reply.send(order);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  fastify.patch(
    "/api/orders/:id/status",
    { preHandler: fastify.requireRole(canTakeOrders) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateOrderStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Statut invalide", details: parsed.error.flatten() });
      }
      try {
        const order = await updateOrderStatus(id, parsed.data.status, parsed.data.reason, request.user!.sub);
        return reply.send(order);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  fastify.post(
    "/api/orders/:id/close",
    { preHandler: fastify.requireRole(canClose) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = closeOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      try {
        const order = await closeOrder(id, parsed.data, request.user!.sub);
        return reply.send(order);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  fastify.post(
    "/api/orders/:id/print/:ticketType",
    { preHandler: fastify.requireRole(canPrint) },
    async (request, reply) => {
      const { id, ticketType } = request.params as { id: string; ticketType: string };
      if (ticketType !== PrintTicketType.CUISINE && ticketType !== PrintTicketType.RECU) {
        return reply.code(400).send({ error: "Type de ticket invalide" });
      }
      try {
        const jobs = await printOrder(id, ticketType);
        return reply.send(jobs);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );
}
