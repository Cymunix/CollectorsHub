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

  image_url?: string | null;

  // ✅ games
  platform_id?: string | null;
  platform_name?: string | null;

  game_publisher_id?: string | null;
  publisher_name?: string | null;

  // ✅ common meta
  release_year?: number | null;

  // Normalised 1:1-ish join
  building_blocks?: {
    set_number: number | null;
    piece_count: number | null;
    retail_cad: number | null;
    retail_usd: number | null;
  } | null;
};

// Raw join shape from Supabase (arrays + nested objects)
type CatalogListRowRaw = Omit<CatalogListRow, "building_blocks"> & {
  building_blocks?: Array<{
    set_number: any;
    piece_count: any;
    retail_cad: any;
    retail_usd: any;
  }> | null;

  game_platforms?: { name?: any } | null;
  game_publishers?: { name?: any } | null;
};

function toNumOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: any): number | null {
  const n = toNumOrNull(v);
  return n === null ? null : Math.trunc(n);
}

export async function fetchCatalogListRows(params: {
  ids?: string[] | null;

  search?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  franchiseId?: string | null;
  limit?: number;
}) {
  const ids = (params.ids ?? []).filter(Boolean);
  const limit = params.limit ?? 100;

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
        release_year,

        platform_id,
        game_publisher_id,

        game_platforms:game_platforms ( name ),
        game_publishers:game_publishers ( name ),

        building_blocks:catalog_building_blocks_rows (
          set_number,
          piece_count,
          retail_cad,
          retail_usd
        )
      `
    );

  if (ids.length) {
    q = q.in("id", ids);
  } else {
    q = q.limit(limit);

    if (params.categoryId) q = q.eq("category_id", params.categoryId);
    if (params.subcategoryId) q = q.eq("subcategory_id", params.subcategoryId);
    if (params.franchiseId) q = q.eq("franchise_id", params.franchiseId);

    if (params.search && params.search.trim().length) {
      q = q.ilike("name", `%${params.search.trim()}%`);
    }
  }

  const { data, error } = await q;
  if (error) throw error;

  const raw = (data ?? []) as unknown as CatalogListRowRaw[];

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

      release_year: toIntOrNull((r as any).release_year),

      platform_id: (r as any).platform_id ?? null,
      platform_name: (r as any).game_platforms?.name ?? null,

      game_publisher_id: (r as any).game_publisher_id ?? null,
      publisher_name: (r as any).game_publishers?.name ?? null,

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

  if (ids.length) {
    const byId = new Map(normalised.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as CatalogListRow[];
  }

  return normalised;
}
