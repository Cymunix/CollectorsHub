import type { ItemKind } from "./types";

export function normalizeName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export function detectKindFromCategoryName(
  categoryName: string
): Exclude<ItemKind, "minifig"> {
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
