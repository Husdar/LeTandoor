import { OrderItemStatus, OrderStatus, OrderSource, PrintTicketType, EmailIngestStatus, WsEvent } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { broadcast } from "../../ws/hub.js";
import { fullOrderInclude } from "../orders/order-include.js";
import { printOrder } from "../print/service.js";
import { matchMenuItem } from "./matcher.js";
import { parseOrderEmail, resolveRequestedTime, type ParsedEmailOrder } from "./parser.js";

export interface IngestResult {
  status: EmailIngestStatus;
  orderId?: string;
  errorMessage?: string;
}

export async function ingestOrderEmail(params: {
  messageId: string;
  subject: string;
  text: string;
  receivedAt: Date;
}): Promise<IngestResult> {
  const { messageId, subject, text, receivedAt } = params;

  const existingLog = await prisma.emailIngestLog.findUnique({ where: { messageId } });
  if (existingLog) {
    return { status: EmailIngestStatus.IGNORE, errorMessage: "Email déjà traité" };
  }

  let parsed: ParsedEmailOrder;
  try {
    parsed = parseOrderEmail(subject, text);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Erreur de parsing inconnue";
    await prisma.emailIngestLog.create({
      data: { messageId, subject, receivedAt, status: EmailIngestStatus.ECHEC, errorMessage, rawText: text },
    });
    return { status: EmailIngestStatus.ECHEC, errorMessage };
  }

  const existingOrder = await prisma.order.findUnique({ where: { externalRef: parsed.externalRef } });
  if (existingOrder) {
    const errorMessage = `Commande #${parsed.externalRef} déjà importée`;
    // Hostinger envoie jusqu'à 3 emails par commande (messageId différents, même numéro de
    // commande) : EmailIngestLog.orderId est unique, donc seul le premier doublon peut y être
    // rattaché. Les suivants sont tout de même journalisés, sans lien vers la commande.
    const alreadyLinked = await prisma.emailIngestLog.findUnique({ where: { orderId: existingOrder.id } });
    await prisma.emailIngestLog.create({
      data: {
        messageId,
        subject,
        receivedAt,
        status: EmailIngestStatus.IGNORE,
        errorMessage,
        rawText: text,
        orderId: alreadyLinked ? undefined : existingOrder.id,
      },
    });
    return { status: EmailIngestStatus.IGNORE, orderId: existingOrder.id, errorMessage };
  }

  const menuItems = await prisma.menuItem.findMany({ where: { active: true } });
  const requestedFor = parsed.requestedTimeLabel
    ? resolveRequestedTime(parsed.requestedTimeLabel, receivedAt)
    : undefined;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        type: parsed.type,
        status: OrderStatus.NOUVELLE,
        source: OrderSource.SITE_WEB,
        externalRef: parsed.externalRef,
        customerName: parsed.customerName,
        customerPhone: parsed.customerPhone,
        deliveryAddress: parsed.deliveryAddress,
        requestedFor,
        prepMinutes: parsed.prepMinutes,
        subtotal: parsed.subtotal,
        deliveryFee: parsed.deliveryFee,
        total: parsed.total,
        items: {
          create: parsed.items.map((item) => {
            const matched = matchMenuItem(item.name, menuItems);
            return {
              menuItemId: matched?.id,
              nameSnapshot: item.name,
              unitPriceSnapshot: item.unitPrice,
              quantity: item.quantity,
              status: OrderItemStatus.NOUVELLE,
            };
          }),
        },
      },
    });

    await tx.emailIngestLog.create({
      data: {
        messageId,
        subject,
        receivedAt,
        status: EmailIngestStatus.TRAITE,
        rawText: text,
        orderId: created.id,
      },
    });

    return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: fullOrderInclude });
  });

  broadcast(WsEvent.ORDER_CREATED, order);

  printOrder(order.id, PrintTicketType.CUISINE).catch((err) =>
    console.error("[print] échec impression cuisine (commande site web)", err)
  );
  printOrder(order.id, PrintTicketType.RECU).catch((err) =>
    console.error("[print] échec impression reçu (commande site web)", err)
  );

  return { status: EmailIngestStatus.TRAITE, orderId: order.id };
}
