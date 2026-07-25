import { OrderItemStatus, OrderStatus } from "@le-tandoor/shared";
import { prisma } from "../../db.js";

export interface CustomerProfile {
  key: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
  favoriteItem: string | null;
}

/** Reconstitue un annuaire clients à partir des commandes réellement honorées (clôturées), en
 * dédupliquant par téléphone puis par email — aucune saisie manuelle, toujours à jour. Les
 * commandes sur place sans coordonnées client (la majorité) n'ont pas d'identité reconstituable
 * et sont donc naturellement exclues de l'annuaire. */
export async function listCustomers(): Promise<CustomerProfile[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.TERMINEE,
      OR: [{ customerPhone: { not: null } }, { customerEmail: { not: null } }],
    },
    select: {
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      total: true,
      createdAt: true,
      items: {
        where: { status: { not: OrderItemStatus.ANNULE } },
        select: { nameSnapshot: true, quantity: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  interface Bucket {
    name: string | null;
    phone: string | null;
    email: string | null;
    orderCount: number;
    totalSpent: number;
    lastOrderAt: Date;
    itemCounts: Map<string, number>;
  }
  const byKey = new Map<string, Bucket>();

  for (const order of orders) {
    const key = (order.customerPhone ?? order.customerEmail ?? "").trim().toLowerCase();
    if (!key) continue;

    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = {
        name: null,
        phone: null,
        email: null,
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: order.createdAt,
        itemCounts: new Map(),
      };
      byKey.set(key, bucket);
    }

    // On garde les dernières coordonnées connues (les plus récentes), pas les toutes premières.
    if (order.customerName) bucket.name = order.customerName;
    if (order.customerPhone) bucket.phone = order.customerPhone;
    if (order.customerEmail) bucket.email = order.customerEmail;
    bucket.orderCount += 1;
    bucket.totalSpent += Number(order.total);
    if (order.createdAt > bucket.lastOrderAt) bucket.lastOrderAt = order.createdAt;

    for (const item of order.items) {
      bucket.itemCounts.set(item.nameSnapshot, (bucket.itemCounts.get(item.nameSnapshot) ?? 0) + item.quantity);
    }
  }

  const profiles: CustomerProfile[] = [];
  for (const [key, bucket] of byKey) {
    let favoriteItem: string | null = null;
    let bestCount = 0;
    for (const [name, count] of bucket.itemCounts) {
      if (count > bestCount) {
        bestCount = count;
        favoriteItem = name;
      }
    }
    profiles.push({
      key,
      name: bucket.name,
      phone: bucket.phone,
      email: bucket.email,
      orderCount: bucket.orderCount,
      totalSpent: Math.round(bucket.totalSpent * 100) / 100,
      lastOrderAt: bucket.lastOrderAt.toISOString(),
      favoriteItem,
    });
  }

  return profiles.sort((a, b) => b.totalSpent - a.totalSpent);
}
