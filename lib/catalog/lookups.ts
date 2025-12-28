// lib/catalog/lookups.ts
import { supabase } from "@/lib/supabaseClient";
import { normalizeName, slugify } from "./normalize";

export async function safeInsertLookup(
  table: string,
  name: string,
  extra: Record<string, any> = {},
  selectCols = "id,name"
): Promise<{ id: string; name: string } | null> {
  const clean = normalizeName(name);
  if (!clean) return null;

  const payload: Record<string, any> = { name: clean, ...extra };

  // If your lookup tables do not have slug, remove this line.
  if (!("slug" in payload)) payload.slug = slugify(clean);

  const { data, error } = await supabase.from(table).insert(payload).select(selectCols).single();
  if (error) throw error;
  return data as any;
}
