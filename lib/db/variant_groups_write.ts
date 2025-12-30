import { supabase } from "@/lib/supabaseClient";

export type VariantDraft = {
  target_id: string;
  target_name?: string;
  link_type?: string;
  label?: string;
};

export async function applyVariantGroupLinks(params: {
  catalogItemId: string;
  linkedVariants: VariantDraft[];
  variantName?: string | null;
}) {
  const { catalogItemId, linkedVariants, variantName } = params;

  // Optional: store variant label on the created item
  if (variantName && variantName.trim()) {
    const { error } = await supabase
      .from("catalog_items")
      .update({ variant_name: variantName.trim() })
      .eq("id", catalogItemId);

    if (error) throw new Error(`Saving variant_name failed: ${error.message}`);
  }

  const ids = (linkedVariants ?? [])
    .map((v) => String(v?.target_id ?? "").trim())
    .filter(Boolean);

  if (!ids.length) return;

  const anchorId = ids[0];

  // Link the new item into the anchor's group (creates group if missing)
  {
    const { error } = await supabase.rpc("link_catalog_variant", {
      p_source_item_id: catalogItemId,
      p_target_item_id: anchorId,
    });

    if (error) throw new Error(`link_catalog_variant(new->anchor) failed: ${error.message}`);
  }

  // Merge any other selected items into that same group
  for (let i = 1; i < ids.length; i++) {
    const otherId = ids[i];
    if (!otherId || otherId === anchorId) continue;

    const { error } = await supabase.rpc("link_catalog_variant", {
      p_source_item_id: otherId,
      p_target_item_id: anchorId,
    });

    if (error) throw new Error(`link_catalog_variant(merge) failed: ${error.message}`);
  }
}
