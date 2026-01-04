"use client";

import { supabase } from "@/lib/supabaseClient";

export type CatalogListRow = {
  id: string;
  name: string;
  version: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;
  franchise_name?: string | null;
  card_set_id?: string | null;
  card_set_name?: string | null;
  production_status: string | null;
  image_url?: string | null;
  publisher: string | null;
  upc: string | null;
  card_number?: string | null;
  release_year: number | null;
  release_month: number | null;
  release_day: number | null;
  end_year: number | null;
  end_month: number | null;
  end_day: number | null;
  epid_ebay: string | null;
  tcgplayer_id?: string | null;
  
  // Pricing
  avg_value_cad: number | null;
  market_price_cad: number | null;

  // Genre + Age Rating
  genre_ids?: string[] | null;
  genre_names?: string[] | null;
  age_rating_id?: string | null;
  age_rating_name?: string | null;

  is_wishlisted?: boolean;
  building_blocks?: {
    set_number: string | null;
    piece_count: number | null;
    retail_cad: number | null;
    retail_usd: number | null;
  } | null;
};

function toNumOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchCatalogListRows(params: {
  ids?: string[] | null;
  search?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  franchiseId?: string | null;
  limit?: number;
  userId?: string | null;
}) {
  const limit = params.limit ?? 50;
  const ids = (params.ids ?? []).filter(Boolean);

  // ✅ FIXED: Changed age_ratings join to only select 'rating' 
  // because the database confirmed 'name' does not exist.
  const select = `
    *,
    franchises:franchise_id ( name ),
    card_sets:card_set_id ( name ),
    age_ratings:age_rating_id ( rating )
  `;

  let q = supabase.from("catalog_items").select(select);

  if (ids.length > 0) {
    q = q.in("id", ids);
  } else {
    if (params.categoryId) q = q.eq("category_id", params.categoryId);
    if (params.subcategoryId) q = q.eq("subcategory_id", params.subcategoryId);
    if (params.franchiseId) q = q.eq("franchise_id", params.franchiseId);
    if (params.search?.trim()) q = q.ilike("name", `%${params.search.trim()}%`);
    q = q.limit(limit);
  }

  const { data, error } = await q;
  if (error) throw error;

  const { data: allGenres } = await supabase.from("genres").select("id, name");
  const genreMap = new Map((allGenres || []).map(g => [g.id, g.name]));

  const foundIds = (data ?? []).map(r => r.id);
  const { data: bbData } = await supabase
    .from("catalog_building_blocks_rows")
    .select("*")
    .in("catalog_item_id", foundIds);

  const normalised: CatalogListRow[] = data.map((r) => {
    const bb = bbData?.find(b => b.catalog_item_id === r.id);
    const gIds = (r.genre_ids || []) as string[];

    return {
      id: r.id,
      name: r.name,
      version: r.version,
      category_id: r.category_id,
      subcategory_id: r.subcategory_id,
      franchise_id: r.franchise_id,
      franchise_name: r.franchises?.name,
      card_set_id: r.card_set_id,
      card_set_name: r.card_sets?.name,
      production_status: r.production_status,
      image_url: r.image_url,
      publisher: r.publisher,
      upc: r.upc,
      card_number: r.card_number,
      release_year: r.release_year,
      release_month: r.release_month,
      release_day: r.release_day,
      end_year: r.end_year,
      end_month: r.end_month,
      end_day: r.end_day,
      epid_ebay: r.epid_ebay,
      tcgplayer_id: r.tcgplayer_id,

      avg_value_cad: toNumOrNull(r.market_value_cad || r.avg_overall_price_cad),
      market_price_cad: toNumOrNull(r.ch_avg_30d_price_cad || r.market_price_cad),

      genre_ids: gIds,
      genre_names: gIds.map(id => genreMap.get(id)).filter(Boolean) as string[],
      
      // ✅ FIXED: Using .rating only here
      age_rating_name: r.age_ratings?.rating || null,

      building_blocks: bb ? {
        set_number: bb.set_number,
        piece_count: toNumOrNull(bb.piece_count),
        retail_cad: toNumOrNull(bb.retail_cad),
        retail_usd: toNumOrNull(bb.retail_usd)
      } : null,

      is_wishlisted: false
    };
  });

  return normalised;
}
