import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ItemSeed {
  name: string;
  description?: string;
  price: number;
}

interface CategorySeed {
  name: string;
  position: number;
  items: ItemSeed[];
}

// Prix tels qu'imprimés sur le menu à emporter du Tandoor (déjà -20%, prix de référence "à emporter").
const CATEGORIES: CategorySeed[] = [
  {
    name: "Les Entrées",
    position: 0,
    items: [
      { name: "Samosa Sabzi", description: "Chaussons aux légumes", price: 4.8 },
      { name: "Pakora", description: "Beignets de légumes trempés dans la farine", price: 4.8 },
      { name: "Oignons Bhaji", description: "Beignets d'oignons trempés dans la farine", price: 4.8 },
      { name: "Samosa Keemaa", description: "Chaussons de viande hachée", price: 5.6 },
      { name: "Pakora Ginga", description: "Beignets de crevettes trempés dans la farine", price: 7.2 },
      { name: "Crevettes Lahorie", description: "Crevettes marinées dans une sauce de mangue", price: 6.4 },
      { name: "Poisson Katlass", price: 7.2 },
    ],
  },
  {
    name: "Les Entrées Tandoor",
    position: 1,
    items: [
      { name: "Poulet Tikka", description: "Morceaux de blanc de poulet marinés dans différentes épices", price: 7.2 },
      { name: "Agneau Tikka", description: "Gigot d'agneau mariné dans les épices", price: 8 },
      { name: "Gambas Tandoori", price: 13.6 },
    ],
  },
  {
    name: "Poulet",
    position: 2,
    items: [
      { name: "Poulet au curry", description: "Poulet, spécialité du Pendjab", price: 11.2 },
      { name: "Poulet Vindaloo", description: "Poulet en sauce relevée avec pommes de terre", price: 11.6 },
      { name: "Poulet Korma", description: "Poulet à base d'une sauce légèrement sucrée", price: 12 },
      { name: "Poulet Madras", description: "Poulet accompagné d'une sauce relevée de Madras", price: 11.6 },
      { name: "Poulet Sagu", description: "Poulet accompagné d'épinards", price: 12 },
      { name: "Poulet Tikka Masala", description: "Poulet tikka accompagné de tomates, poivrons, et oignons", price: 12 },
      { name: "Poulet Jalfrezi", price: 12 },
      { name: "Butter Chicken", description: "Morceaux de poulet grillés et frits aux herbes et légumes", price: 12 },
      { name: "Poulet Danen", description: "Poulet accompagné d'aubergines hachée et herbes", price: 12 },
      { name: "Chicken Daal", description: "Poulet accompagné de 3 types de lentilles, curry, épices", price: 12 },
    ],
  },
  {
    name: "Agneau",
    position: 3,
    items: [
      {
        name: "Agneau Tikka Masala",
        description: "Grillade au tandoor accompagnée de tomates poivrons et oignons",
        price: 13.6,
      },
      { name: "Agneau Korma", description: "Agneau à base d'une sauce légèrement sucrée", price: 12.8 },
      { name: "Agneau Danen", description: "Agneau au curry accompagné d'aubergines hachée", price: 13.2 },
      { name: "Agneau Sagwala", description: "Curry d'agneau accompagné d'épinards", price: 12.8 },
      { name: "Agneau Vindaloo", description: "Curry d'agneau relevé avec pomme de terre", price: 12.8 },
      { name: "Agneau Madras", description: "Agneau en sauce relevée avec curry épices", price: 12.8 },
      { name: "Agneau Daal", description: "Agneau accompagné de trois lentilles curry épices", price: 12.8 },
      { name: "Agneau Kofta Curry", description: "Viande hachée curry", price: 12.8 },
      { name: "Agneau Curry", description: "Agneau accompagné d'une sauce curry", price: 11.6 },
    ],
  },
  {
    name: "Bœuf",
    position: 4,
    items: [
      { name: "Aloo Keema", description: "Viande hachée accompagnée de pommes de terre", price: 11.6 },
      { name: "Keema Matar", description: "Viande hachée et petits pois", price: 11.6 },
      { name: "Bœuf au curry", description: "Spécialité du Pendjab", price: 11.2 },
      { name: "Bœuf Madras", description: "Viande de bœuf en sauce épicée (relevé)", price: 12 },
      { name: "Bœuf Shahi Korma", description: "Viande de bœuf avec curry, et sauce douce", price: 12 },
      { name: "Bœuf Kofta Vindaloo", description: "Boulette de bœuf et de pommes de terre", price: 11.6 },
      { name: "Bœuf Kofta Curry", description: "Boulette de bœuf avec sauce curry", price: 11.6 },
    ],
  },
  {
    name: "Poissons",
    position: 5,
    items: [
      { name: "Machil curry", description: "Poisson accompagné d'une sauce à base de curry", price: 11.6 },
      { name: "Poisson Kashmiri", description: "Poisson accompagné d'une sauce sucrée", price: 12 },
      { name: "Crevettes au curry", description: "Curry de crevettes", price: 11.2 },
      { name: "Crevettes Kashmiri", description: "Curry de crevettes avec fruits secs", price: 12 },
      { name: "Poisson Punjabi", description: "Filet de poisson en curry relevé", price: 12 },
      { name: "Gambas au curry", description: "Curry de gambas", price: 13.6 },
      { name: "Gambas Shahi Korma", description: "Gambas à base d'une sauce légèrement sucrée", price: 15.2 },
      { name: "Gambas Punjabi", price: 15.2 },
    ],
  },
  {
    name: "Biryani",
    position: 6,
    items: [
      { name: "Biryani Keema", description: "Viande hachée avec riz et différentes épices", price: 12.4 },
      { name: "Biryani Bœuf", description: "Bœuf cuit et mijoté avec du riz et différentes épices", price: 12.4 },
      { name: "Biryani Poulet", description: "Poulet mijoté avec du riz et différentes épices", price: 11.6 },
      { name: "Biryani Agneau", description: "Agneau mijoté avec du riz et différentes épices", price: 13.6 },
      { name: "Biryani Crevettes", description: "Crevettes mijotées avec du riz et différentes épices", price: 14.4 },
      { name: "Biryani Royal", description: "Agneau, bœuf, poulet, crevette", price: 15.2 },
      { name: "Biryani Mixte", description: "Agneau, bœuf, poulet", price: 13.6 },
      {
        name: "Biryani légumes",
        description: "Différents légumes mijotés avec du riz et différentes épices",
        price: 10.4,
      },
    ],
  },
  {
    name: "Spécialités végétariennes",
    position: 7,
    items: [
      { name: "Aloo Gobi", description: "Choux fleurs et pommes de terre", price: 10 },
      { name: "Baingan Bhartha", description: "Aubergines hachée en sauce curry", price: 10.4 },
      { name: "Matar Paanir", description: "Petits pois avec fromage", price: 10 },
      { name: "Aloo Sag Pannir", description: "Épinards avec du fromage frais", price: 10.4 },
      { name: "Mix légumes", description: "Légumes accompagnés d'une sauce curry", price: 10 },
      { name: "Daal", description: "Cuisine traditionnelle indienne, 3 types de lentilles", price: 10.4 },
    ],
  },
  {
    name: "Riz Basmati",
    position: 8,
    items: [
      { name: "Riz au safran", description: "Riz basmati au safran", price: 3.2 },
      { name: "Riz Pullaao", description: "Riz basmati au petit pois", price: 5.6 },
    ],
  },
  {
    name: "Les Pains",
    position: 9,
    items: [
      { name: "Chapati", description: "Galette de farine complète cuite au tandoor", price: 1.6 },
      { name: "Nan", description: "Galette de farine blanche avec œufs, cuite au tandoor", price: 1.6 },
      { name: "Nan Fromage", description: "Galette de farine, fromage, cuite au tandoor", price: 2.8 },
      { name: "Parata", description: "Galette de farine avec beurre, cuite au tandoor", price: 2.4 },
      { name: "Parata Stuff", description: "Galette de farine farcie aux légumes", price: 2.4 },
      { name: "Keema-nan", description: "Fromage, viande hachée", price: 4 },
      { name: "Nan à l'ail", description: "Galette de farine farcie d'ail", price: 2.8 },
      { name: "Garlic Cheese Nan", description: "Galette de farine farcie d'ail et de fromage", price: 3.6 },
    ],
  },
];

async function main() {
  // Nettoyage des données de test créées pendant le développement.
  await prisma.emailIngestLog.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.menuItemOption.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.menuCategory.deleteMany({});
  await prisma.restaurantTable.deleteMany({});
  console.log("Données de test supprimées (commandes, menu, tables).");

  for (const category of CATEGORIES) {
    const created = await prisma.menuCategory.create({
      data: { name: category.name, position: category.position },
    });
    for (const item of category.items) {
      await prisma.menuItem.create({
        data: {
          categoryId: created.id,
          name: item.name,
          description: item.description,
          price: item.price,
          active: true,
        },
      });
    }
    console.log(`Catégorie "${category.name}" : ${category.items.length} plats importés.`);
  }

  const total = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);
  console.log(`Import terminé : ${CATEGORIES.length} catégories, ${total} plats.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
