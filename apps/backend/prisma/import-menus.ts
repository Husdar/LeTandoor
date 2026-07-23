import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Prix des desserts estimés (non communiqués) — à ajuster depuis Administration > Menu.
const DESSERTS = [
  { name: "Kulfi", description: "Glace à la rose", price: 4.5 },
  { name: "Café", description: undefined, price: 2.0 },
  { name: "Shemai", description: "Gâteau à la semoule", price: 4.5 },
  { name: "Sorbet", description: "2 boules", price: 4.0 },
  { name: "Pâtisserie maison", description: undefined, price: 4.5 },
  { name: "Coupe Lahorie", description: undefined, price: 5.5 },
];

const PAINS_COMPLETS = [
  "Chapati",
  "Nan",
  "Nan Fromage",
  "Parata",
  "Parata Stuff",
  "Keema-nan",
  "Nan à l'ail",
  "Garlic Cheese Nan",
];

const TOUS_DESSERTS = DESSERTS.map((d) => d.name);
const DESSERTS_SAUF_COUPE_LAHORIE = TOUS_DESSERTS.filter((d) => d !== "Coupe Lahorie");

interface ChoiceOption {
  name: string;
  priceDelta?: number;
  groupName?: string;
}

interface MenuSeed {
  name: string;
  description: string;
  price: number;
  choices: ChoiceOption[];
}

function group(groupName: string, names: string[]): ChoiceOption[] {
  return names.map((name) => ({ name, priceDelta: 0, groupName }));
}

const MENUS: MenuSeed[] = [
  {
    name: "Menu Midi 15€",
    description: "Servi le midi du lundi au vendredi",
    price: 15,
    choices: [
      ...group("Entrée", ["Poulet Tikka", "Samosa Sabzi"]),
      ...group("Plat", ["Poulet Curry", "Poulet Korma", "Aloo Saag Paneer", "Dal"]),
      ...group("Dessert", ["Kulfi", "Café"]),
    ],
  },
  {
    name: "Menu Midi 8€",
    description: "Servi le midi du lundi au vendredi. Dessert inclus : Café.",
    price: 8,
    choices: [...group("Plat", ["Poulet Curry", "Poulet Korma", "Dal"])],
  },
  {
    name: "Menu Midi 12€",
    description: "Servi le midi du lundi au vendredi",
    price: 12,
    choices: [
      ...group("Pain", ["Nan", "Nan Fromage"]),
      ...group("Plat", ["Poulet Curry", "Poulet Korma", "Dal"]),
      ...group("Dessert", ["Shemai", "Café"]),
    ],
  },
  {
    name: "Menu Royal 35€",
    description: "Servi midi et soir, tous les jours. Dessert au choix (sauf Coupe Lahorie).",
    price: 35,
    choices: [
      ...group("Boisson", ["Apéritif au choix", "Vin en pichet Rosé (25cl)", "Vin en pichet Rouge (25cl)"]),
      ...group("Entrée", ["Poulet Tikka", "Agneau Tikka", "Sheekh Kebab", "Samosa Keema", "Samosa Sabzi"]),
      ...group("Pain", PAINS_COMPLETS),
      ...group("Plat", [
        "Butter Chicken",
        "Agneau Sagwala",
        "Aloo Keema",
        "Biryani Poulet",
        "Biryani Bœuf",
        "Biryani Agneau",
      ]),
      ...group("Dessert", DESSERTS_SAUF_COUPE_LAHORIE),
    ],
  },
  {
    name: "Menu Non Végétarien 20€",
    description: "Servi midi et soir, tous les jours",
    price: 20,
    choices: [
      ...group("Entrée", ["Poulet Tandoori", "Samosa Keema"]),
      ...group("Plat", ["Poulet Curry", "Bœuf Curry", "Agneau Curry", "Crevettes Curry"]),
      ...group("Dessert", ["Sorbet", "Pâtisserie maison"]),
    ],
  },
  {
    name: "Menu Végétarien 17€",
    description: "Servi midi et soir, tous les jours. Plats accompagnés de riz basmati.",
    price: 17,
    choices: [
      ...group("Entrée", ["Oignons Bhaji", "Samosa Légumes", "Pakora"]),
      ...group("Plat", ["Aloo Saag Paneer", "Curry d'Aubergines", "Dal"]),
      ...group("Dessert", TOUS_DESSERTS),
    ],
  },
  {
    name: "Menu Enfant (-12 ans) 9€",
    description: "Servi midi et soir, tous les jours. Inclus : Poulet Tikka, Nan Fromage, Riz Basmati, 1 glace (1 parfum).",
    price: 9,
    choices: [],
  },
];

async function main() {
  for (const categoryName of ["Menus", "Desserts"]) {
    const existing = await prisma.menuCategory.findFirst({ where: { name: categoryName } });
    if (existing) {
      await prisma.menuItem.deleteMany({ where: { categoryId: existing.id } });
      await prisma.menuCategory.delete({ where: { id: existing.id } });
    }
  }

  const menusCategory = await prisma.menuCategory.create({ data: { name: "Menus", position: -1 } });
  for (const menu of MENUS) {
    await prisma.menuItem.create({
      data: {
        categoryId: menusCategory.id,
        name: menu.name,
        description: menu.description,
        price: menu.price,
        active: true,
        options: { create: menu.choices },
      },
    });
  }
  console.log(`Catégorie "Menus" : ${MENUS.length} menus importés.`);

  const dessertsCategory = await prisma.menuCategory.create({ data: { name: "Desserts", position: 100 } });
  for (const dessert of DESSERTS) {
    await prisma.menuItem.create({
      data: {
        categoryId: dessertsCategory.id,
        name: dessert.name,
        description: dessert.description,
        price: dessert.price,
        active: true,
      },
    });
  }
  console.log(`Catégorie "Desserts" : ${DESSERTS.length} desserts importés (prix estimés à ajuster).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
