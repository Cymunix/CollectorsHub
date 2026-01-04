// lib/catalog/focus.ts
export type Focus =
  | { type: "none" }
  | { type: "item"; itemId: string }
  | { type: "franchise"; franchiseId: string }
  | {
      type: "franchise_scope";
      franchiseId: string;
      // exactly one of these can be used initially; expand later
      brandId?: string | null;
      manufacturerId?: string | null;
      categoryId?: string | null;
      subcategoryId?: string | null;
    };

export function focusKey(f: Focus) {
  if (f.type === "none") return "none";
  if (f.type === "item") return `item:${f.itemId}`;
  if (f.type === "franchise") return `franchise:${f.franchiseId}`;
  if (f.type === "franchise_scope") {
    const parts = [
      `franchise_scope:${f.franchiseId}`,
      f.brandId ? `brand:${f.brandId}` : null,
      f.manufacturerId ? `manufacturer:${f.manufacturerId}` : null,
      f.categoryId ? `category:${f.categoryId}` : null,
      f.subcategoryId ? `subcategory:${f.subcategoryId}` : null,
    ].filter(Boolean);
    return parts.join("|");
  }
  return "none";
}
