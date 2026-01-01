"use client";

import { supabase } from "@/lib/supabaseClient";

/* =========================================================
   Types
   ========================================================= */

export type FranchiseRole = "primary" | "secondary" | "crossover";

export type Franchise = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
};

export type ItemFranchiseRow = {
  franchise_id: string;
  role: FranchiseRole;
  franchises: Franchise | null;
};

/* =========================================================
   Internal helpers
   ========================================================= */

function asFranchise(v: any): Franchise | null {
  if (!v) return null;

  // Supabase can return nested join as object OR array depending on typings.
  const obj = Array.isArray(v) ? v[0] : v;
  if (!obj) return null;

  const id = String(obj.id ?? "").trim();
  const slug = String(obj.slug ?? "").trim();
  const name = String(obj.name ?? "").trim();

  if (!id || !slug || !name) return null;

  return {
    id,
    slug,
    name,
    description: obj.description ?? null,
  };
}

function asRole(v: any): FranchiseRole {
  const r = String(v ?? "").trim().toLowerCase();
  if (r === "primary" || r === "secondary" || r === "crossover") return r;
  return "secondary";
}

/* =========================================================
   Read helpers
   ========================================================= */

/**
 * Fetch all franchises linked to a catalog item.
 * - Includes role
 * - Joins franchise metadata
 * - Sorted with primary first (enum order dependent; we also provide sorter below)
 */
export async function fetchItemFranchises(catalogItemId: string): Promise<ItemFranchiseRow[]> {
  if (!catalogItemId) return [];

  const { data, error } = await supabase
    .from("catalog_item_franchises")
    .select(
      `
      franchise_id,
      role,
      franchises:franchise_id (
        id,
        slug,
        name,
        description
      )
    `
    )
    .eq("catalog_item_id", catalogItemId);

  if (error) {
    console.error("fetchItemFranchises error:", error);
    throw error;
  }

  const rows = (data ?? []) as any[];

  const normalized: ItemFranchiseRow[] = rows
    .map((r) => ({
      franchise_id: String(r.franchise_id),
      role: asRole(r.role),
      franchises: asFranchise(r.franchises),
    }))
    .filter((r) => !!r.franchise_id);

  // stable display sort
  return sortItemFranchises(normalized);
}

/**
 * Fetch all franchises (for dropdowns, filters, admin UI)
 */
export async function fetchAllFranchises(): Promise<Franchise[]> {
  const { data, error } = await supabase
    .from("franchises")
    .select("id,slug,name,description")
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchAllFranchises error:", error);
    throw error;
  }

  return ((data ?? []) as any[]).map(asFranchise).filter(Boolean) as Franchise[];
}

/**
 * Search franchises by name (case-insensitive)
 * Used by ItemFranchiseEditor
 */
export async function searchFranchises(query: string, limit = 20): Promise<Franchise[]> {
  const q = String(query ?? "").trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("franchises")
    .select("id,slug,name,description")
    .ilike("name", `%${q}%`)
    .limit(limit);

  if (error) {
    console.error("searchFranchises error:", error);
    throw error;
  }

  return ((data ?? []) as any[]).map(asFranchise).filter(Boolean) as Franchise[];
}

/* =========================================================
   Derived helpers
   ========================================================= */

/**
 * Returns true if an item is a crossover (2+ franchises)
 */
export function isCrossoverItem(franchises: ItemFranchiseRow[]): boolean {
  return franchises.length >= 2;
}

/**
 * Sort franchises for display:
 * primary → crossover → secondary
 */
export function sortItemFranchises(rows: ItemFranchiseRow[]): ItemFranchiseRow[] {
  const weight = (r: FranchiseRole) => (r === "primary" ? 0 : r === "crossover" ? 1 : 2);
  return [...rows].sort((a, b) => weight(a.role) - weight(b.role));
}
