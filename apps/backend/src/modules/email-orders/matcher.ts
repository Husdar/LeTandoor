import type { MenuItem } from "@prisma/client";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchMenuItem(name: string, menuItems: MenuItem[]): MenuItem | null {
  const target = normalize(name);
  if (!target) return null;

  const exact = menuItems.find((m) => normalize(m.name) === target);
  if (exact) return exact;

  const partial = menuItems.find((m) => {
    const candidate = normalize(m.name);
    return candidate.length > 2 && (candidate.includes(target) || target.includes(candidate));
  });
  return partial ?? null;
}
