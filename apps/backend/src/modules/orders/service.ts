import type { Prisma } from "@prisma/client";
import {
  OrderStatus,
  OrderItemStatus,
  TableStatus,
  PrintTicketType,
  WsEvent,
  applyChannelPricing,
  type OrderType,
  type CreateOrderInput,
  type OrderItemInput,
  type CloseOrderInput,
} from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { recordAudit } from "../../audit.js";
import { broadcast } from "../../ws/hub.js";
import { fullOrderInclude } from "./order-include.js";
import { printOrder } from "../print/service.js";

export { fullOrderInclude };

type TxClient = Prisma.TransactionClient;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

class OrderError extends Error {}

async function buildOrderItemsData(items: OrderItemInput[], orderType: OrderType) {
  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    include: { options: true },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  return items.map((input) => {
    const menuItem = menuItemMap.get(input.menuItemId);
    if (!menuItem || !menuItem.active) {
      throw new OrderError(`Plat introuvable ou inactif: ${input.menuItemId}`);
    }
    const selectedOptions = menuItem.options.filter((o) => input.selectedOptionIds.includes(o.id));
    const optionsTotal = selectedOptions.reduce((sum, o) => sum + Number(o.priceDelta), 0);
    const basePrice = round2(Number(menuItem.price) + optionsTotal);
    const unitPrice = applyChannelPricing(basePrice, orderType);
    const lineTotal = round2(unitPrice * input.quantity);

    return {
      menuItemId: menuItem.id,
      nameSnapshot: menuItem.name,
      unitPriceSnapshot: unitPrice,
      quantity: input.quantity,
      notes: input.notes,
      status: OrderItemStatus.NOUVELLE,
      options: {
        create: selectedOptions.map((o) => ({ name: o.name, priceDelta: o.priceDelta })),
      },
      lineTotal,
    };
  });
}

async function recomputeOrderStatus(tx: TxClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });

  const frozenStatuses: string[] = [OrderStatus.TERMINEE, OrderStatus.ANNULEE, OrderStatus.SERVIE];
  if (frozenStatuses.includes(order.status)) {
    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: fullOrderInclude });
  }

  const active = order.items.filter((i) => i.status !== OrderItemStatus.ANNULE);
  let derived: OrderStatus = OrderStatus.NOUVELLE;
  if (active.length > 0) {
    const allReady = active.every(
      (i) => i.status === OrderItemStatus.PRETE || i.status === OrderItemStatus.SERVIE
    );
    const anyStarted = active.some(
      (i) =>
        i.status === OrderItemStatus.EN_PREPARATION ||
        i.status === OrderItemStatus.PRETE ||
        i.status === OrderItemStatus.SERVIE
    );
    if (allReady) derived = OrderStatus.PRETE;
    else if (anyStarted) derived = OrderStatus.EN_PREPARATION;
  }

  if (derived !== order.status) {
    await tx.order.update({ where: { id: orderId }, data: { status: derived } });
  }
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: fullOrderInclude });
}

export async function createOrder(input: CreateOrderInput, serverId: string | null) {
  const itemsData = await buildOrderItemsData(input.items, input.type);
  const subtotal = round2(itemsData.reduce((sum, item) => sum + item.lineTotal, 0));

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        type: input.type,
        status: OrderStatus.NOUVELLE,
        serverId: serverId ?? undefined,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryAddress: input.deliveryAddress,
        subtotal,
        total: subtotal,
        items: {
          create: itemsData.map(({ lineTotal: _lineTotal, ...rest }) => rest),
        },
        ...(input.tableId ? { orderTables: { create: [{ tableId: input.tableId }] } } : {}),
      },
    });

    if (input.tableId) {
      await tx.restaurantTable.update({
        where: { id: input.tableId },
        data: { status: TableStatus.OCCUPEE },
      });
    }

    return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: fullOrderInclude });
  });

  await recordAudit({
    userId: serverId,
    action: "ORDER_CREATED",
    entityType: "Order",
    entityId: order.id,
    details: { type: input.type, itemCount: input.items.length },
  });

  broadcast(WsEvent.ORDER_CREATED, order);
  printOrder(order.id, PrintTicketType.CUISINE).catch((err) => console.error("[print] échec impression cuisine", err));
  return order;
}

export async function addOrderItem(orderId: string, input: OrderItemInput, userId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const closedStatuses: string[] = [OrderStatus.TERMINEE, OrderStatus.ANNULEE];
  if (closedStatuses.includes(order.status)) {
    throw new OrderError("Impossible de modifier une commande clôturée ou annulée");
  }

  const [itemData] = await buildOrderItemsData([input], order.type);
  const { lineTotal, ...rest } = itemData;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderItem.create({ data: { ...rest, orderId } });
    const subtotal = round2(Number(order.subtotal) + lineTotal);
    const total = round2(subtotal + Number(order.deliveryFee) - Number(order.discountAmount));
    await tx.order.update({ where: { id: orderId }, data: { subtotal, total } });
    return recomputeOrderStatus(tx, orderId);
  });

  await recordAudit({
    userId,
    action: "ORDER_ITEM_ADDED",
    entityType: "Order",
    entityId: orderId,
    details: { menuItemId: input.menuItemId, quantity: input.quantity },
  });

  broadcast(WsEvent.ORDER_UPDATED, updated);
  return updated;
}

export async function updateOrderItemStatus(
  orderItemId: string,
  status: OrderItemStatus,
  reason: string | undefined,
  userId: string
) {
  const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: orderItemId } });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({
      where: { id: orderItemId },
      data: {
        status,
        cancelReason: status === OrderItemStatus.ANNULE ? reason : undefined,
      },
    });

    if (status === OrderItemStatus.ANNULE) {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: item.orderId },
        include: { items: true },
      });
      const subtotal = round2(
        order.items.reduce((sum, oi) => {
          if (oi.id === orderItemId) return sum;
          if (oi.status === OrderItemStatus.ANNULE) return sum;
          return sum + Number(oi.unitPriceSnapshot) * oi.quantity;
        }, 0)
      );
      const total = round2(subtotal + Number(order.deliveryFee) - Number(order.discountAmount));
      await tx.order.update({ where: { id: item.orderId }, data: { subtotal, total } });
    }

    return recomputeOrderStatus(tx, item.orderId);
  });

  await recordAudit({
    userId,
    action: status === OrderItemStatus.ANNULE ? "ORDER_ITEM_CANCELLED" : "ORDER_ITEM_STATUS_UPDATED",
    entityType: "OrderItem",
    entityId: orderItemId,
    details: { status, reason },
  });

  broadcast(WsEvent.ORDER_UPDATED, updated);
  return updated;
}

export async function advanceOrderItems(orderId: string, status: OrderItemStatus, userId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderItem.updateMany({
      where: { orderId, status: { not: OrderItemStatus.ANNULE } },
      data: { status },
    });
    return recomputeOrderStatus(tx, orderId);
  });

  await recordAudit({
    userId,
    action: "ORDER_ITEMS_ADVANCED",
    entityType: "Order",
    entityId: orderId,
    details: { status },
  });

  broadcast(WsEvent.ORDER_UPDATED, updated);
  return updated;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  reason: string | undefined,
  userId: string
) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        status,
        cancelReason: status === OrderStatus.ANNULEE ? reason : undefined,
        closedAt: status === OrderStatus.ANNULEE ? new Date() : undefined,
      },
      include: { orderTables: true },
    });

    if (status === OrderStatus.ANNULEE) {
      for (const ot of order.orderTables) {
        await tx.restaurantTable.update({ where: { id: ot.tableId }, data: { status: TableStatus.LIBRE } });
      }
    }

    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: fullOrderInclude });
  });

  await recordAudit({
    userId,
    action: status === OrderStatus.ANNULEE ? "ORDER_CANCELLED" : "ORDER_STATUS_UPDATED",
    entityType: "Order",
    entityId: orderId,
    details: { status, reason },
  });

  broadcast(WsEvent.ORDER_UPDATED, updated);
  if (status === OrderStatus.ANNULEE) {
    for (const ot of updated.orderTables) {
      broadcast(WsEvent.TABLE_UPDATED, ot.table);
    }
  }
  return updated;
}

export async function closeOrder(orderId: string, input: CloseOrderInput, userId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { orderTables: true },
  });
  const closedStatuses: string[] = [OrderStatus.TERMINEE, OrderStatus.ANNULEE];
  if (closedStatuses.includes(order.status)) {
    throw new OrderError("Commande déjà clôturée ou annulée");
  }

  const total = round2(Number(order.subtotal) + Number(order.deliveryFee) - input.discountAmount);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.TERMINEE,
        discountAmount: input.discountAmount,
        discountReason: input.discountReason,
        total,
        closedAt: new Date(),
      },
    });
    await tx.payment.create({ data: { orderId, amount: total, method: input.paymentMethod } });

    for (const ot of order.orderTables) {
      await tx.restaurantTable.update({ where: { id: ot.tableId }, data: { status: TableStatus.A_NETTOYER } });
    }

    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: fullOrderInclude });
  });

  await recordAudit({
    userId,
    action: "ORDER_CLOSED",
    entityType: "Order",
    entityId: orderId,
    details: { total, paymentMethod: input.paymentMethod, discountAmount: input.discountAmount },
  });

  broadcast(WsEvent.ORDER_CLOSED, updated);
  for (const ot of updated.orderTables) {
    broadcast(WsEvent.TABLE_UPDATED, ot.table);
  }
  printOrder(updated.id, PrintTicketType.RECU).catch((err) => console.error("[print] échec impression reçu", err));
  return updated;
}

export async function listActiveOrders() {
  const closedStatuses: OrderStatus[] = [OrderStatus.TERMINEE, OrderStatus.ANNULEE];
  return prisma.order.findMany({
    where: { status: { notIn: closedStatuses } },
    include: fullOrderInclude,
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrder(orderId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: fullOrderInclude });
}
