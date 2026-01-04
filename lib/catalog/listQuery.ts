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

  // Change this if your field differs
  image_url?: string | null;

  // Normalised 1:1-ish join
  building_blocks?: {
    set_number: number | null;
    piece_count: number | null;
    retail_cad: number | null;
    retail_usd: number | null;
  } | null;
};

// Raw shape Supabase returns for joined tables (arrays)
type CatalogListRowRaw = Omit<CatalogListRow, "building_blocks"> & {
  building_blocks?: Array<{
    set_number: any;
    piece_count: any;
    retail_cad: any;
    retail_usd: any;
  }> | null;
};

function toNumOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchCatalogListRows(params: {
  search?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  franchiseId?: string | null;
  limit?: number;
}) {
  const limit = params.limit ?? 100;

  // NOTE:
  // Supabase returns joined tables as arrays by default.
  // We'll normalise building_blocks to a single object (first row) below.
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

  if (params.search && params.search.trim().length) {
    q = q.ilike("name", `%${params.search.trim()}%`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const raw = (data ?? []) as unknown as CatalogListRowRaw[];

  // Normalise join arrays → single object
  const normalised: CatalogListRow[] = raw.map((r) => {
    const bb0 = (r.building_blocks ?? [])?.[0] ?? null;

    return {
      id: String((r as any).id),
      name: String((r as any).name ?? ""),
      version: (r as any).version ?? null,

      category_id: (r as any).category_id ?? null,
      subcategory_id: (r as any).subcategory_id ?? null,
      franchise_id: (r as any).franchise_id ?? null,

      production_status: (r as any).production_status ?? null,

      image_url: (r as any).image_url ?? null,

      building_blocks: bb0
        ? {
            set_number: toNumOrNull(bb0.set_number),
            piece_count: toNumOrNull(bb0.piece_count),
            retail_cad: toNumOrNull(bb0.retail_cad),
            retail_usd: toNumOrNull(bb0.retail_usd),
          }
        : null,
    };
  });

  return normalised;
}
