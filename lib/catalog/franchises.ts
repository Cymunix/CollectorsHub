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
   Read helpers
   ========================================================= */

/**
 * Fetch all franchises linked to a catalog item.
 * - Includes role
 * - Joins franchise metadata
 * - Sorted with primary first
 */
export async function fetchItemFranchises(
  catalogItemId: string
): Promise<ItemFranchiseRow[]> {
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
    .eq("catalog_item_id", catalogItemId)
    .order("role", { ascending: true });

  if (error) {
    console.error("fetchItemFranchises error:", error);
    throw error;
  }

  return (data ?? []) as ItemFranchiseRow[];
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

  return (data ?? []) as Franchise[];
}

/**
 * Search franchises by name (case-insensitive)
 * Used by ItemFranchiseEditor
 */
export async function searchFranchises(
  query: string,
  limit = 20
): Promise<Franchise[]> {
  const q = query.trim();
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

  return (data ?? []) as Franchise[];
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
export function sortItemFranchises(
  rows: ItemFranchiseRow[]
): ItemFranchiseRow[] {
  const weight = (r: FranchiseRole) =>
    r === "primary" ? 0 : r === "crossover" ? 1 : 2;

  return [...rows].sort((a, b) => weight(a.role) - weight(b.role));
}
