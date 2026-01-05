// components/catalog/add-item/submit/persistMediaMeta.ts
"use client";

export async function persistMediaMetaOnCatalogItem(args: {
  supabase: any;
  catalogItemId: string;
  genreIds: string[];
  ageRatingId: string | null;
  explicitContent: boolean | null;
}) {
  const { supabase, catalogItemId, genreIds, ageRatingId, explicitContent } = args;

  const gids = Array.from(new Set((genreIds ?? []).filter(Boolean)));
  const arId = ageRatingId ? String(ageRatingId) : null;
  const exp = explicitContent === null ? null : !!explicitContent;

  // attempt 1: common schema
  const attempt1 = await supabase
    .from("catalog_items")
    .update({
      genre_ids: gids.length ? gids : null,
      age_rating_id: arId,
      explicit_content: exp,
    } as any)
    .eq("id", catalogItemId);

  if (!attempt1.error) return;

  const msg = String((attempt1.error as any)?.message ?? "").toLowerCase();
  const looksLikeMissingColumn = msg.includes("column") && msg.includes("does not exist");
  if (!looksLikeMissingColumn) throw attempt1.error;

  // attempt 2: alternate naming fallback
  const attempt2 = await supabase
    .from("catalog_items")
    .update({
      genres: gids.length ? gids : null,
      ageRatingId: arId,
      explicitContent: exp,
    } as any)
    .eq("id", catalogItemId);

  if (attempt2.error) throw attempt2.error;
}
