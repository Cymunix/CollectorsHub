// lib/catalog/addItem.types.ts

import type { ItemKind } from "./types";

/* -----------------------------
   Shared UI helpers
----------------------------- */

export type Banner =
  | { type: "success"; msg: string }
  | { type: "error"; msg: string };

/* -----------------------------
   Wiki / Overview drafts
----------------------------- */

export type WikiFactDraft = {
  k: string;
  v: string;
};

export type WikiDraft = {
  summary: string;
  description: string;
  facts: WikiFactDraft[];
  checklist: string[];
  sources: string[];
};

/* -----------------------------
   Variant / related links
----------------------------- */

export const LINK_TYPES = [
  "variant",
  "recolor",
  "reprint",
  "edition",
  "related",
] as const;

export type LinkType = (typeof LINK_TYPES)[number];

export type VariantSearchRow = {
  id: string;
  name: string;
  upc: string | null;
  release_year: number | null;
};

export type VariantDraft = {
  target_id: string;
  target_name: string;
  link_type: LinkType;
  label: string;
};

/* -----------------------------
   Trading / Sports card rarity
----------------------------- */

export const CARD_RARITY_OPTIONS = [
  "Common",
  "Uncommon",
  "Rare",
  "Ultra Rare",
  "Secret Rare",
  "Promo",
  "Limited",
  "One of One",
  "Other",
] as const;

export type CardRarityPreset = (typeof CARD_RARITY_OPTIONS)[number];

export type CardRarityDraft = {
  preset: CardRarityPreset | "";
  custom: string;
};

/* -----------------------------
   Add-item form state
----------------------------- */

export type AddItemFormState = {
  kind: ItemKind;

  categoryId: string;
  subcategoryId: string;
  franchiseId: string;

  name: string;
  releaseYear: string;
  upc: string;
  version: string;

  // Cards
  cardRarity: CardRarityDraft;
};
