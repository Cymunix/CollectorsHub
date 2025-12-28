import { supabase } from "@/lib/supabaseClient";

/**
 * One minifig entry for a specific owned copy
 */
export type CopyMinifigQty = {
  minifig_id: string;
  included_qty: number;
};

/**
 * Load minifigs + qty for ONE user collection item (copy)
 */
export async function loadCopyMinifigs(userCollectionItemId: string) {
  const { data, error } = await supabase
    .from("user_collection_item_minifigs")
    .select(`
      minifig_id,
      included_qty,
      catalog_minifigs (
        name,
        minifig_number
      )
    `)
    .eq("user_collection_item_id", userCollectionItemId)
    .order("minifig_id");

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    minifig_id: r.minifig_id,
    included_qty: r.included_qty ?? 0,
    name: r.catalog_minifigs?.name ?? null,
    minifig_number: r.catalog_minifigs?.minifig_number ?? null,
  }));
}

/**
 * Save minifig quantities for ONE user collection item (copy)
 * This is the SOURCE OF TRUTH.
 */
export async function saveCopyMinifigs(args: {
  userCollectionItemId: string;
  rows: CopyMinifigQty[];
}) {
  const { userCollectionItemId, rows } = args;

  const cleanRows = (rows ?? []).map((r) => ({
    user_collection_item_id: userCollectionItemId,
    minifig_id: r.minifig_id,
    included_qty: Math.max(0, Math.floor(Number(r.included_qty ?? 0))),
  }));

  // Upsert quantities
  if (cleanRows.length > 0) {
    const { error } = await supabase
      .from("user_collection_item_minifigs")
      .upsert(cleanRows, {
        onConflict: "user_collection_item_id,minifig_id",
      });

    if (error) throw new Error(error.message);
  }

  // Remove rows that are no longer present
  const keepIds = cleanRows.map((r) => r.minifig_id);

  if (keepIds.length === 0) {
    const { error } = await supabase
      .from("user_collection_item_minifigs")
      .delete()
      .eq("user_collection_item_id", userCollectionItemId);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("user_collection_item_minifigs")
    .delete()
    .eq("user_collection_item_id", userCollectionItemId)
    .not("minifig_id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);

  if (error) throw new Error(error.message);
}
