import { supabase } from "@/lib/supabaseClient";

type LinkedVariant = {
  catalogItemId: string; // <-- IMPORTANT: must match what your VariantsSection produces
  // anything else is ignored here
};

export async function applyVariantGroupLinks(params: {
  catalogItemId: string;
  linkedVariants: LinkedVariant[];
  variantName?: string | null; // optional label to save to catalog_items.variant_name
}) {
  const { catalogItemId, linkedVariants, variantName } = params;

  // Optional: store the variant name/label on the created item
  if (variantName && variantName.trim()) {
    const { error: nameErr } = await supabase
      .from("catalog_items")
      .update({ variant_name: variantName.trim() })
      .eq("id", catalogItemId);

    if (nameErr) throw new Error(nameErr.message);
  }

  if (!linkedVariants?.length) return;

  // 1) Link the new item into the target group (first selection becomes the anchor)
  const targetId = linkedVariants[0]?.catalogItemId;
  if (!targetId) return;

  const { error: linkErr } = await supabase.rpc("link_catalog_variant", {
    p_source_item_id: catalogItemId,
    p_target_item_id: targetId,
  });

  if (linkErr) throw new Error(linkErr.message);

  // 2) Merge any other selected variants into the same group (important!)
  // This guarantees that if user selected items from different groups, they end up unified.
  for (let i = 1; i < linkedVariants.length; i++) {
    const otherId = linkedVariants[i]?.catalogItemId;
    if (!otherId || otherId === targetId) continue;

    const { error: mergeErr } = await supabase.rpc("link_catalog_variant", {
      p_source_item_id: otherId,
      p_target_item_id: targetId,
    });

    if (mergeErr) throw new Error(mergeErr.message);
  }
}
