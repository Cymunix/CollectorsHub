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
  publisher_id?: string | null;

  platform_name?: string | null;
  publisher_name?: string | null;

  // ✅ NEW: Genre + Age Rating (ids + display names)
  genre_id?: string | null;
  age_rating_id?: string | null;
  genre_name?: string | null;
  age_rating_name?: string | null;

  // ✅ persisted wishlist state for this user
  is_wishlisted?: boolean;

  building_blocks?: {
    set_number: number | null;
    piece_count: number | null;
    retail_cad: number | null;
    retail_usd: number | null;
  } | null;
};

type CatalogListRowRaw = {
  [key: string]: any;

  game_platforms?: { name?: any } | null;
  game_publishers?: { name?: any } | null;

  // ✅ NEW: joined lookups
  genres?: { name?: any } | null;
  age_ratings?: { name?: any } | null;
};

type BuildingBlockRaw = {
  [key: string]: any;
  catalog_item_id?: any;
  catalog_items_id?: any;
  item_id?: any;
  set_number?: any;
  piece_count?: any;
  retail_cad?: any;
  retail_usd?: any;
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

function pickItemIdFromBB(row: BuildingBlockRaw): string | null {
  const v = pickFirst(row, ["catalog_item_id", "catalog_items_id", "item_id"]);
  return v ? String(v) : null;
}

function toStrOrNull(v: any): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

async function fetchWishlistedSet(userId: string, itemIds: string[]) {
  if (!userId || !itemIds.length) return new Set<string>();

  const { data, error } = await supabase
    .from("user_wishlist_items")
    .select("catalog_item_id")
    .eq("user_id", userId)
    .in("catalog_item_id", itemIds);

  if (error) throw error;

  return new Set((data ?? []).map((r: any) => String(r.catalog_item_id)));
}

export async function fetchCatalogListRows(params: {
  ids?: string[] | null;

  search?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  franchiseId?: string | null;
  limit?: number;

  // ✅ pass current user id to get is_wishlisted
  userId?: string | null;
}) {
  const ids = (params.ids ?? []).filter(Boolean);
  const limit = params.limit ?? 100;

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
    publisher_id,

    game_platforms:game_platforms ( name ),
    game_publishers:game_publishers ( name ),

    -- ✅ NEW: Genre + Age Rating joins
    genre_id,
    age_rating_id,
    genres:genres ( name ),
    age_ratings:age_ratings ( name )
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

      platform_id: row.platform_id ? String(row.platform_id) : null,
      publisher_id: row.publisher_id ? String(row.publisher_id) : null,

      platform_name: toStrOrNull(row.game_platforms?.name ?? null),
      publisher_name: toStrOrNull(row.game_publishers?.name ?? null),

      // ✅ NEW: genre + age rating
      genre_id: row.genre_id ? String(row.genre_id) : null,
      age_rating_id: row.age_rating_id ? String(row.age_rating_id) : null,
      genre_name: toStrOrNull(row.genres?.name ?? null),
      age_rating_name: toStrOrNull(row.age_ratings?.name ?? null),

      is_wishlisted: false,

      building_blocks: null,
    };
  });

  // Manual merge: building blocks (no PostgREST relationship)
  const itemIds = normalised.map((r) => r.id);

  if (itemIds.length) {
    const selectBB = `
      catalog_item_id,
      catalog_items_id,
      item_id,
      set_number,
      piece_count,
      retail_cad,
      retail_usd
    `;

    let bbRows: BuildingBlockRaw[] = [];

    const { data: bb1, error: bbErr1 } = await supabase
      .from("catalog_building_blocks_rows")
      .select(selectBB)
      .in("catalog_item_id", itemIds);

    if (!bbErr1) bbRows = (bb1 ?? []) as any[];

    if (bbRows.length === 0) {
      const tryCols = ["catalog_items_id", "item_id"] as const;
      for (const col of tryCols) {
        const builder: any = supabase.from("catalog_building_blocks_rows").select(selectBB);
        const { data: d2, error: e2 } = await builder.in(col, itemIds);
        if (e2) continue;
        const rows2 = (d2 ?? []) as any[];
        if (rows2.length) {
          bbRows = rows2 as any;
          break;
        }
      }
    }

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

  // ✅ Wishlist merge (persisted)
  if (params.userId) {
    const wishSet = await fetchWishlistedSet(params.userId, itemIds);
    for (const r of normalised) {
      r.is_wishlisted = wishSet.has(r.id);
    }
  }

  // Preserve requested order
  if (ids.length) {
    const byId = new Map(normalised.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as CatalogListRow[];
  }

  return normalised;
}
