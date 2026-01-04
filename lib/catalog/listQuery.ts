// lib/catalog/listQuery.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

export type CatalogListRow = {
  id: string;
  name: string;
  version: string | null;

  category_id: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;

  production_status: string | null;

  // If you have an image url field in catalog_items, keep it.
  // Change this to match your schema.
  image_url?: string | null;

  // LEGO join (nullable)
  building_blocks?: {
    set_number: number | null;
    piece_count: number | null;
    retail_cad: number | null;
    retail_usd: number | null;
  } | null;
};

export async function fetchCatalogListRows(params: {
  search?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  franchiseId?: string | null;
  limit?: number;
}) {
  const limit = params.limit ?? 100;

  // NOTE: "building_blocks" is an alias for the joined table.
  // If your relationship name differs, adjust accordingly.
  let q = supabase
    .from("catalog_items")
    .select(
      `
        id,
        name,
        version,
        category_id,
        subcategory_id,
        franchise_id,
        production_status,
        image_url,
        building_blocks:catalog_building_blocks_rows (
          set_number,
          piece_count,
          retail_cad,
          retail_usd
        )
      `
    )
    .limit(limit);

  if (params.categoryId) q = q.eq("category_id", params.categoryId);
  if (params.subcategoryId) q = q.eq("subcategory_id", params.subcategoryId);
  if (params.franchiseId) q = q.eq("franchise_id", params.franchiseId);

  // Basic search (swap for your existing full-text search if you have it)
  if (params.search && params.search.trim().length) {
    q = q.ilike("name", `%${params.search.trim()}%`);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []) as CatalogListRow[];
}
