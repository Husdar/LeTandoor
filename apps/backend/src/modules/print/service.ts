import { PrintJobStatus, PrintTarget, PrintTicketType, WsEvent } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { broadcast, sendToRelay, relayEvents } from "../../ws/hub.js";
import { fullOrderInclude } from "../orders/order-include.js";
import { createPrinterClient, writeKitchenTicket, writeReceipt, writeTestTicket } from "./ticket-builder.js";

const RELAY_TIMEOUT_MS = 15_000;

interface PrintJobResultPayload {
  jobId: string;
  success: boolean;
  error?: string;
}

function friendlyConnectionError(raw: string): string {
  if (/ECONNREFUSED/.test(raw)) {
    return "Connexion refusée : vérifiez que l'imprimante est allumée et que le port est correct (9100 en général).";
  }
  if (/ETIMEDOUT|timeout/i.test(raw)) {
    return "Aucune réponse : vérifiez l'adresse IP et que l'imprimante est sur le même réseau que le relais d'impression.";
  }
  if (/EHOSTUNREACH|ENETUNREACH/.test(raw)) {
    return "Adresse inaccessible : l'imprimante ne semble pas être sur le même réseau que le relais.";
  }
  if (/ENOTFOUND/.test(raw)) {
    return "Adresse IP introuvable : vérifiez qu'elle est bien saisie (ex: 192.168.1.50).";
  }
  return `Échec de connexion : ${raw}`;
}

/**
 * Le backend est hébergé à distance et ne peut pas atteindre directement les imprimantes du
 * réseau local du restaurant. On transmet donc le ticket déjà formaté (buffer ESC/POS) au petit
 * relais d'impression local via WebSocket (voir apps/print-relay), qui se charge de l'envoi TCP
 * réel vers l'imprimante et renvoie le résultat.
 */
async function dispatchToRelay(jobId: string, ip: string, port: number, buffer: Buffer): Promise<{ success: boolean; error?: string }> {
  const sent = sendToRelay(WsEvent.PRINT_JOB_REQUEST, {
    jobId,
    ip,
    port,
    data: buffer.toString("base64"),
  });
  if (!sent) {
    return {
      success: false,
      error: "Relais d'impression non connecté — vérifiez qu'il tourne bien sur un ordinateur du restaurant.",
    };
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      relayEvents.off("result", onResult);
      resolve({ success: false, error: "Le relais d'impression n'a pas répondu (délai dépassé)." });
    }, RELAY_TIMEOUT_MS);

    function onResult(payload: PrintJobResultPayload) {
      if (payload.jobId !== jobId) return;
      clearTimeout(timer);
      relayEvents.off("result", onResult);
      resolve({ success: payload.success, error: payload.error ? friendlyConnectionError(payload.error) : undefined });
    }

    relayEvents.on("result", onResult);
  });
}

/** Utilisé par l'assistant de configuration d'imprimante pour vérifier la connexion avant l'enregistrement. */
export async function testPrinterConnection(ip: string, port: number): Promise<void> {
  const client = createPrinterClient(ip, port);
  writeTestTicket(client);
  const buffer = client.getBuffer();

  const result = await dispatchToRelay(`test-${Date.now()}`, ip, port, buffer);
  if (!result.success) {
    throw new Error(result.error ?? "Échec du test d'impression");
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
      const buffer = client.getBuffer();

      const result = await dispatchToRelay(job.id, printerRecord.ip, printerRecord.port, buffer);
      if (!result.success) {
        throw new Error(result.error ?? "Échec d'impression");
      }

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
