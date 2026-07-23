import type { FastifyInstance } from "fastify";
import {
  createReservationSchema,
  updateReservationStatusSchema,
  ReservationStatus,
  TableStatus,
  Role,
  WsEvent,
} from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { broadcast } from "../../ws/hub.js";
import { recordAudit } from "../../audit.js";

const canManageReservations = [Role.ADMIN, Role.MANAGER, Role.SERVEUR];

export default async function reservationsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/api/reservations", async (_request, reply) => {
    const reservations = await prisma.reservation.findMany({
      where: { status: { notIn: [ReservationStatus.ANNULEE] } },
      include: { table: true },
      orderBy: { dateTime: "asc" },
    });
    return reply.send(reservations);
  });

  fastify.post(
    "/api/reservations",
    { preHandler: fastify.requireRole(canManageReservations) },
    async (request, reply) => {
      const parsed = createReservationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
      }
      const { customerName, customerPhone, partySize, dateTime, notes, tableId } = parsed.data;

      const reservation = await prisma.$transaction(async (tx) => {
        const created = await tx.reservation.create({
          data: {
            customerName,
            customerPhone,
            partySize,
            dateTime: new Date(dateTime),
            notes,
            tableId,
            status: ReservationStatus.CONFIRMEE,
          },
          include: { table: true },
        });

        if (tableId) {
          await tx.restaurantTable.update({ where: { id: tableId }, data: { status: TableStatus.RESERVEE } });
        }

        return created;
      });

      await recordAudit({
        userId: request.user!.sub,
        action: "RESERVATION_CREATED",
        entityType: "Reservation",
        entityId: reservation.id,
        details: { customerName, dateTime, tableId },
      });

      broadcast(WsEvent.RESERVATION_CREATED, reservation);
      if (reservation.table) {
        broadcast(WsEvent.TABLE_UPDATED, reservation.table);
      }
      return reply.code(201).send(reservation);
    }
  );

  fastify.patch(
    "/api/reservations/:id/status",
    { preHandler: fastify.requireRole(canManageReservations) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateReservationStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Statut invalide", details: parsed.error.flatten() });
      }

      const reservation = await prisma.$transaction(async (tx) => {
        const updated = await tx.reservation.update({
          where: { id },
          data: { status: parsed.data.status },
          include: { table: true },
        });

        if (updated.tableId && parsed.data.status === ReservationStatus.ANNULEE) {
          await tx.restaurantTable.update({ where: { id: updated.tableId }, data: { status: TableStatus.LIBRE } });
        }
        if (updated.tableId && parsed.data.status === ReservationStatus.ARRIVEE) {
          await tx.restaurantTable.update({ where: { id: updated.tableId }, data: { status: TableStatus.OCCUPEE } });
        }

        return tx.reservation.findUniqueOrThrow({ where: { id }, include: { table: true } });
      });

      await recordAudit({
        userId: request.user!.sub,
        action: "RESERVATION_STATUS_UPDATED",
        entityType: "Reservation",
        entityId: id,
        details: { status: parsed.data.status },
      });

      broadcast(WsEvent.RESERVATION_UPDATED, reservation);
      if (reservation.table) {
        broadcast(WsEvent.TABLE_UPDATED, reservation.table);
      }
      return reply.send(reservation);
    }
  );
}
