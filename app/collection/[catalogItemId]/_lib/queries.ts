// app/collection/[catalogItemId]/_lib/queries.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

/* ============================================================
   Small helpers
   ============================================================ */

function asString(x: any): string {
  return String(x ?? "").trim();
}

function asInt(x: any, fallback = 0): number {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function int1(x: any): number {
  return Math.max(1, asInt(x, 1));
}

function uniqStrings(xs: string[]) {
  return Array.from(new Set(xs.filter(Boolean)));
}

function asIsoOrEpoch(x: any): string {
  const s = asString(x);
  return s || new Date(0).toISOString();
}

/* ============================================================
   Reviews
   ============================================================ */

export type ReviewRow = {
  id: string;
  catalog_item_id: string;
  user_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string; // ✅ normalized (NOT nullable)
};

export async function fetchItemReviews(catalogItemId: string): Promise<ReviewRow[]> {
  const id = asString(catalogItemId);
  if (!id) return [];

  const { data, error } = await supabase
    .from("catalog_item_reviews")
    .select("id,catalog_item_id,user_id,rating,title,body,created_at")
    .eq("catalog_item_id", id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];

  // ✅ normalize created_at so UI can treat it as string always
  return rows.map((r) => ({
    id: asString(r?.id),
    catalog_item_id: asString(r?.catalog_item_id),
    user_id: r?.user_id ?? null,
    rating: Number(r?.rating ?? 0),
    title: r?.title ?? null,
    body: r?.body ?? null,
    created_at: asIsoOrEpoch(r?.created_at),
  })) as ReviewRow[];
}

export async function insertItemReview(params: {
  catalogItemId: string;
  userId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
}): Promise<ReviewRow> {
  const catalog_item_id = asString(params.catalogItemId);
  const user_id = asString(params.userId);
  const rating = Number(params.rating);

  if (!catalog_item_id) throw new Error("Missing catalogItemId");
  if (!user_id) throw new Error("Missing userId");
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error("Rating must be 1..5");

  const payload = {
    catalog_item_id,
    user_id,
    rating,
    title: params.title ?? null,
    body: params.body ?? null,
  };

  const { data, error } = await supabase
    .from("catalog_item_reviews")
    .insert(payload)
    .select("id,catalog_item_id,user_id,rating,title,body,created_at")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Failed to create review");

  const r = data as any;

  return {
    id: asString(r?.id),
    catalog_item_id: asString(r?.catalog_item_id),
    user_id: r?.user_id ?? null,
    rating: Number(r?.rating ?? 0),
    title: r?.title ?? null,
    body: r?.body ?? null,
    created_at: asIsoOrEpoch(r?.created_at),
  } as ReviewRow;
}

/* ============================================================
   Bundles
   ============================================================ */

export type IncludedInBundleLite = {
  id: string;
  name: string;
  image_url: string | null;
  is_bundle?: boolean | null;
};

export type BundleComponent = {
  bundle_item_id: string;
  component_item_id: string;
  qty: number;
  role?: string | null;
  notes?: string | null;
  created_at?: string | null;

  component?: {
    id: string;
    name: string | null;
    image_url: string | null;
    release_year: number | null;
    version: string | null;
    is_bundle?: boolean | null;
  } | null;
};

export type BundleComponentInput = {
  component_item_id: string;
  qty?: number | null;
  role?: string | null;
  notes?: string | null;
};

// bundle -> components (2-step to avoid FK constraint-name dependency)
export async function fetchBundleComponents(bundleItemId: string): Promise<BundleComponent[]> {
  const bid = asString(bundleItemId);
  if (!bid) return [];

  const { data: linkRows, error: linkErr } = await supabase
    .from("bundle_components")
    .select("bundle_item_id,component_item_id,qty,role,notes,created_at")
    .eq("bundle_item_id", bid)
    .order("created_at", { ascending: true });

  if (linkErr) throw new Error(linkErr.message);

  const rows = (linkRows ?? []) as any[];
  if (!rows.length) return [];

  const componentIds = uniqStrings(rows.map((r) => asString(r.component_item_id)));
  if (!componentIds.length) return [];

  const { data: items, error: itemsErr } = await supabase
    .from("catalog_items")
    .select("id,name,image_url,release_year,version,is_bundle")
    .in("id", componentIds);

  if (itemsErr) throw new Error(itemsErr.message);

  const byId = new Map<string, any>((items ?? []).map((it: any) => [asString(it.id), it]));

  return rows.map((r) => {
    const cid = asString(r.component_item_id);
    const it = byId.get(cid);

    return {
      bundle_item_id: asString(r.bundle_item_id),
      component_item_id: cid,
      qty: int1(r.qty),
      role: r.role ?? null,
      notes: r.notes ?? null,
      created_at: r.created_at ?? null,
      component: it
        ? {
            id: asString(it.id),
            name: it.name ?? null,
            image_url: it.image_url ?? null,
            release_year: typeof it.release_year === "number" ? it.release_year : null,
            version: it.version ?? null,
            is_bundle: it.is_bundle ?? null,
          }
        : null,
    } as BundleComponent;
  });
}

// item -> bundles that include it
export async function fetchBundlesIncludingItem(itemId: string): Promise<IncludedInBundleLite[]> {
  const cid = asString(itemId);
  if (!cid) return [];

  const { data: linkRows, error: linkErr } = await supabase
    .from("bundle_components")
    .select("bundle_item_id")
    .eq("component_item_id", cid);

  if (linkErr) throw new Error(linkErr.message);

  const bundleIds = uniqStrings(((linkRows ?? []) as any[]).map((r) => asString(r.bundle_item_id)));
  if (!bundleIds.length) return [];

  const { data: bundles, error: bundlesErr } = await supabase
    .from("catalog_items")
    .select("id,name,image_url,is_bundle")
    .in("id", bundleIds);

  if (bundlesErr) throw new Error(bundlesErr.message);

  return (bundles ?? [])
    .filter((b: any) => !!b?.id)
    .filter((b: any) => !!b?.is_bundle)
    .map((b: any) => ({
      id: asString(b.id),
      name: asString(b.name ?? "Bundle"),
      image_url: b.image_url ?? null,
      is_bundle: b.is_bundle ?? null,
    }));
}

// write components (admin/editor)
export async function replaceBundleComponents(bundleItemId: string, components: BundleComponentInput[]): Promise<void> {
  const bid = asString(bundleItemId);
  if (!bid) throw new Error("Missing bundleItemId");

  const { error: delErr } = await supabase.from("bundle_components").delete().eq("bundle_item_id", bid);
  if (delErr) throw new Error(delErr.message);

  const payload = (components ?? [])
    .map((c) => ({
      bundle_item_id: bid,
      component_item_id: asString(c.component_item_id),
      qty: int1(c.qty),
      role: c.role ?? null,
      notes: c.notes ?? null,
    }))
    .filter((r) => !!r.component_item_id && r.component_item_id !== bid);

  if (!payload.length) return;

  const { error: insErr } = await supabase.from("bundle_components").insert(payload);
  if (insErr) throw new Error(insErr.message);
}

/* ============================================================
   Sales History
   ============================================================ */

export type SaleRow = {
  id: string;
  catalog_item_id: string;
  price_cad: number | null;
  condition_json: Record<string, any> | null;
  created_at: string; // ✅ normalized (NOT nullable)
};

export async function fetchItemSalesHistory(catalogItemId: string): Promise<SaleRow[]> {
  const id = asString(catalogItemId);
  if (!id) return [];

  const { data, error } = await supabase
    .from("marketplace_sales")
    .select("id,catalog_item_id,price_cad,condition_json,created_at")
    .eq("catalog_item_id", id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];

  return rows.map((r) => ({
    id: asString(r?.id),
    catalog_item_id: asString(r?.catalog_item_id),
    price_cad: typeof r?.price_cad === "number" ? r.price_cad : r?.price_cad ?? null,
    condition_json: (r?.condition_json ?? null) as any,
    created_at: asIsoOrEpoch(r?.created_at),
  })) as SaleRow[];
}
