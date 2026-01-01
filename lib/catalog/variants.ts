// lib/db/variants.ts

import { supabase } from "@/lib/supabaseClient";

export type LinkVariantResult = {
  variantGroupId: string;
};

export async function linkVariantToVariant(params: {
  sourceItemId: string; // e.g. Ultimate
  targetItemId: string; // e.g. Standard (or any variant already in group)
}): Promise<LinkVariantResult> {
  const { sourceItemId, targetItemId } = params;

  const { data, error } = await supabase.rpc("link_catalog_variant", {
    p_source_item_id: sourceItemId,
    p_target_item_id: targetItemId,
  });

  if (error) throw new Error(error.message);

  // RPC returns uuid as string
  return { variantGroupId: String(data) };
}

export async function fetchVariantGroupItems(variantGroupId: string) {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, name, variant_name, variant_rank, base_catalog_item_id, variant_group_id, is_bundle")
    .eq("variant_group_id", variantGroupId)
    .order("variant_rank", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
