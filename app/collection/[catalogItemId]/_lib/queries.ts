// lib/catalog/queries.ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import type {
  CatalogCard,
  CatalogItemRow,
  BundleComponent,
  BundleComponentRow,
  BundleSuggestion,
} from "@/lib/catalog/types";

/* ============================================================
   Helpers
   ============================================================ */

function asString(x: any): string {
  return String(x ?? "").trim();
}

function asInt(x: any, fallback = 0): number {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function uniqById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (!r?.id) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/* ============================================================
   Catalog Items
   ============================================================ */

export async function fetchCatalogItemById(id: string): Promise<CatalogItemRow | null> {
  const itemId = asString(id);
  if (!itemId) return null;

  const { data, error } = await supabase
    .from("catalog_items")
    .select(
      `
      id,
      name,
      release_year,
      version,
      upc,
      created_at,
      category_id,
      subcategory_id,
      franchise_id,
      is_bundle
    `
    )
    .eq("id", itemId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as any;
}

/* ============================================================
   Bundles: bundle -> components
   ============================================================ */

export async function fetchBundleComponents(bundleItemId: string): Promise<BundleComponent[]> {
  const bid = asString(bundleItemId);
  if (!bid) return [];

  // NOTE: this relies on FK join aliases. If Supabase complains about the join,
  // we can switch to explicit FK name joins once you paste your generated names.
  const { data, error } = await supabase
    .from("bundle_components")
    .select(
      `
      id,
      bundle_item_id,
      component_item_id,
      qty,
      role,
      notes,
      created_at,
      component:catalog_items!bundle_components_component_item_id_fkey (
        id,
        name,
        image_url,
        release_year,
        version
      )
    `
    )
    .eq("bundle_item_id", bid)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any;
}

/* ============================================================
   Bundles: item -> bundles that include it
   ============================================================ */

export type IncludedInBundleLite = {
  id: string;
  name: string;
  image_url: string | null;
  is_bundle?: boolean | null;
};

export async function fetchBundlesIncludingItem(itemId: string): Promise<IncludedInBundleLite[]> {
  const cid = asString(itemId);
  if (!cid) return [];

  const { data, error } = await supabase
    .from("bundle_components")
    .select(
      `
      bundle:catalog_items!bundle_components_bundle_item_id_fkey (
        id,
        name,
        image_url,
        is_bundle
      )
    `
    )
    .eq("component_item_id", cid);

  if (error) throw error;

  const rows = (data ?? []) as any[];
  const bundles: IncludedInBundleLite[] = rows
    .map((r) => r?.bundle)
    .filter(Boolean)
    .filter((b) => !!b?.id)
    .filter((b) => !!b?.is_bundle);

  return uniqById(bundles);
}

/* ============================================================
   Bundles: write components (admin/editor)
   ============================================================ */

export async function replaceBundleComponents(
  bundleItemId: string,
  components: Array<Pick<BundleComponentRow, "component_item_id" | "qty" | "role" | "notes">>
): Promise<void> {
  const bid = asString(bundleItemId);
  if (!bid) throw new Error("Missing bundleItemId");

  const payload = (components ?? [])
    .map((c) => ({
      bundle_item_id: bid,
      component_item_id: asString(c.component_item_id),
      qty: Math.max(1, asInt(c.qty, 1)),
      role: c.role ?? null,
      notes: c.notes ?? null,
    }))
    .filter((r) => !!r.component_item_id && r.component_item_id !== bid);

  const { error: delErr } = await supabase.from("bundle_components").delete().eq("bundle_item_id", bid);
  if (delErr) throw delErr;

  if (payload.length === 0) return;

  const { error: insErr } = await supabase.from("bundle_components").insert(payload);
  if (insErr) throw insErr;
}

/* ============================================================
   Cart -> Bundle suggestions
   ============================================================ */

export type CartLine = { catalog_item_id: string; qty: number };

type BundleCandidateRow = {
  bundle_item_id: string;
  component_item_id: string;
  qty: number;
  bundle: { id: string; name: string; image_url: string | null; is_bundle?: boolean | null } | null;
  component: { id: string; name: string } | null;
};

export async function computeBundleSuggestionsFromCart(
  cart: CartLine[],
  opts?: { minCoverage?: number; maxSuggestions?: number }
): Promise<BundleSuggestion[]> {
  const minCoverage = typeof opts?.minCoverage === "number" ? opts!.minCoverage : 0.6;
  const maxSuggestions = typeof opts?.maxSuggestions === "number" ? opts!.maxSuggestions : 6;

  const cartMap = new Map<string, number>();
  for (const line of cart ?? []) {
    const id = asString(line.catalog_item_id);
    if (!id) continue;
    const qty = Math.max(0, asInt(line.qty, 0));
    cartMap.set(id, (cartMap.get(id) ?? 0) + qty);
  }

  const cartIds = Array.from(cartMap.keys());
  if (cartIds.length === 0) return [];

  // First: find bundles that intersect with cart items
  const { data, error } = await supabase
    .from("bundle_components")
    .select(
      `
      bundle_item_id,
      component_item_id,
      qty,
      bundle:catalog_items!bundle_components_bundle_item_id_fkey (
        id,
        name,
        image_url,
        is_bundle
      ),
      component:catalog_items!bundle_components_component_item_id_fkey (
        id,
        name
      )
    `
    )
    .in("component_item_id", cartIds);

  if (error) throw error;

  const rows = (data ?? []) as any as BundleCandidateRow[];

  // Group candidate bundles
  const byBundle = new Map<string, BundleCandidateRow[]>();
  for (const r of rows) {
    const b = r.bundle;
    if (!b?.id) continue;
    if (!b.is_bundle) continue;

    // Don’t suggest if bundle itself is already in cart
    if (cartMap.has(b.id)) continue;

    if (!byBundle.has(b.id)) byBundle.set(b.id, []);
    byBundle.get(b.id)!.push(r);
  }

  const suggestions: BundleSuggestion[] = [];

  // For accurate coverage, we need the full component list per bundle.
  for (const [bundleId, partial] of byBundle.entries()) {
    const bundle = partial[0]?.bundle;
    if (!bundle) continue;

    const { data: full, error: fullErr } = await supabase
      .from("bundle_components")
      .select(
        `
        component_item_id,
        qty,
        component:catalog_items!bundle_components_component_item_id_fkey (
          id,
          name
        )
      `
      )
      .eq("bundle_item_id", bundleId);

    if (fullErr) throw fullErr;

    const fullRows = (full ?? []) as any[];

    let needTotal = 0;
    let haveTotal = 0;

    const matched: BundleSuggestion["matched"] = [];
    const missing: BundleSuggestion["missing"] = [];

    for (const fr of fullRows) {
      const compId = asString(fr.component_item_id);
      if (!compId) continue;

      const need = Math.max(1, asInt(fr.qty, 1));
      const have = Math.max(0, asInt(cartMap.get(compId) ?? 0, 0));
      const used = Math.min(have, need);

      needTotal += need;
      haveTotal += used;

      const name = asString(fr?.component?.name) || "Unknown";

      if (used > 0) {
        matched.push({ item_id: compId, name, qty_have: have, qty_need: need });
      }
      if (have < need) {
        missing.push({ item_id: compId, name, qty_need: need - have });
      }
    }

    if (needTotal <= 0) continue;

    const coverage = haveTotal / needTotal;
    if (coverage < minCoverage) continue;

    suggestions.push({
      bundle_id: bundleId,
      bundle_name: bundle.name,
      bundle_image_url: bundle.image_url ?? null,
      coverage,
      matched,
      missing,
    });
  }

  suggestions.sort((a, b) => b.coverage - a.coverage);
  return suggestions.slice(0, maxSuggestions);
}

/* ============================================================
   (Optional) Catalog card fetch helpers
   If you already have useCatalogCards.ts doing this, keep using it.
   ============================================================ */

export async function fetchCatalogCardLite(id: string): Promise<Pick<CatalogCard, "id" | "name" | "image_url" | "release_year" | "version" | "is_bundle"> | null> {
  const itemId = asString(id);
  if (!itemId) return null;

  const { data, error } = await supabase
    .from("catalog_items")
    .select("id,name,image_url,release_year,version,is_bundle")
    .eq("id", itemId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as any;
}
