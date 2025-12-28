import { supabase } from "@/lib/supabaseClient";

export async function loadItemWorthCad(catalogItemId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("catalog_item_prices")
    .select("market_cad")
    .eq("catalog_item_id", catalogItemId)
    .maybeSingle();

  if (error) return null;

  const v = Number((data as any)?.market_cad);
  return Number.isFinite(v) ? v : null;
}
