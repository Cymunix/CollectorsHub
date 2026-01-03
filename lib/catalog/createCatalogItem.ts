// lib/catalog/createCatalogItem.ts
"use client";

import { supabase } from "@/lib/supabaseClient";

export type CreateCatalogItemState = {
  categoryId: string;
  subcategoryId: string;
  franchiseId: string | null;

  // ✅ multi files
  itemImageFiles?: File[] | null;

  // ✅ legacy single (optional)
  itemImageFile?: File | null;

  catalogName: string;
  catalogReleaseYear: string;
  catalogUPC: string;
  catalogVersion: string;

  productionStatus?: string;

  // Cards (saved onto catalog_items)
  cardSetId?: string | null;
  cardNumber?: string | null;
  tcgplayerId?: string | null;

  // Gaming (saved onto catalog_items)
  gamePlatformId?: string | null; // -> catalog_items.platform_id
  gamePublisherId?: string | null; // -> catalog_items.game_publisher_id

  // Comics (saved onto catalog_items)
  comicPublisherId?: string | null; // -> catalog_items.comic_publisher_id
  comicSeries?: string | null; // -> catalog_items.comic_series
  comicIssueNumber?: string | null; // -> catalog_items.comic_issue_number
  comicVariant?: string | null; // -> catalog_items.comic_variant

  // People roles (join table)
  musicArtistIds?: string[] | null;
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
  return v.map((x) => s(x)).filter((x) => x.length > 0);
}

const CATALOG_TABLE = "catalog_items";

// ✅ people join table (keep)
const ITEM_PEOPLE_TABLE = "catalog_item_people";

// ✅ multi-image table (keep)
const IMAGES_TABLE = "catalog_item_images";

// ✅ Storage bucket
const IMAGES_BUCKET = "item-images";
const CATALOG_PREFIX = "catalog-items";

/* =========================
   People links
   ========================= */

type ItemPersonLink = { person_id: string; role: string; sort_order?: number };

async function replaceItemPeopleLinks(catalogItemId: string, links: ItemPersonLink[]) {
  const { error: delErr } = await supabase.from(ITEM_PEOPLE_TABLE).delete().eq("catalog_item_id", catalogItemId);
  if (delErr) throw delErr;

  if (!links.length) return;

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
   Image upload helpers
   ========================= */

function safeExt(file: File) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  return ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "jpg";
}

async function uploadCatalogImagesMany(catalogItemId: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = safeExt(file);

    const order = String(i + 1).padStart(2, "0");
    const label = i === 0 ? "primary" : "image";
    const path = `${CATALOG_PREFIX}/${catalogItemId}/${order}_${label}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) throw upErr;

    const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("uploadCatalogImagesMany: missing publicUrl");
    urls.push(data.publicUrl);
  }

  return urls;
}

async function insertCatalogItemImages(catalogItemId: string, urls: string[]) {
  if (!urls.length) return;

  const rows = urls.map((url, idx) => ({
    catalog_item_id: catalogItemId,
    image_url: url,
    sort_order: idx,
    role: idx === 0 ? "primary" : null,
  }));

  const { error } = await supabase.from(IMAGES_TABLE).insert(rows);
  if (error) throw error;
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

  // ✅ SINGLE SOURCE OF TRUTH ON catalog_items

  // gaming: use platform_id (NOT game_platform_id)
  const platform_id = kind === "gaming" ? nullableStr(state?.gamePlatformId) : null;
  const game_publisher_id = kind === "gaming" ? nullableStr(state?.gamePublisherId) : null;

  // cards
  const isCard = kind === "trading_card" || kind === "sports_card";
  const card_set_id = isCard ? nullableStr(state?.cardSetId) : null;
  const card_number = isCard ? nullableStr(state?.cardNumber) : null;
  const tcgplayer_id = isCard ? nullableStr(state?.tcgplayerId) : null;

  // comics
  const isComic = kind === "comic";
  const comic_publisher_id = isComic ? nullableStr(state?.comicPublisherId) : null;
  const comic_series = isComic ? nullableStr(state?.comicSeries) : null;
  const comic_issue_number = isComic ? nullableStr(state?.comicIssueNumber) : null;
  const comic_variant = isComic ? nullableStr(state?.comicVariant) : null;

  // 1) INSERT base item (and all kind fields directly onto catalog_items)
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
      image_url: null, // legacy compatibility

      // gaming
      platform_id,
      game_publisher_id,

      // cards
      card_set_id,
      card_number,
      tcgplayer_id,

      // comics
      comic_publisher_id,
      comic_series,
      comic_issue_number,
      comic_variant,
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;

  const id = inserted?.id as string | undefined;
  if (!id) throw new Error("createCatalogItem: insert succeeded but no id returned");

  // 2) People links (artists/directors/actors) — keep join table
  const peopleLinks: ItemPersonLink[] = [];

  if (kind === "music") {
    const artists = cleanStringArray(state?.musicArtistIds);
    artists.forEach((pid, i) => peopleLinks.push({ person_id: pid, role: "artist", sort_order: i }));
  }

  if (kind === "movie") {
    const directors = cleanStringArray(state?.movieDirectorIds);
    const actors = cleanStringArray(state?.movieActorIds);
    directors.forEach((pid, i) => peopleLinks.push({ person_id: pid, role: "director", sort_order: i }));
    actors.forEach((pid, i) => peopleLinks.push({ person_id: pid, role: "actor", sort_order: i }));
  }

  if (peopleLinks.length) {
    await replaceItemPeopleLinks(id, peopleLinks);
  }

  // 3) UPLOAD images (multi)
  const files = (Array.isArray(state?.itemImageFiles) ? state.itemImageFiles : []).filter(Boolean) as File[];
  const legacySingle = state?.itemImageFile ?? null;
  const effectiveFiles = files.length ? files : legacySingle ? [legacySingle] : [];

  if (effectiveFiles.length) {
    const urls = await uploadCatalogImagesMany(id, effectiveFiles);

    await insertCatalogItemImages(id, urls);

    // Legacy compatibility: set catalog_items.image_url to primary
    const primaryUrl = urls[0] ?? null;
    if (primaryUrl) {
      const { error: updErr } = await supabase.from(CATALOG_TABLE).update({ image_url: primaryUrl }).eq("id", id);
      if (updErr) throw updErr;
    }
  }

  return id;
}

export default createCatalogItem;
