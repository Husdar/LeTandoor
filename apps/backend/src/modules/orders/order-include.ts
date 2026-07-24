import type { Prisma } from "@prisma/client";

export const fullOrderInclude = {
  items: {
    include: { options: true, menuItem: { include: { category: true } } },
    orderBy: { createdAt: "asc" },
  },
  orderTables: { include: { table: true } },
  payments: true,
  server: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof fullOrderInclude }>;
