"use client";

import { useMemo, useState } from "react";
import type { ItemKind } from "@/lib/catalog/types";
import { detectKindFromCategoryName } from "@/lib/catalog/normalize";

/** local type (since "@/lib/catalog/types" does not export WikiKV) */
export type WikiKV = { key: string; value: string };

/**
 * Minimal meta shape required by this hook.
 * Keep it loose so builds don't break as meta evolves.
 */
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
  const [catalogName, setCatalogName] = useState("");
  const [catalogReleaseYear, setCatalogReleaseYear] = useState<string>("");
  const [catalogUPC, setCatalogUPC] = useState<string>("");
  const [catalogVersion, setCatalogVersion] = useState<string>("");

  // ---------- wiki ----------
  const [wikiSummary, setWikiSummary] = useState("");
  const [wikiDescription, setWikiDescription] = useState("");
  const [wikiFacts, setWikiFacts] = useState<WikiKV[]>([]);
  const [wikiChecklist, setWikiChecklist] = useState<string[]>([]);
  const [wikiSources, setWikiSources] = useState<string[]>([]);

  const [newFactKey, setNewFactKey] = useState("");
  const [newFactVal, setNewFactVal] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newSource, setNewSource] = useState("");

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
  const
