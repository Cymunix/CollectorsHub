import { supabase } from "@/lib/supabaseClient";
import { normalizeText } from "./normalize";

let cached: null | { loadedAt: number; rows: { alias: string; franchise_id: string }[] } = null;

export async function loadFranchiseAliases() {
  if (cached && Date.now() - cached.loadedAt < 1000 * 60 * 10) return cached.rows; // 10 min cache

  const res = await supabase
    .from("franchise_aliases")
    .select("alias, franchise_id");

  if (res.error) throw res.error;

  const rows = (res.data ?? []).map((r: any) => ({
    alias: normalizeText(r.alias),
    franchise_id: r.franchise_id,
  }));

  cached = { loadedAt: Date.now(), rows };
  return rows;
}

export async function detectFranchiseIdFromQuery(q: string): Promise<string | null> {
  const nq = normalizeText(q);
  if (nq.length < 3) return null;

  const aliases = await loadFranchiseAliases();

  // “strong” match: alias appears as a whole phrase
  // simplest: substring match on normalized (good enough for v2)
  const hit = aliases.find((a) => nq.includes(a.alias));
  return hit ? hit.franchise_id : null;
}
