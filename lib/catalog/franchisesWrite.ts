// lib/catalog/franchisesWrite.ts
import { supabase } from "@/lib/supabaseClient";

type FranchiseRole = "primary" | "secondary" | "crossover";

export type ItemFranchiseDraft = {
  franchise_id: string;
  role: FranchiseRole;
};

export async function replaceItemFranchises(catalogItemId: string, next: ItemFranchiseDraft[]) {
  // 1) delete all existing
  const del = await supabase
    .from("catalog_item_franchises")
    .delete()
    .eq("catalog_item_id", catalogItemId);

  if (del.error) throw del.error;

  // 2) insert new
  if (next.length === 0) return;

  const ins = await supabase.from("catalog_item_franchises").insert(
    next.map((x) => ({
      catalog_item_id: catalogItemId,
      franchise_id: x.franchise_id,
      role: x.role,
    }))
  );

  if (ins.error) throw ins.error;
}
