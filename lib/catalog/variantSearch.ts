import { supabase } from "@/lib/supabaseClient";

export type VariantFamily = {
  variant_group_id: string | null;
  base_catalog_item_id: string;
  items: Array<{
    id: string;
    name: string | null;
    upc: string | null;
    variant_name: string | null;
    variant_rank: number | null;
    variant_group_id: string | null;
    base_catalog_item_id: string | null;
  }>;
};

export async function searchVariantFamilies(query: string, limit = 20): Promise<VariantFamily[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase.rpc("search_variant_families", {
    p_query: q,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);

  // Supabase returns JSON types as native objects
  return (data ?? []).map((row: any) => ({
    variant_group_id: row.variant_group_id ? String(row.variant_group_id) : null,
    base_catalog_item_id: String(row.base_catalog_item_id),
    items: Array.isArray(row.items) ? row.items : [],
  }));
}
