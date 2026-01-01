// lib/catalog/createCatalogItem.ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import { uploadToBucket } from "@/lib/catalog/upload";

export type CreateCatalogItemState = {
  categoryId: string;
  subcategoryId: string;
  franchiseId: string | null;

  itemImageFile: File | null;

  catalogName: string;
  catalogReleaseYear: string;
  catalogUPC: string;
  catalogVersion: string;

  // ✅ NEW
  productionStatus?: string;

  [key: string]: any;
};

function s(v: any): string {
  return String(v ?? "").trim();
}

function nullableStr(v: any): string | null {
  const x = s(v);
  return x ? x : null;
}

function nullableNum(v: any): number | null {
  const x = s(v);
  if (!x) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

const CATALOG_TABLE = "catalog_items";

export async function createCatalogItem(itemKind: string, state: CreateCatalogItemState): Promise<string> {
  const kind = s(itemKind) || "building_blocks";

  const name = s(state?.catalogName);
  const category_id = s(state?.categoryId);
  const subcategory_id = nullableStr(state?.subcategoryId);
  const franchise_id = nullableStr(state?.franchiseId);

  // ✅ NEW
  // Keep permissive; DB constraint should enforce allowed values if you add it.
  const production_status = s(state?.productionStatus) || "unknown";

  if (!name) throw new Error("createCatalogItem: name is required");
  if (!category_id) throw new Error("createCatalogItem: category_id is required");

  // 1) INSERT (image_url null) — same as minifigs
  const { data: inserted, error: insertErr } = await supabase
    .from(CATALOG_TABLE)
    .insert({
      kind,
      category_id,
      subcategory_id,
      franchise_id,
      name,
      release_year: nullableNum(state?.catalogReleaseYear),
      upc: nullableStr(state?.catalogUPC),
      version: nullableStr(state?.catalogVersion),

      // ✅ NEW
      production_status,

      image_url: null,
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;

  const id = inserted?.id as string | undefined;
  if (!id) throw new Error("createCatalogItem: insert succeeded but no id returned");

  // 2) UPLOAD — same as minifigs
  const file = state?.itemImageFile ?? null;
  if (file) {
    const url = await uploadToBucket(file, `catalog-items/${id}`);

    // 3) UPDATE image_url — same as minifigs
    const { error: updErr } = await supabase.from(CATALOG_TABLE).update({ image_url: url }).eq("id", id);

    if (updErr) throw updErr;
  }

  return id;
}

export default createCatalogItem;
