// components/catalog/add-item/hooks/useAddItemForm.ts
"use client";

import { useMemo, useState } from "react";
import type { AddItemMeta, ItemKind, WikiKV } from "@/lib/catalog/types";
import { detectKindFromCategoryName } from "@/lib/catalog/normalize";

export function useAddItemForm(meta: AddItemMeta) {
  // classification
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [franchiseId, setFranchiseId] = useState("");

  const selectedCategory = useMemo(() => meta.categories.find((c) => c.id === categoryId) ?? null, [meta.categories, categoryId]);

  const itemKind = useMemo<ItemKind>(() => {
    if (!selectedCategory) return "building_blocks";
    return detectKindFromCategoryName(selectedCategory.name);
  }, [selectedCategory]);

  const modalSubcategories = useMemo(
    () => meta.subcategories.filter((sc) => !categoryId || sc.category_id === categoryId),
    [meta.subcategories, categoryId]
  );

  // shared image
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null);

  // global fields
  const [catalogName, setCatalogName] = useState("");
  const [catalogReleaseYear, setCatalogReleaseYear] = useState("");
  const [catalogUPC, setCatalogUPC] = useState("");
  const [catalogVersion, setCatalogVersion] = useState("");

  // wiki
  const [wikiSummary, setWikiSummary] = useState("");
  const [wikiDescription, setWikiDescription] = useState("");
  const [wikiFacts, setWikiFacts] = useState<WikiKV[]>([]);
  const [wikiChecklist, setWikiChecklist] = useState<string[]>([]);
  const [wikiSources, setWikiSources] = useState<string[]>([]);
  const [newFactKey, setNewFactKey] = useState("");
  const [newFactVal, setNewFactVal] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newSource, setNewSource] = useState("");

  // building blocks
  const [bbThemeId, setBbThemeId] = useState("");
  const [bbSubthemeId, setBbSubthemeId] = useState("");
  const [bbSetNumber, setBbSetNumber] = useState("");
  const [bbPieceCount, setBbPieceCount] = useState("");
  const [bbRetailCad, setBbRetailCad] = useState("");
  const [bbRetailUsd, setBbRetailUsd] = useState("");

  const bbThemeOptions = useMemo(
    () => meta.bbThemes.filter((t) => !subcategoryId || t.subcategory_id === subcategoryId),
    [meta.bbThemes, subcategoryId]
  );
  const bbSubthemeOptions = useMemo(
    () => meta.bbSubthemes.filter((st) => !bbThemeId || st.theme_id === bbThemeId),
    [meta.bbSubthemes, bbThemeId]
  );

  // cards
  const [cardManufacturerId, setCardManufacturerId] = useState("");
  const [cardSetId, setCardSetId] = useState("");
  const [cardTypeId, setCardTypeId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardYear, setCardYear] = useState("");

  // ✅ rarity (dropdown + custom)
  const [cardRarityDropdown, setCardRarityDropdown] = useState("");
  const [cardRarityCustom, setCardRarityCustom] = useState("");

  const cardSetOptions = useMemo(
    () => meta.cardSets.filter((s) => !cardManufacturerId || s.manufacturer_id === cardManufacturerId),
    [meta.cardSets, cardManufacturerId]
  );

  // music
  const [musicArtistId, setMusicArtistId] = useState("");

  // toys
  const [toyManufacturerId, setToyManufacturerId] = useState("");
  const [toyBrandId, setToyBrandId] = useState("");
  const [toyLineId, setToyLineId] = useState("");
  const [toyModelNumber, setToyModelNumber] = useState("");

  const toyBrandOptions = useMemo(
    () => meta.toyBrands.filter((b) => !toyManufacturerId || b.manufacturer_id === toyManufacturerId),
    [meta.toyBrands, toyManufacturerId]
  );
  const toyLineOptions = useMemo(
    () => meta.toyLines.filter((l) => !toyBrandId || l.brand_id === toyBrandId),
    [meta.toyLines, toyBrandId]
  );

  // gaming
  const [gamePlatformId, setGamePlatformId] = useState("");
  const [gamePublisherId, setGamePublisherId] = useState("");

  // comics
  const [comicPublisherId, setComicPublisherId] = useState("");
  const [comicSeries, setComicSeries] = useState("");
  const [comicIssueNumber, setComicIssueNumber] = useState("");
  const [comicVariant, setComicVariant] = useState("");

  const pickItemImage = (file: File | null) => {
    setItemImageFile(file);
    if (itemImagePreview) URL.revokeObjectURL(itemImagePreview);
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
    if (itemImagePreview) URL.revokeObjectURL(itemImagePreview);
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
    // derived
    selectedCategory,
    itemKind,
    modalSubcategories,
    bbThemeOptions,
    bbSubthemeOptions,
    cardSetOptions,
    toyBrandOptions,
    toyLineOptions,

    // classification
    categoryId,
    setCategoryId,
    subcategoryId,
    setSubcategoryId,
    franchiseId,
    setFranchiseId,

    // image
    itemImageFile,
    itemImagePreview,
    pickItemImage,

    // global
    catalogName,
    setCatalogName,
    catalogReleaseYear,
    setCatalogReleaseYear,
    catalogUPC,
    setCatalogUPC,
    catalogVersion,
    setCatalogVersion,

    // wiki
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

    // building blocks
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

    // cards
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

    // music
    musicArtistId,
    setMusicArtistId,

    // toys
    toyManufacturerId,
    setToyManufacturerId,
    toyBrandId,
    setToyBrandId,
    toyLineId,
    setToyLineId,
    toyModelNumber,
    setToyModelNumber,

    // gaming
    gamePlatformId,
    setGamePlatformId,
    gamePublisherId,
    setGamePublisherId,

    // comics
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
