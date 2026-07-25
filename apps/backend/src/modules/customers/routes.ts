import type { FastifyInstance } from "fastify";
import { Role } from "@le-tandoor/shared";
import { listCustomers } from "./service.js";

const canView = [Role.ADMIN, Role.MANAGER];

export default async function customersRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(canView));

  fastify.get("/api/customers", async (_request, reply) => {
    const customers = await listCustomers();
    return reply.send(customers);
  });
}
