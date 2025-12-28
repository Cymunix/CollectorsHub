// lib/db/catalog.ts
import { supabase } from "@/lib/supabaseClient";

export type CatalogItemRow = {
  id: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;
  upc: string | null;
  release_year: number | null;
  version?: string | null;
};

export type CatalogMinifigRow = {
  minifig_id: string;
  name: string | null;
  minifig_number: string | null;
  image_url: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;
};

export type SimpleLookup = { id: string; name: string };

export type ConnectedMinifig = {
  minifig_id: string;
  minifig_number: string;
  name: string | null;
  image_url: string | null;
};

export async function getCatalogItemById(id: string): Promise<CatalogItemRow | null> {
  const res = await supabase
    .from("catalog_items")
    .select("id,name,category_id,subcategory_id,franchise_id,upc,release_year,version")
    .eq("id", id)
    .maybeSingle();

  if (res.error) throw res.error;
  return (res.data as any) ?? null;
}

export async function getCatalogMinifigById(minifigId: string): Promise<CatalogMinifigRow | null> {
  const res = await supabase
    .from("catalog_minifigs")
    .select("minifig_id,name,minifig_number,image_url,subcategory_id,franchise_id")
    .eq("minifig_id", minifigId)
    .maybeSingle();

  if (res.error) throw res.error;
  return (res.data as any) ?? null;
}

export async function getCategoryById(id: string): Promise<SimpleLookup | null> {
  const res = await supabase.from("categories").select("id,name").eq("id", id).maybeSingle();
  if (res.error) throw res.error;
  return (res.data as any) ?? null;
}

export async function getSubcategoryById(id: string): Promise<SimpleLookup | null> {
  const res = await supabase.from("subcategories").select("id,name").eq("id", id).maybeSingle();
  if (res.error) throw res.error;
  return (res.data as any) ?? null;
}

export async function getFranchiseById(id: string): Promise<SimpleLookup | null> {
  const res = await supabase.from("franchises").select("id,name").eq("id", id).maybeSingle();
  if (res.error) throw res.error;
  return (res.data as any) ?? null;
}

export async function getReviewSummary(catalogItemId: string): Promise<{ avg: number; count: number }> {
  const res = await supabase
    .from("catalog_item_reviews")
    .select("rating", { count: "exact" })
    .eq("catalog_item_id", catalogItemId);

  if (res.error) return { avg: 0, count: 0 };

  const rows = res.data ?? [];
  const count = (res.count ?? rows.length) as number;

  if (!count || count <= 0) return { avg: 0, count: 0 };

  const rawAvg = rows.reduce((sum: number, r: any) => sum + Number(r?.rating ?? 0), 0) / count;
  const avg = Math.round(rawAvg * 10) / 10;

  return { avg, count };
}

export async function isBuildingBlocksCatalogItem(catalogItemId: string): Promise<boolean> {
  const res = await supabase
    .from("catalog_building_blocks")
    .select("catalog_item_id")
    .eq("catalog_item_id", catalogItemId)
    .maybeSingle();

  if (res.error) return false;
  return !!res.data?.catalog_item_id;
}

export async function getSetConnectedMinifigs(setCatalogItemId: string): Promise<ConnectedMinifig[]> {
  const linksRes = await supabase
    .from("catalog_building_block_set_minifigs")
    .select("minifig_id")
    .eq("catalog_item_id", setCatalogItemId);

  if (linksRes.error) throw linksRes.error;

  const minifigIds = (linksRes.data ?? []).map((r: any) => String(r.minifig_id)).filter(Boolean);
  if (minifigIds.length === 0) return [];

  const figsRes = await supabase
    .from("catalog_minifigs")
    .select("minifig_id,minifig_number,name,image_url")
    .in("minifig_id", minifigIds);

  if (figsRes.error) throw figsRes.error;

  const byId = new Map<string, any>((figsRes.data ?? []).map((f: any) => [String(f.minifig_id), f]));
  const ordered = minifigIds.map((id) => byId.get(id)).filter(Boolean);

  return ordered.map((mf: any) => ({
    minifig_id: String(mf.minifig_id),
    minifig_number: String(mf.minifig_number ?? ""),
    name: mf.name ?? null,
    image_url: mf.image_url ?? null,
  }));
}

/* =========================
   WRITE HELPERS
   ========================= */

function toNumOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * catalog_building_blocks is NOT a marker table in your schema.
 * It has NOT NULL constraints (theme_id, set_number, etc).
 * So we must insert a real row with required fields.
 */
export async function ensureBuildingBlocksRow(
  catalogItemId: string,
  args: {
    themeId: string;
    subthemeId?: string | null;
    setNumber: string;
    pieceCount?: any;
    retailCad?: any;
    retailUsd?: any;
  }
) {
  const theme_id = String(args?.themeId ?? "").trim();
  const subtheme_id = args?.subthemeId ? String(args.subthemeId).trim() : null;

  const set_number = String(args?.setNumber ?? "").trim();
  const piece_count_raw = toNumOrNull(args?.pieceCount);
  const retail_cad = toNumOrNull(args?.retailCad);
  const retail_usd = toNumOrNull(args?.retailUsd);

  const piece_count =
    piece_count_raw === null ? null : Math.max(0, Math.floor(piece_count_raw));

  if (!theme_id) throw new Error("Building Blocks requires a Theme.");
  if (!set_number) throw new Error("Building Blocks requires a Set Number.");

  const res = await supabase.from("catalog_building_blocks").insert({
    catalog_item_id: catalogItemId,
    theme_id,
    subtheme_id,
    set_number,
    piece_count,
    retail_cad,
    retail_usd,
  });

  if (res.error) {
    const msg = String(res.error.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("already exists")) return;
    throw res.error;
  }
}

/**
 * Upserts links into catalog_building_block_set_minifigs
 * Table (confirmed): catalog_item_id, minifig_id, quantity, sort_order, created_at, id
 */
export async function upsertSetMinifigLinks(catalogItemId: string, selectedMinifigs: Array<any>) {
  const input = Array.isArray(selectedMinifigs) ? selectedMinifigs : [];

  const rows = input
    .map((m, idx) => {
      const minifig_id = String(m?.minifig_id ?? m?.id ?? "").trim();
      if (!minifig_id) return null;

      const qRaw = m?.quantity ?? m?.qty ?? m?.count ?? 1;
      const quantity = Number.isFinite(Number(qRaw)) ? Math.max(1, Math.floor(Number(qRaw))) : 1;

      return {
        catalog_item_id: catalogItemId,
        minifig_id,
        quantity,
        sort_order: idx,
      };
    })
    .filter(Boolean) as Array<{ catalog_item_id: string; minifig_id: string; quantity: number; sort_order: number }>;

  if (rows.length === 0) return;

  // Requires UNIQUE(catalog_item_id, minifig_id)
  const res = await supabase
    .from("catalog_building_block_set_minifigs")
    .upsert(rows, { onConflict: "catalog_item_id,minifig_id" });

  if (res.error) throw res.error;
}
