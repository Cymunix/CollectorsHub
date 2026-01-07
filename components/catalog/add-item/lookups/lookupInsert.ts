// components/catalog/add-item/lookups/lookupInsert.ts
"use client";

export type Banner = { type: "error" | "success"; msg: string } | null;

export function slugify(input: any) {
  const s = String(input ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return slug || "item";
}

/**
 * Insert into any lookup table and surface the *real* error (RLS, constraints, etc).
 * You pass supabase in so this module stays isolated and testable.
 */
export async function insertLookupRowSafe<T extends { id: string }>(args: {
  supabase: any;
  table: string;
  payload: Record<string, any>;
  setBanner: (b: Banner) => void;
}): Promise<T | null> {
  const { supabase, table, payload, setBanner } = args;

  try {
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();
    if (error) throw error;
    return data as T;
  } catch (e: any) {
    setBanner({ type: "error", msg: e?.message ?? `Insert failed: ${table}` });
    console.error("Lookup insert failed:", table, payload, e);
    return null;
  }
}

/**
 * Insert into lookup tables that require NOT NULL slug.
 * - attempt base slug
 * - on collision retry with suffix
 */
export async function insertWithSlugSafe<T extends { id: string; name: string }>(args: {
  supabase: any;
  table: string;
  payload: Record<string, any>;
  setBanner: (b: Banner) => void;
}): Promise<T | null> {
  const { supabase, table, payload, setBanner } = args;

  try {
    const base = slugify(payload?.name);

    let { data, error } = await supabase.from(table).insert({ ...payload, slug: base }).select("*").single();
    if (!error) return data as T;

    const suffix = Math.random().toString(36).slice(2, 7);
    ({ data, error } = await supabase
      .from(table)
      .insert({ ...payload, slug: `${base}-${suffix}` })
      .select("*")
      .single());

    if (error) throw error;
    return data as T;
  } catch (e: any) {
    setBanner({ type: "error", msg: e?.message ?? `Insert failed: ${table}` });
    console.error("insertWithSlugSafe failed:", table, payload, e);
    return null;
  }
}
