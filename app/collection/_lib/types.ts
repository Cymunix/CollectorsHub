// app/collection/_lib/types.ts

export type ConditionMode = "raw" | "graded" | "unknown";

export type RawCondition = { score: number };

export type GradedCondition = {
  company: string;
  grade: string;
  cert?: string | null;
};

export type ConditionInfo =
  | { mode: "raw"; raw: RawCondition }
  | { mode: "graded"; graded: GradedCondition }
  | { mode: "unknown" };

export type CollectionCopyRow = {
  id: string;
  catalog_item_id: string;
  created_at: string | null;

  graded: boolean | null;
  grade: string | null;
  quantity: number | null;

  // optional if you have it
  for_sale?: boolean | null;

  condition_json?: any | null;
};

export type CatalogItemRow = {
  id: string;
  name: string;
  image_url: string | null;

  // optional
  kind?: string | null;
};

// ✅ rows from user_collection_item_minifigs
export type CollectionItemMinifigRow = {
  id: string;
  user_collection_item_id: string;
  minifig_id: string;
  included: boolean;
  included_qty: number;
  created_at: string | null;
};

// ✅ minifig catalog table
export type CatalogMinifigRow = {
  id: string;
  name: string | null;
  minifig_number: string | null;
  image_url: string | null;
};

export type CollectionEntity = "catalog_item" | "minifig";

export type CollectionCardModel = {
  entity: CollectionEntity;

  // for catalog_item: catalogItemId is the catalog_items.id
  // for minifig: catalogItemId is the catalog_minifigs.id (still just an id)
  catalogItemId: string;

  href: string; // ✅ lets cards navigate correctly

  name: string;
  photoUrl: string | null;

  copiesCount: number; // for minifigs: summed included_qty
  condition: ConditionInfo;

  kind: string | null; // includes "minifig"
  forSale: boolean | null; // usually null for minifigs unless you add support later
};
