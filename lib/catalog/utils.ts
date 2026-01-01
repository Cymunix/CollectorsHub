// lib/catalog/utils.ts

import type { ItemKind, CatalogCard, BundleComponent } from "./types";

/* =========================
   Normalization
   ========================= */

export function normalizeName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

/* =========================
   Item Kind Detection
   ========================= */

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

/* =========================
   Bundles
   ========================= */

/**
 * Returns true if a catalog card represents a bundle.
 * Centralized so UI doesn’t guess or duplicate logic.
 */
export function isBundle(card: Pick<CatalogCard, "is_bundle"> | null | undefined): boolean {
  return !!card?.is_bundle;
}

/**
 * Produces a short human-readable summary for bundle cards.
 * Example:
 *   "Includes: PS5, God of War, Controller"
 */
export function formatBundleIncludesSummary(
  components: BundleComponent[] | null | undefined,
  opts?: { maxItems?: number }
): string | null {
  if (!components || components.length === 0) return null;

  const maxItems = typeof opts?.maxItems === "number" ? opts!.maxItems : 3;

  const names = components
    .map((c) => c.component?.name)
    .filter(Boolean) as string[];

  if (names.length === 0) return null;

  const shown = names.slice(0, maxItems);
  const remaining = names.length - shown.length;

  if (remaining > 0) {
    return `Includes: ${shown.join(", ")} + ${remaining} more`;
  }

  return `Includes: ${shown.join(", ")}`;
}

/**
 * Determines whether an item should show an "Included In" section.
 */
export function shouldShowIncludedIn(bundles: { id: string }[] | null | undefined): boolean {
  return Array.isArray(bundles) && bundles.length > 0;
}

/**
 * Determines whether a bundle should show its Included Items tab.
 */
export function shouldShowIncludedItems(isBundleFlag: boolean | null | undefined): boolean {
  return !!isBundleFlag;
}
