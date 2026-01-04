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

  // ✅ “description fields without the text”
  publisher: string | null; // legacy text column
  upc: string | null;

  release_year: number | null;
  release_month: number | null;
  release_day: number | null;

  end_year: number | null;
  end_month: number | null;
  end_day: number | null;

  epid_ebay: string | null;

  // ✅ card-only identifiers
  card_set_id?: string | null;
  card_number?: string | null;
  tcgplayer_id?: string | null;

  // ✅ normalised platform/publisher (handles weird column names)
  platform_id?: string | null;
  game_publisher_id?: string | null;

  // ✅ names (best-effort; may be null if schema doesn’t join cleanly)
  platform_name?: string | null;
  publisher_name?: string | null;

  // ✅ Normalised 1:1-ish join
  building_blocks?: {
    set_number: number | null;
    piece_count: number | null;
    retail_cad: number | null;
    retail_usd: number | null;
  } | null;
};

// Raw join shape from Supabase (arrays + optional nested join objects)
type CatalogListRowRaw = {
  [key: string]: any;

  building_blocks?: Array<{
    set_number: any;
    piece_count: any;
    retail_cad: any;
    retail_usd: any;
  }> | null;

  // If your FKs are clean these will appear; if not, they’ll be null
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

function pickFirst(row: any, keys: string[]) {
  for (const k of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, k)) {
      const v = row[k];
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

export async function fetchCatalogListRows(params: {
  // ✅ fetch by specific ids (used by CatalogGrid list toggle)
  ids?: string[] | null;

  search?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  franchiseId?: string | null;
  limit?: number;
}) {
  const ids = (params.ids ?? []).filter(Boolean);
  const limit = params.limit ?? 100;

  // IMPORTANT:
  // - We SELECT multiple possible column names for platform/publisher IDs because your table has casing variants.
  // - We do NOT select the free-text description (big payload). We select structured fields only.
  let q = supabase.from("catalog_items").select(`
    id,
    name,
    version,
    category_id,
    subcategory_id,
    franchise_id,
    production_status,
    image_url,

    publisher,
    upc,

    release_year,
    release_month,
    release_day,

    end_year,
    end_month,
    end_day,

    epid_ebay,

    card_set_id,
    card_number,
    tcgplayer_id,

    platform_id,
    Platform_id,
    game_platform_id,

    game_publisher_id,
    publisher_id,
    Publisher_Id,
    Publisher_id,

    game_platforms:game_platforms ( name ),
    game_publishers:game_publishers ( name ),

    building_blocks:catalog_building_blocks_rows (
      set_number,
      piece_count,
      retail_cad,
      retail_usd
    )
  `);

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
    const row: any = r as any;

    const bb0 = (row.building_blocks ?? [])?.[0] ?? null;

    // Normalise platform/publisher IDs from whatever the table actually has
    const platformId =
      pickFirst(row, ["platform_id", "Platform_id", "game_platform_id"]) ?? null;

    const publisherId =
      pickFirst(row, ["game_publisher_id", "publisher_id", "Publisher_Id", "Publisher_id"]) ??
      null;

    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      version: row.version ?? null,

      category_id: row.category_id ?? null,
      subcategory_id: row.subcategory_id ?? null,
      franchise_id: row.franchise_id ?? null,

      production_status: row.production_status ?? null,
      image_url: row.image_url ?? null,

      publisher: row.publisher ?? null,
      upc: row.upc ?? null,

      release_year: toIntOrNull(row.release_year),
      release_month: toIntOrNull(row.release_month),
      release_day: toIntOrNull(row.release_day),

      end_year: toIntOrNull(row.end_year),
      end_month: toIntOrNull(row.end_month),
      end_day: toIntOrNull(row.end_day),

      epid_ebay: row.epid_ebay ?? null,

      card_set_id: row.card_set_id ?? null,
      card_number: row.card_number ?? null,
      tcgplayer_id: row.tcgplayer_id ?? null,

      platform_id: platformId ? String(platformId) : null,
      game_publisher_id: publisherId ? String(publisherId) : null,

      // Best-effort names from joins (only works if your FK is clean)
      platform_name: row.game_platforms?.name ?? null,
      publisher_name: row.game_publishers?.name ?? null,

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

  // ✅ If ids were provided, return rows in the same order as ids
  if (ids.length) {
    const byId = new Map(normalised.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as CatalogListRow[];
  }

  return normalised;
}
