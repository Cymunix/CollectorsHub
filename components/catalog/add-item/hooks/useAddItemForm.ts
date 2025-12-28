"use client";

import { useMemo, useState } from "react";
import type { ItemKind } from "@/lib/catalog/types";
import { detectKindFromCategoryName } from "@/lib/catalog/normalize";

/** local type to match WikiSection props */
export type WikiKV = { k: string; v: string };

export type AddItemMeta = {
  categories: Array<{ id: string; name: string }>;
  subcategories: Array<{ id: string; name: string; category_id?: string | null }>;
  franchises: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;

  bbThemes?: any[];
  bbSubthemes?: any[];

  cardManufacturers?: any[];
  cardSets?: any[];
  cardTypes?: any[];

  musicArtists?: any[];

  toyManufacturers?: any[];
  toyBrands?: any[];
  toyLines?: any[];

  gamePlatforms?: any[];
  gamePublishers?: any[];

  comicPublishers?: any[];

  [key: string]: any;
};

export function useAddItemForm(meta: AddItemMeta) {
  // ---------- core classification ----------
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [franchiseId, setFranchiseId] = useState<string>("");

  // ---------- image ----------
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null);

  // ---------- global fields ----------
  const [catalogName, setCatalogName] = useState<string>("");
  const [catalogReleaseYear, setCatalogReleaseYear] = useState<string>("");
  const [catalogUPC, setCatalogUPC] = useState<string>("");
  const [catalogVersion, setCatalogVersion] = useState<string>("");

  // ---------- wiki ----------
  const [wikiSummary, setWikiSummary] = useState<string>("");
  const [wikiDescription, setWikiDescription] = useState<string>("");
  const [wikiFacts, setWikiFacts] = useState<WikiKV[]>([]);
  const [wikiChecklist, setWikiChecklist] = useState<string[]>([]);
  const [wikiSources, setWikiSources] = useState<string[]>([]);

  const [newFactKey, setNewFactKey] = useState<string>("");
  const [newFactVal, setNewFactVal] = useState<string>("");
  const [newChecklistItem, setNewChecklistItem] = useState<string>("");
  const [newSource, setNewSource] = useState<string>("");

  // ---------- building blocks ----------
  const [bbThemeId, setBbThemeId] = useState<string>("");
  const [bbSubthemeId, setBbSubthemeId] = useState<string>("");
  const [bbSetNumber, setBbSetNumber] = useState<string>("");
  const [bbPieceCount, setBbPieceCount] = useState<string>("");
  const [bbRetailCad, setBbRetailCad] = useState<string>("");
  const [bbRetailUsd, setBbRetailUsd] = useState<string>("");

  // ---------- cards ----------
  const [cardManufacturerId, setCardManufacturerId] = useState<string>("");
  const [cardSetId, setCardSetId] = useState<string>("");
  const [cardTypeId, setCardTypeId] = useState<string>("");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardYear, setCardYear] = useState<string>("");
  const [cardRarityDropdown, setCardRarityDropdown] = useState<string>("");
  const [cardRarityCustom, setCardRarityCustom] = useState<string>("");

  // ---------- music ----------
  const [musicArtistId, setMusicArtistId] = useState<string>("");

  // ---------- toys ----------
  const [toyManufacturerId, setToyManufacturerId] = useState<string>("");
  const [toyBrandId, setToyBrandId] = useState<string>("");
  const [toyLineId, setToyLineId] = useState<string>("");
  const [toyModelNumber, setToyModelNumber] = useState<string>("");

  // ---------- gaming ----------
  const [gamePlatformId, setGamePlatformId] = useState<string>("");
  const [gamePublisherId, setGamePublisherId] = useState<string>("");

  // ---------- comics ----------
  const [comicPublisherId, setComicPublisherId] = useState<string>("");
  const [comicSeries, setComicSeries] = useState<string>("");
  const [comicIssueNumber, setComicIssueNumber] = useState<string>("");
  const [comicVariant, setComicVariant] = useState<string>("");

  // ---------- derived ----------
  const itemKind: ItemKind = useMemo(() => {
    const catName = meta?.categories?.find((c) => c.id === categoryId)?.name ?? "";
    // detectKindFromCategoryName expects a string; it returns your app's ItemKind
    return detectKindFromCategoryName(String(catName)) as ItemKind;
  }, [meta, categoryId]);

  // options used by sections (basic passthrough)
  const bbThemeOptions = useMemo(() => (meta?.bbThemes ?? []) as any[], [meta]);
  const bbSubthemeOptions = useMemo(() => (meta?.bbSubthemes ?? []) as any[], [meta]);
  const cardSetOptions = useMemo(() => (meta?.cardSets ?? []) as any[], [meta]);
  const toyBrandOptions = useMemo(() => (meta?.toyBrands ?? []) as any[], [meta]);
  const toyLineOptions = useMemo(() => (meta?.toyLines ?? []) as any[], [meta]);

  // ---------- helpers ----------
  const pickItemImage = (file: File | null) => {
    setItemImageFile(file);
    if (!file) {
      setItemImagePreview(null);
      return;
    }
    setItemImagePreview(URL.createObjectURL(file));
  };

  const reset = () => {
    setCategoryId("");
    setSubcategoryId("");
    setFranchiseId("");

    setItemImageFile(null);
    setItemImagePreview(null);

    setCatalogName("");
    setCatalogReleaseYear("");
    setCatalogUPC("");
    setCatalogVersion("");

    setWikiSummary("");
    setWikiDescription("");
    setWikiFacts([]);
    setWikiChecklist([]);
    setWikiSources([]);

    setNewFactKey("");
    setNewFactVal("");
    setNewChecklistItem("");
    setNewSource("");

    setBbThemeId("");
    setBbSubthemeId("");
    setBbSetNumber("");
    setBbPieceCount("");
    setBbRetailCad("");
    setBbRetailUsd("");

    setCardManufacturerId("");
    setCardSetId("");
    setCardTypeId("");
    setCardNumber("");
    setCardYear("");
    setCardRarityDropdown("");
    setCardRarityCustom("");

    setMusicArtistId("");

    setToyManufacturerId("");
    setToyBrandId("");
    setToyLineId("");
    setToyModelNumber("");

    setGamePlatformId("");
    setGamePublisherId("");

    setComicPublisherId("");
    setComicSeries("");
    setComicIssueNumber("");
    setComicVariant("");
  };

  return {
    itemKind,

    categoryId,
    setCategoryId,
    subcategoryId,
    setSubcategoryId,
    franchiseId,
    setFranchiseId,

    itemImageFile,
    itemImagePreview,
    pickItemImage,

    catalogName,
    setCatalogName,
    catalogReleaseYear,
    setCatalogReleaseYear,
    catalogUPC,
    setCatalogUPC,
    catalogVersion,
    setCatalogVersion,

    wikiSummary,
    setWikiSummary,
    wikiDescription,
    setWikiDescription,
    wikiFacts,
    setWikiFacts,
    wikiChecklist,
    setWikiChecklist,
    wikiSources,
    setWikiSources,
    newFactKey,
    setNewFactKey,
    newFactVal,
    setNewFactVal,
    newChecklistItem,
    setNewChecklistItem,
    newSource,
    setNewSource,

    bbThemeId,
    setBbThemeId,
    bbSubthemeId,
    setBbSubthemeId,
    bbSetNumber,
    setBbSetNumber,
    bbPieceCount,
    setBbPieceCount,
    bbRetailCad,
    setBbRetailCad,
    bbRetailUsd,
    setBbRetailUsd,
    bbThemeOptions,
    bbSubthemeOptions,

    cardManufacturerId,
    setCardManufacturerId,
    cardSetId,
    setCardSetId,
    cardTypeId,
    setCardTypeId,
    cardNumber,
    setCardNumber,
    cardYear,
    setCardYear,
    cardRarityDropdown,
    setCardRarityDropdown,
    cardRarityCustom,
    setCardRarityCustom,
    cardSetOptions,

    musicArtistId,
    setMusicArtistId,

    toyManufacturerId,
    setToyManufacturerId,
    toyBrandId,
    setToyBrandId,
    toyLineId,
    setToyLineId,
    toyModelNumber,
    setToyModelNumber,
    toyBrandOptions,
    toyLineOptions,

    gamePlatformId,
    setGamePlatformId,
    gamePublisherId,
    setGamePublisherId,

    comicPublisherId,
    setComicPublisherId,
    comicSeries,
    setComicSeries,
    comicIssueNumber,
    setComicIssueNumber,
    comicVariant,
    setComicVariant,

    reset,
  };
}

export default useAddItemForm;
