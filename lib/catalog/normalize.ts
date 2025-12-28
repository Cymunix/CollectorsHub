// lib/catalog/normalize.ts
import type { ItemKind } from "./types";

export function normalizeName(s: string) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

export function slugify(s: string) {
  return normalizeName(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function detectKindFromCategoryName(categoryName: string): ItemKind {
  const n = normalizeName(categoryName).toLowerCase();

  if (n.includes("sports") && n.includes("card")) return "sports_card";
  if (n.includes("trading") && n.includes("card")) return "trading_card";

  if (n.includes("music")) return "music";
  if (n.includes("toy")) return "toy";
  if (n.includes("movie") || n.includes("film")) return "movie";
  if (n.includes("gaming") || n.includes("video game") || n.includes("games")) return "gaming";
  if (n.includes("comic")) return "comic";

  return "building_blocks";
}

export function toNumberOrNull(v: string): number | null {
  const s = normalizeName(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
