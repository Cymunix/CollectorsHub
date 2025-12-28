// lib/collection/insights.ts
import { supabase } from "@/lib/supabaseClient";

export type CompletenessRow = {
  name: string;
  owned_count: number;
  total_count: number;
  completeness_pct: number;
};

export type CollectionOverview = {
  unique_items: number;
  total_copies: number;
  graded_items: number;
};

function toNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export async function fetchCollectionOverview(): Promise<CollectionOverview> {
  const res = await supabase.rpc("ch_collection_overview");
  if (res.error) throw res.error;

  const row = (res.data?.[0] ?? {}) as any;
  return {
    unique_items: toNum(row.unique_items),
    total_copies: toNum(row.total_copies),
    graded_items: toNum(row.graded_items),
  };
}

async function fetchCompletenessRpc(
  rpcName:
    | "ch_bb_theme_completeness"
    | "ch_bb_subtheme_completeness"
    | "ch_music_artist_completeness"
    | "ch_movie_actor_completeness",
  limit_n = 12
): Promise<CompletenessRow[]> {
  const res = await supabase.rpc(rpcName, { limit_n });
  if (res.error) throw res.error;

  const rows = (res.data ?? []) as any[];
  // Map different RPC shapes into the same UI shape
  return rows.map((r) => ({
    name:
      r.theme_name ??
      (r.subtheme_name ? `${r.theme_name} — ${r.subtheme_name}` : null) ??
      r.artist_name ??
      r.person_name ??
      "Unknown",
    owned_count: toNum(r.owned_count),
    total_count: toNum(r.total_count),
    completeness_pct: toNum(r.completeness_pct),
  }));
}

export async function fetchInsights(limit_n = 12) {
  const [overview, bbThemes, bbSubthemes, artists, actors] = await Promise.all([
    fetchCollectionOverview(),
    fetchCompletenessRpc("ch_bb_theme_completeness", limit_n),
    fetchCompletenessRpc("ch_bb_subtheme_completeness", limit_n),
    fetchCompletenessRpc("ch_music_artist_completeness", limit_n),
    fetchCompletenessRpc("ch_movie_actor_completeness", limit_n),
  ]);

  return { overview, bbThemes, bbSubthemes, artists, actors };
}
