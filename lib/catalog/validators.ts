// lib/catalog/validators.ts
import type { ItemKind, VariantDraft, WikiKV, CatalogMinifig } from "./types";
import { normalizeName, toNumberOrNull } from "./normalize";

export type ValidatedPayload = {
  // base
  categoryId: string;
  subcategoryId: string;
  franchiseId: string | null;

  name: string;
  releaseYear: number | null;
  upc: string | null;
  version: string | null;

  // wiki
  wikiSummary: string | null;
  wikiDescription: string | null;
  wikiFacts: WikiKV[];
  wikiChecklist: string[];
  wikiSources: string[];

  // variants
  linkedVariants: VariantDraft[];

  // building blocks
  bbThemeId: string;
  bbSubthemeId: string;
  bbSetNumber: string;
  bbPieceCount: number | null;
  bbRetailCad: number | null;
  bbRetailUsd: number | null;
  selectedMinifigs: CatalogMinifig[];

  // cards
  cardManufacturerId: string;
  cardSetId: string;
  cardTypeId: string;
  cardNumber: string;
  cardYear: number | null;

  // rarity (TRADING CARDS)
  cardRarityDropdown: string;
  cardRarityCustom: string;
  cardRarityFinal: string | null;

  // music
  musicArtistId: string;

  // toys
  toyManufacturerId: string;
  toyBrandId: string;
  toyLineId: string;
  toyModelNumber: string | null;

  // movies
  movieDirectorIds: string[];
  movieActorIds: string[];

  // gaming
  gamePlatformId: string;
  gamePublisherId: string | null;

  // comics
  comicPublisherId: string;
  comicSeries: string;
  comicIssueNumber: string;
  comicVariant: string | null;
};

export function validate(kind: ItemKind, raw: any): ValidatedPayload {
  if (!raw.categoryId) throw new Error("Category is required.");
  if (!raw.subcategoryId) throw new Error("Subcategory is required.");
  if (!raw.itemImageFile) throw new Error("Item photo is required.");

  const name = normalizeName(raw.catalogName);
  if (!name) throw new Error("Item name is required.");

  const releaseYear = raw.catalogReleaseYear?.trim() ? toNumberOrNull(raw.catalogReleaseYear) : null;
  if (raw.catalogReleaseYear?.trim() && releaseYear === null) throw new Error("Release year must be a number.");

  const upc = normalizeName(raw.catalogUPC) || null;
  const version = normalizeName(raw.catalogVersion) || null;

  if (kind === "music" && !version) throw new Error("Version is required for Music.");
  if (kind === "gaming" && !version) throw new Error("Version is required for Gaming.");

  // wiki
  const wikiSummary = normalizeName(raw.wikiSummary) || null;
  const wikiDescription = normalizeName(raw.wikiDescription) || null;
  const wikiFacts: WikiKV[] = Array.isArray(raw.wikiFacts) ? raw.wikiFacts : [];
  const wikiChecklist: string[] = Array.isArray(raw.wikiChecklist) ? raw.wikiChecklist : [];
  const wikiSources: string[] = Array.isArray(raw.wikiSources) ? raw.wikiSources : [];

  // variants
  const linkedVariants: VariantDraft[] = Array.isArray(raw.linkedVariants) ? raw.linkedVariants : [];

  // building blocks
  const bbPieceCount = raw.bbPieceCount?.trim() ? toNumberOrNull(raw.bbPieceCount) : null;
  const bbRetailCad = raw.bbRetailCad?.trim() ? toNumberOrNull(raw.bbRetailCad) : null;
  const bbRetailUsd = raw.bbRetailUsd?.trim() ? toNumberOrNull(raw.bbRetailUsd) : null;

  // cards
  const cardYear = raw.cardYear?.trim() ? toNumberOrNull(raw.cardYear) : null;

  // rarity (dropdown + custom override)
  const dropdown = normalizeName(raw.cardRarityDropdown);
  const custom = normalizeName(raw.cardRarityCustom);
  const cardRarityFinal = custom || dropdown || null;

  // comics
  const comicVariant = normalizeName(raw.comicVariant) || null;

  const toyModelNumber = normalizeName(raw.toyModelNumber) || null;
  const franchiseId = raw.franchiseId ? String(raw.franchiseId) : null;
  const gamePublisherId = raw.gamePublisherId ? String(raw.gamePublisherId) : null;

  // kind-specific required checks
  if (kind === "building_blocks") {
    if (!raw.bbThemeId) throw new Error("Theme is required for Building Blocks.");
    if (!raw.bbSubthemeId) throw new Error("Subtheme is required for Building Blocks.");
    if (!normalizeName(raw.bbSetNumber)) throw new Error("Set Number is required for Building Blocks.");
    if (bbPieceCount === null || bbPieceCount < 0) throw new Error("Piece Count is required and must be a valid number.");
  }

  if (kind === "trading_card" || kind === "sports_card") {
    if (!raw.cardManufacturerId) throw new Error("Manufacturer is required for Cards.");
    if (!raw.cardSetId) throw new Error("Set is required for Cards.");
    if (!raw.cardTypeId) throw new Error("Card Type is required for Cards.");
    if (!normalizeName(raw.cardNumber)) throw new Error("Card Number is required.");
    if (cardYear === null) throw new Error("Card year is required and must be a number.");
    // rarity is OPTIONAL by default (won't block)
  }

  if (kind === "music") {
    if (!raw.musicArtistId) throw new Error("Artist is required for Music.");
    if (!releaseYear) throw new Error("Release year is required for Music.");
  }

  if (kind === "toy") {
    if (!raw.toyManufacturerId) throw new Error("Manufacturer is required for Toys.");
    if (!raw.toyBrandId) throw new Error("Brand is required for Toys.");
    if (!raw.toyLineId) throw new Error("Line is required for Toys.");
    if (!releaseYear) throw new Error("Release year is required for Toys.");
  }

  if (kind === "movie") {
    if (!releaseYear) throw new Error("Release year is required for Movies.");
  }

  if (kind === "gaming") {
    if (!raw.gamePlatformId) throw new Error("Platform is required for Gaming.");
    if (!releaseYear) throw new Error("Release year is required for Gaming.");
  }

  if (kind === "comic") {
    if (!raw.comicPublisherId) throw new Error("Publisher is required for Comics.");
    if (!releaseYear) throw new Error("Release year is required for Comics.");
    if (!normalizeName(raw.comicSeries)) throw new Error("Series is required for Comics.");
    if (!normalizeName(raw.comicIssueNumber)) throw new Error("Issue number is required for Comics.");
  }

  return {
    categoryId: raw.categoryId,
    subcategoryId: raw.subcategoryId,
    franchiseId,

    name,
    releaseYear,
    upc,
    version,

    wikiSummary,
    wikiDescription,
    wikiFacts,
    wikiChecklist: wikiChecklist.map((x) => normalizeName(x)).filter(Boolean),
    wikiSources: wikiSources.map((x) => normalizeName(x)).filter(Boolean),

    linkedVariants,

    bbThemeId: raw.bbThemeId,
    bbSubthemeId: raw.bbSubthemeId,
    bbSetNumber: normalizeName(raw.bbSetNumber),
    bbPieceCount,
    bbRetailCad,
    bbRetailUsd,
    selectedMinifigs: Array.isArray(raw.selectedMinifigs) ? raw.selectedMinifigs : [],

    cardManufacturerId: raw.cardManufacturerId,
    cardSetId: raw.cardSetId,
    cardTypeId: raw.cardTypeId,
    cardNumber: normalizeName(raw.cardNumber),
    cardYear,

    cardRarityDropdown: dropdown,
    cardRarityCustom: custom,
    cardRarityFinal,

    musicArtistId: raw.musicArtistId,

    toyManufacturerId: raw.toyManufacturerId,
    toyBrandId: raw.toyBrandId,
    toyLineId: raw.toyLineId,
    toyModelNumber,

    movieDirectorIds: Array.isArray(raw.movieDirectorIds) ? raw.movieDirectorIds : [],
    movieActorIds: Array.isArray(raw.movieActorIds) ? raw.movieActorIds : [],

    gamePlatformId: raw.gamePlatformId,
    gamePublisherId,

    comicPublisherId: raw.comicPublisherId,
    comicSeries: normalizeName(raw.comicSeries),
    comicIssueNumber: normalizeName(raw.comicIssueNumber),
    comicVariant,
  };
}
