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

  /* =========================
     Card details (optional)
     ========================= */
  cardManufacturerId?: string | null;
  cardSetId?: string | null;
  cardTypeId?: string | null;
  cardNumber?: string | null;
  cardYear?: string | number | null;
  cardRarityDropdown?: string | null;
  cardRarityCustom?: string | null;

  /* =========================
     Music (optional)
     ========================= */
  musicArtistId?: string | null;

  /* =========================
     Toys (optional)
     ========================= */
  toyManufacturerId?: string | null;
  toyBrandId?: string | null;
  toyLineId?: string | null;
  toyModelNumber?: string | null;

  /* =========================
     Gaming (optional)
     ========================= */
  gamePlatformId?: string | null;
  gamePublisherId?: string | null;

  /* =========================
     Comics (optional)
     ========================= */
  comicPublisherId?: string | null;
  comicSeries?: string | null;
  comicIssueNumber?: string | null;
  comicVariant?: string | null;

  /* =========================
     Movies (optional)
     ========================= */
  movieDirectorIds?: string[] | null;
  movieActorIds?: string[] | null;

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

function cleanStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => s(x))
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

const CATALOG_TABLE = "catalog_items";

// ✅ Detail tables (create these in Supabase if they don't exist yet)
const CARD_TABLE = "catalog_items_cards";
const MUSIC_TABLE = "catalog_item_music";
const TOY_TABLE = "catalog_item_toys";
const GAME_TABLE = "catalog_item_games";
const COMIC_TABLE = "catalog_item_comics";
const MOVIE_TABLE = "catalog_item_movies";
const MOVIE_PEOPLE_TABLE = "catalog_item_movie_people"; // join table

async function upsertCardDetails(catalogItemId: string, state: CreateCatalogItemState) {
  const rarity = nullableStr(state?.cardRarityCustom) ?? nullableStr(state?.cardRarityDropdown);

  const { error } = await supabase.from(CARD_TABLE).upsert(
    [
      {
        catalog_item_id: catalogItemId,
        manufacturer_id: nullableStr(state?.cardManufacturerId),
        set_id: nullableStr(state?.cardSetId),
        type_id: nullableStr(state?.cardTypeId),
        card_number: nullableStr(state?.cardNumber),
        card_year: nullableNum(state?.cardYear),
        rarity,
      },
    ],
    { onConflict: "catalog_item_id" }
  );

  if (error) throw error;
}

async function upsertMusicDetails(catalogItemId: string, state: CreateCatalogItemState) {
  const { error } = await supabase.from(MUSIC_TABLE).upsert(
    [
      {
        catalog_item_id: catalogItemId,
        artist_id: nullableStr(state?.musicArtistId),
      },
    ],
    { onConflict: "catalog_item_id" }
  );

  if (error) throw error;
}

async function upsertToyDetails(catalogItemId: string, state: CreateCatalogItemState) {
  const { error } = await supabase.from(TOY_TABLE).upsert(
    [
      {
        catalog_item_id: catalogItemId,
        manufacturer_id: nullableStr(state?.toyManufacturerId),
        brand_id: nullableStr(state?.toyBrandId),
        line_id: nullableStr(state?.toyLineId),
        model_number: nullableStr(state?.toyModelNumber),
      },
    ],
    { onConflict: "catalog_item_id" }
  );

  if (error) throw error;
}

async function upsertGameDetails(catalogItemId: string, state: CreateCatalogItemState) {
  const { error } = await supabase.from(GAME_TABLE).upsert(
    [
      {
        catalog_item_id: catalogItemId,
        platform_id: nullableStr(state?.gamePlatformId),
        publisher_id: nullableStr(state?.gamePublisherId),
      },
    ],
    { onConflict: "catalog_item_id" }
  );

  if (error) throw error;
}

async function upsertComicDetails(catalogItemId: string, state: CreateCatalogItemState) {
  const { error } = await supabase.from(COMIC_TABLE).upsert(
    [
      {
        catalog_item_id: catalogItemId,
        publisher_id: nullableStr(state?.comicPublisherId),
        series: nullableStr(state?.comicSeries),
        issue_number: nullableStr(state?.comicIssueNumber),
        variant: nullableStr(state?.comicVariant),
      },
    ],
    { onConflict: "catalog_item_id" }
  );

  if (error) throw error;
}

async function upsertMovieDetails(catalogItemId: string) {
  // If you want movie-specific columns later, keep this table.
  // For now it can just exist as a marker row.
  const { error } = await supabase.from(MOVIE_TABLE).upsert([{ catalog_item_id: catalogItemId }], {
    onConflict: "catalog_item_id",
  });

  if (error) throw error;
}

async function replaceMoviePeopleLinks(catalogItemId: string, directorIds: string[], actorIds: string[]) {
  // delete old links
  const { error: delErr } = await supabase.from(MOVIE_PEOPLE_TABLE).delete().eq("catalog_item_id", catalogItemId);
  if (delErr) throw delErr;

  const rows: any[] = [];

  for (const pid of directorIds) {
    rows.push({ catalog_item_id: catalogItemId, person_id: pid, role: "director" });
  }
  for (const pid of actorIds) {
    rows.push({ catalog_item_id: catalogItemId, person_id: pid, role: "actor" });
  }

  if (!rows.length) return;

  const { error: insErr } = await supabase.from(MOVIE_PEOPLE_TABLE).insert(rows);
  if (insErr) throw insErr;
}

export async function createCatalogItem(itemKind: string, state: CreateCatalogItemState): Promise<string> {
  const kind = s(itemKind) || "building_blocks";

  const name = s(state?.catalogName);
  const category_id = s(state?.categoryId);
  const subcategory_id = nullableStr(state?.subcategoryId);
  const franchise_id = nullableStr(state?.franchiseId);

  // ✅ NEW: permissive; DB constraints can enforce allowed values later
  const production_status = s(state?.productionStatus) || "unknown";

  if (!name) throw new Error("createCatalogItem: name is required");
  if (!category_id) throw new Error("createCatalogItem: category_id is required");

  // 1) INSERT base item
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

      production_status,
      image_url: null,
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;

  const id = inserted?.id as string | undefined;
  if (!id) throw new Error("createCatalogItem: insert succeeded but no id returned");

  // 1b) INSERT/UPSERT kind-specific details (requires the detail tables to exist)
  // NOTE: building_blocks is handled elsewhere (ensureBuildingBlocksRow)
  if (kind === "trading_card" || kind === "sports_card") {
    await upsertCardDetails(id, state);
  } else if (kind === "music") {
    await upsertMusicDetails(id, state);
  } else if (kind === "toy") {
    await upsertToyDetails(id, state);
  } else if (kind === "gaming") {
    await upsertGameDetails(id, state);
  } else if (kind === "comic") {
    await upsertComicDetails(id, state);
  } else if (kind === "movie") {
    await upsertMovieDetails(id);

    const directors = cleanStringArray(state?.movieDirectorIds);
    const actors = cleanStringArray(state?.movieActorIds);
    if (directors.length || actors.length) {
      await replaceMoviePeopleLinks(id, directors, actors);
    }
  }

  // 2) UPLOAD image (same as minifigs)
  const file = state?.itemImageFile ?? null;
  if (file) {
    const url = await uploadToBucket(file, `catalog-items/${id}`);

    // 3) UPDATE image_url
    const { error: updErr } = await supabase.from(CATALOG_TABLE).update({ image_url: url }).eq("id", id);
    if (updErr) throw updErr;
  }

  return id;
}

export default createCatalogItem;

