import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

export async function recordAudit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: (params.details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
