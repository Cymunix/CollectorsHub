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

  // ✅ production status
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
     =========================
     NOTE: We now use PEOPLE for artists too.
     Use musicArtistIds for one-or-many artists.
   */
  musicArtistIds?: string[] | null;

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

// Detail tables (must exist)
const CARD_TABLE = "catalog_items_cards";
const MUSIC_TABLE = "catalog_item_music";
const TOY_TABLE = "catalog_item_toys";
const GAME_TABLE = "catalog_item_games";
const COMIC_TABLE = "catalog_item_comics";
const MOVIE_TABLE = "catalog_item_movies";

// ✅ unified join table for ALL roles (must exist)
const ITEM_PEOPLE_TABLE = "catalog_item_people";

/* =========================
   Upsert detail rows
   ========================= */

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

/**
 * Keep a music detail row as a marker (optional).
 * We do NOT store artist ids here anymore — those live in catalog_item_people with role="artist".
 */
async function upsertMusicDetails(catalogItemId: string) {
  const { error } = await supabase
    .from(MUSIC_TABLE)
    .upsert([{ catalog_item_id: catalogItemId }], { onConflict: "catalog_item_id" });

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

/**
 * Keep a movie detail row as a marker (optional).
 */
async function upsertMovieDetails(catalogItemId: string) {
  const { error } = await supabase.from(MOVIE_TABLE).upsert([{ catalog_item_id: catalogItemId }], {
    onConflict: "catalog_item_id",
  });

  if (error) throw error;
}

/* =========================
   Unified item-people links
   ========================= */

type ItemPersonLink = { person_id: string; role: string; sort_order?: number };

async function replaceItemPeopleLinks(catalogItemId: string, links: ItemPersonLink[]) {
  // delete old links for this item
  const { error: delErr } = await supabase.from(ITEM_PEOPLE_TABLE).delete().eq("catalog_item_id", catalogItemId);
  if (delErr) throw delErr;

  if (!links.length) return;

  // de-dupe exact duplicates (same person_id + role)
  const seen = new Set<string>();
  const rows = links
    .filter((l) => {
      const pid = s(l?.person_id);
      const role = s(l?.role);
      if (!pid || !role) return false;
      const key = `${pid}::${role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((l, idx) => ({
      catalog_item_id: catalogItemId,
      person_id: s(l.person_id),
      role: s(l.role),
      sort_order: Number.isFinite(Number(l.sort_order)) ? Number(l.sort_order) : idx,
    }));

  if (!rows.length) return;

  const { error: insErr } = await supabase.from(ITEM_PEOPLE_TABLE).insert(rows);
  if (insErr) throw insErr;
}

/* =========================
   Main create
   ========================= */

export async function createCatalogItem(itemKind: string, state: CreateCatalogItemState): Promise<string> {
  const kind = s(itemKind) || "building_blocks";

  const name = s(state?.catalogName);
  const category_id = s(state?.categoryId);
  const subcategory_id = nullableStr(state?.subcategoryId);
  const franchise_id = nullableStr(state?.franchiseId);

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

  // 2) Kind-specific details
  // NOTE: building_blocks is handled elsewhere (ensureBuildingBlocksRow)
  const peopleLinks: ItemPersonLink[] = [];

  if (kind === "trading_card" || kind === "sports_card") {
    await upsertCardDetails(id, state);
  } else if (kind === "music") {
    // marker row (optional)
    await upsertMusicDetails(id);

    // NEW: artists are PEOPLE
    const artists = cleanStringArray((state as any)?.musicArtistIds);
    artists.forEach((pid, i) => peopleLinks.push({ person_id: pid, role: "artist", sort_order: i }));
  } else if (kind === "toy") {
    await upsertToyDetails(id, state);
  } else if (kind === "gaming") {
    await upsertGameDetails(id, state);
  } else if (kind === "comic") {
    await upsertComicDetails(id, state);
  } else if (kind === "movie") {
    // marker row (optional)
    await upsertMovieDetails(id);

    const directors = cleanStringArray(state?.movieDirectorIds);
    const actors = cleanStringArray(state?.movieActorIds);

    directors.forEach((pid, i) => peopleLinks.push({ person_id: pid, role: "director", sort_order: i }));
    actors.forEach((pid, i) => peopleLinks.push({ person_id: pid, role: "actor", sort_order: i }));
  }

  // 2b) Unified people links (movie + music + future roles)
  if (peopleLinks.length) {
    await replaceItemPeopleLinks(id, peopleLinks);
  }

  // 3) UPLOAD image
  const file = state?.itemImageFile ?? null;
  if (file) {
    const url = await uploadToBucket(file, `catalog-items/${id}`);

    // 4) UPDATE image_url
    const { error: updErr } = await supabase.from(CATALOG_TABLE).update({ image_url: url }).eq("id", id);
    if (updErr) throw updErr;
  }

  return id;
}

export default createCatalogItem;
