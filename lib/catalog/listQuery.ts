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

  publisher: string | null; // legacy text column
  upc: string | null;

  release_year: number | null;
  release_month: number | null;
  release_day: number | null;

  end_year: number | null;
  end_month: number | null;
  end_day: number | null;

  epid_ebay: string | null;

  card_set_id?: string | null;
  card_number?: string | null;
  tcgplayer_id?: string | null;

  platform_id?: string | null;
  game_publisher_id?: string | null;

  platform_name?: string | null;
  publisher_name?: string | null;

  building_blocks?: {
    set_number: number | null;
    piece_count: number | null;
    retail_cad: number | null;
    retail_usd: number | null;
  } | null;
};

type CatalogListRowRaw = { [key: string]: any };

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

type BuildingBlockRaw = {
  [key: string]: any;
  set_number?: any;
  piece_count?: any;
  retail_cad?: any;
  retail_usd?: any;
};

function pickItemIdFromBB(row: BuildingBlockRaw): string | null {
  const v = pickFirst(row, ["catalog_item_id", "catalog_items_id", "item_id", "catalogItemId"]);
  return v ? String(v) : null;
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

  // 1) Fetch catalog items (NO building_blocks join)
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
    game_publishers:game_publishers ( name )
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

    const platformId = pickFirst(row, ["platform_id", "Platform_id", "game_platform_id"]) ?? null;
    const publisherId =
      pickFirst(row, ["game_publisher_id", "publisher_id", "Publisher_Id", "Publisher_id"]) ?? null;

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

      platform_name: row.game_platforms?.name ?? null,
      publisher_name: row.game_publishers?.name ?? null,

      building_blocks: null,
    };
  });

  // 2) Fetch building blocks for these items and merge
  const itemIds = normalised.map((r) => r.id);

  if (itemIds.length) {
    // IMPORTANT: we select possible FK column names because your schema has naming inconsistencies.
    const { data: bbData, error: bbErr } = await supabase
      .from("catalog_building_blocks_rows")
      .select(`
        catalog_item_id,
        catalog_items_id,
        item_id,
        set_number,
        piece_count,
        retail_cad,
        retail_usd
      `)
      .in("catalog_item_id", itemIds);

    // If the FK column isn't catalog_item_id, the query above might return 0 rows.
    // So we do a fallback attempt for other common column names.
    let bbRows: BuildingBlockRaw[] = (bbData ?? []) as any;

    if (!bbErr && bbRows.length === 0) {
      const tryCols = ["catalog_items_id", "item_id"] as const;

      for (const col of tryCols) {
        const { data: d2, error: e2 } = await supabase
          .from("catalog_building_blocks_rows")
          .select(`
            catalog_item_id,
            catalog_items_id,
            item_id,
            set_number,
            piece_count,
            retail_cad,
            retail_usd
          `)
          // @ts-expect-error - dynamic column name
          .in(col, itemIds);

        if (e2) continue;
        const rows2 = (d2 ?? []) as any[];
        if (rows2.length) {
          bbRows = rows2 as any;
          break;
        }
      }
    }

    // If there *was* an error on the first attempt, throw it (real failure).
    if (bbErr) throw bbErr;

    // Map first BB row per item
    const bbByItem = new Map<string, BuildingBlockRaw>();
    for (const r of bbRows) {
      const itemId = pickItemIdFromBB(r);
      if (!itemId) continue;
      if (!bbByItem.has(itemId)) bbByItem.set(itemId, r);
    }

    for (const r of normalised) {
      const bb = bbByItem.get(r.id);
      if (!bb) continue;

      r.building_blocks = {
        set_number: toNumOrNull(bb.set_number),
        piece_count: toNumOrNull(bb.piece_count),
        retail_cad: toNumOrNull(bb.retail_cad),
        retail_usd: toNumOrNull(bb.retail_usd),
      };
    }
  }

  // 3) Preserve requested order
  if (ids.length) {
    const byId = new Map(normalised.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as CatalogListRow[];
  }

  return normalised;
}
