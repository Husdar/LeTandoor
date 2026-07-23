import { PrintJobStatus, PrintTarget, PrintTicketType, WsEvent } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { broadcast } from "../../ws/hub.js";
import { fullOrderInclude } from "../orders/order-include.js";
import { createPrinterClient, writeKitchenTicket, writeReceipt, writeTestTicket } from "./ticket-builder.js";

function friendlyConnectionError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/ECONNREFUSED/.test(raw)) {
    return "Connexion refusée : vérifiez que l'imprimante est allumée et que le port est correct (9100 en général).";
  }
  if (/ETIMEDOUT|timeout/i.test(raw)) {
    return "Aucune réponse : vérifiez l'adresse IP et que l'imprimante est sur le même réseau Wi-Fi que ce serveur.";
  }
  if (/EHOSTUNREACH|ENETUNREACH/.test(raw)) {
    return "Adresse inaccessible : l'imprimante ne semble pas être sur le même réseau.";
  }
  if (/ENOTFOUND/.test(raw)) {
    return "Adresse IP introuvable : vérifiez qu'elle est bien saisie (ex: 192.168.1.50).";
  }
  return `Échec de connexion : ${raw}`;
}

/** Utilisé par l'assistant de configuration d'imprimante pour vérifier la connexion avant l'enregistrement. */
export async function testPrinterConnection(ip: string, port: number): Promise<void> {
  try {
    const client = createPrinterClient(ip, port);
    writeTestTicket(client);
    await client.execute();
  } catch (err) {
    throw new Error(friendlyConnectionError(err));
  }
}

export async function printOrder(orderId: string, ticketType: PrintTicketType) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: fullOrderInclude });
  const target = ticketType === PrintTicketType.CUISINE ? PrintTarget.CUISINE : PrintTarget.CAISSE;
  const printers = await prisma.printer.findMany({ where: { active: true, target } });

  if (printers.length === 0) {
    return [];
  }

  const jobs = [];
  for (const printerRecord of printers) {
    const priorCount = await prisma.printJob.count({
      where: { orderId, printerId: printerRecord.id, ticketType },
    });
    const job = await prisma.printJob.create({
      data: {
        orderId,
        printerId: printerRecord.id,
        ticketType,
        status: PrintJobStatus.EN_ATTENTE,
        reprintCount: priorCount,
      },
    });

    let finalJob = job;
    try {
      const client = createPrinterClient(printerRecord.ip, printerRecord.port);
      if (ticketType === PrintTicketType.CUISINE) {
        writeKitchenTicket(client, order);
      } else {
        writeReceipt(client, order);
      }
      await client.execute();
      finalJob = await prisma.printJob.update({
        where: { id: job.id },
        data: { status: PrintJobStatus.IMPRIME, printedAt: new Date() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur d'impression inconnue";
      finalJob = await prisma.printJob.update({
        where: { id: job.id },
        data: { status: PrintJobStatus.ECHEC, errorMessage: message },
      });
    }

    broadcast(WsEvent.PRINT_JOB_UPDATED, finalJob);
    jobs.push(finalJob);
  }

  return jobs;
}
