import { supabase } from "@/lib/supabaseClient";

export async function upsertItemDescription(catalogItemId: string, description: string | null | undefined) {
  const text = String(description ?? "").trim();
  if (!text) return;

  const res = await supabase
    .from("catalog_item_descriptions")
    .upsert(
      { catalog_item_id: catalogItemId, description: text, updated_at: new Date().toISOString() },
      { onConflict: "catalog_item_id" }
    );

  if (res.error) throw res.error;
}

export async function replaceVariantLinks(opts: {
  catalogItemId: string;
  linkedVariants: any[];
  defaultType?: string;
  defaultLabel?: string;
}) {
  const { catalogItemId, linkedVariants, defaultType, defaultLabel } = opts;

  // wipe existing links (simple + reliable)
  const delRes = await supabase.from("catalog_item_variant_links").delete().eq("catalog_item_id", catalogItemId);
  if (delRes.error) throw delRes.error;

  const rows = (linkedVariants ?? [])
    .map((v, idx) => {
      const variantId = String(v?.variant_catalog_item_id ?? v?.catalog_item_id ?? v?.id ?? "").trim();
      if (!variantId) return null;

      return {
        catalog_item_id: catalogItemId,
        variant_catalog_item_id: variantId,
        link_type: String(v?.type ?? defaultType ?? "variant"),
        label: String(v?.label ?? defaultLabel ?? "").trim() || null,
        sort_order: idx,
      };
    })
    .filter(Boolean) as any[];

  if (!rows.length) return;

  const insRes = await supabase.from("catalog_item_variant_links").insert(rows);
  if (insRes.error) throw insRes.error;
}
