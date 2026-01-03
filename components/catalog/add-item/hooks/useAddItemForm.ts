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

function revokeAll(urls: string[]) {
  urls.forEach((u) => {
    try {
      URL.revokeObjectURL(u);
    } catch {}
  });
}

export function useAddItemForm(meta: AddItemMeta) {
  // ---------- core classification ----------
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [franchiseId, setFranchiseId] = useState<string>("");

  // ---------- images (NEW multi + legacy single) ----------
  const [itemImageFiles, setItemImageFiles] = useState<File[]>([]);
  const [itemImagePreviews, setItemImagePreviews] = useState<string[]>([]);

  // legacy single
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null);

  // ---------- global fields ----------
  const [catalogName, setCatalogName] = useState<string>("");
  const [catalogReleaseYear, setCatalogReleaseYear] = useState<string>("");
  const [catalogUPC, setCatalogUPC] = useState<string>("");
  const [catalogVersion, setCatalogVersion] = useState<string>("");

  // ✅ production status
  const [productionStatus, setProductionStatus] = useState<string>("unknown");

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
    return detectKindFromCategoryName(String(catName)) as ItemKind;
  }, [meta, categoryId]);

  // options used by sections (basic passthrough)
  const bbThemeOptions = useMemo(() => (meta?.bbThemes ?? []) as any[], [meta]);
  const bbSubthemeOptions = useMemo(() => (meta?.bbSubthemes ?? []) as any[], [meta]);
  const cardSetOptions = useMemo(() => (meta?.cardSets ?? []) as any[], [meta]);
  const toyBrandOptions = useMemo(() => (meta?.toyBrands ?? []) as any[], [meta]);
  const toyLineOptions = useMemo(() => (meta?.toyLines ?? []) as any[], [meta]);

  /* =========================
     Image helpers
     ========================= */

  const rebuildMultiPreviews = (files: File[]) => {
    // revoke old URLs
    setItemImagePreviews((prev) => {
      revokeAll(prev);
      return prev;
    });

    const urls = files.map((f) => URL.createObjectURL(f));
    setItemImagePreviews(urls);
  };

  // NEW: pick many (append)
  const pickItemImages = (files: File[]) => {
    const incoming = (files ?? []).filter(Boolean);
    if (!incoming.length) return;

    const next = [...itemImageFiles, ...incoming];
    setItemImageFiles(next);
    rebuildMultiPreviews(next);

    // legacy compatibility: set the first image as the single
    if (!itemImageFile && next[0]) {
      setItemImageFile(next[0]);
      // revoke old single preview if any
      setItemImagePreview((prev) => {
        if (prev) {
          try {
            URL.revokeObjectURL(prev);
          } catch {}
        }
        return prev;
      });
      setItemImagePreview(URL.createObjectURL(next[0]));
    }
  };

  const removeItemImageAt = (index: number) => {
    const next = itemImageFiles.filter((_, i) => i !== index);
    setItemImageFiles(next);
    rebuildMultiPreviews(next);

    // legacy sync
    const newPrimary = next[0] ?? null;
    setItemImageFile(newPrimary);

    setItemImagePreview((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {}
      }
      return null;
    });

    if (newPrimary) {
      setItemImagePreview(URL.createObjectURL(newPrimary));
    }
  };

  const clearItemImages = () => {
    setItemImageFiles([]);
    setItemImagePreviews((prev) => {
      revokeAll(prev);
      return [];
    });

    setItemImageFile(null);
    setItemImagePreview((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {}
      }
      return null;
    });
  };

  // Legacy single picker (kept so older PhotoSection doesn’t break)
  const pickItemImage = (file: File | null) => {
    setItemImageFile(file);

    setItemImagePreview((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {}
      }
      return null;
    });

    if (!file) {
      // also clear multi
      setItemImageFiles([]);
      setItemImagePreviews((prev) => {
        revokeAll(prev);
        return [];
      });
      return;
    }

    const singleUrl = URL.createObjectURL(file);
    setItemImagePreview(singleUrl);

    // sync multi with single
    setItemImageFiles([file]);
    setItemImagePreviews((prev) => {
      revokeAll(prev);
      return [URL.createObjectURL(file)];
    });
  };

  const reset = () => {
    setCategoryId("");
    setSubcategoryId("");
    setFranchiseId("");

    // images
    clearItemImages();

    setCatalogName("");
    setCatalogReleaseYear("");
    setCatalogUPC("");
    setCatalogVersion("");

    setProductionStatus("unknown");

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

    // NEW multi
    itemImageFiles,
    itemImagePreviews,
    pickItemImages,
    removeItemImageAt,
    clearItemImages,

    // legacy single (keep until you finish refactor)
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

    productionStatus,
    setProductionStatus,

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
