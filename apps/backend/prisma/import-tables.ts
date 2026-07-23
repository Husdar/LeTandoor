import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TableSeed {
  name: string;
  seats: number;
  zone: string;
  posX: number;
  posY: number;
  shape: "CARREE" | "RECTANGLE" | "RONDE";
}

// Coordonnées en pourcentage (0-100) de la position réelle de chaque table dans le plan
// de salle du restaurant (deux salles distinctes, chacune avec son propre schéma).
const TABLES: TableSeed[] = [
  // Salle 1 (pièce large, format paysage)
  { name: "S1-T1", seats: 6, zone: "Salle 1", posX: 17, posY: 20, shape: "RECTANGLE" },
  { name: "S1-T2", seats: 6, zone: "Salle 1", posX: 49, posY: 20, shape: "RECTANGLE" },
  { name: "S1-T3", seats: 2, zone: "Salle 1", posX: 85, posY: 14, shape: "CARREE" },
  { name: "S1-T4", seats: 2, zone: "Salle 1", posX: 85, posY: 38, shape: "CARREE" },
  { name: "S1-T5", seats: 6, zone: "Salle 1", posX: 84, posY: 71, shape: "RECTANGLE" },
  { name: "S1-T6", seats: 2, zone: "Salle 1", posX: 47, posY: 49, shape: "CARREE" },
  { name: "S1-T7", seats: 2, zone: "Salle 1", posX: 13, posY: 61, shape: "CARREE" },
  { name: "S1-T8", seats: 2, zone: "Salle 1", posX: 47, posY: 84, shape: "CARREE" },
  // Salle 2 (pièce plus étroite, format portrait)
  { name: "S2-T1", seats: 4, zone: "Salle 2", posX: 21, posY: 16, shape: "RECTANGLE" },
  { name: "S2-T2", seats: 2, zone: "Salle 2", posX: 50, posY: 16, shape: "CARREE" },
  { name: "S2-T3", seats: 4, zone: "Salle 2", posX: 79, posY: 16, shape: "RECTANGLE" },
  { name: "S2-T4", seats: 4, zone: "Salle 2", posX: 18, posY: 38, shape: "RECTANGLE" },
  { name: "S2-T6", seats: 4, zone: "Salle 2", posX: 81, posY: 38, shape: "RECTANGLE" },
  { name: "S2-T5", seats: 4, zone: "Salle 2", posX: 18, posY: 58, shape: "RECTANGLE" },
  { name: "S2-T7", seats: 4, zone: "Salle 2", posX: 81, posY: 58, shape: "RECTANGLE" },
  { name: "S2-T8", seats: 4, zone: "Salle 2", posX: 27, posY: 80, shape: "RECTANGLE" },
  { name: "S2-T9", seats: 2, zone: "Salle 2", posX: 54, posY: 80, shape: "CARREE" },
  { name: "S2-T10", seats: 2, zone: "Salle 2", posX: 77, posY: 80, shape: "CARREE" },
];

async function main() {
  const existing = await prisma.restaurantTable.findMany({ select: { id: true } });
  if (existing.length > 0) {
    await prisma.reservation.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.restaurantTable.deleteMany({});
    console.log(`${existing.length} ancienne(s) table(s) (et commandes de test associées) supprimée(s).`);
  }

  for (const table of TABLES) {
    await prisma.restaurantTable.create({ data: table });
  }
  console.log(`${TABLES.length} tables importées (Salle 1 : 8, Salle 2 : 10).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
