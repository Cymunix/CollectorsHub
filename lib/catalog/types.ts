// lib/catalog/types.ts

export type Category = { id: string; name: string };
export type Subcategory = { id: string; name: string; category_id: string };
export type Franchise = { id: string; name: string };

export type BbTheme = { id: string; name: string; subcategory_id: string };
export type BbSubtheme = { id: string; name: string; theme_id: string };

export type CardManufacturer = { id: string; name: string };
export type CardSet = { id: string; name: string; manufacturer_id: string };
export type CardType = { id: string; name: string };

export type MusicArtist = { id: string; name: string };

export type ToyManufacturer = { id: string; name: string };
export type ToyBrand = { id: string; name: string; manufacturer_id: string };
export type ToyLine = { id: string; name: string; brand_id: string };

export type GamePlatform = { id: string; name: string };

export type ComicPublisher = { id: string; name: string };

export type ItemKind =
  | "building_blocks"
  | "trading_card"
  | "sports_card"
  | "music"
  | "toy"
  | "movie"
  | "gaming"
  | "comic"
  | "minifig";

export type CatalogItemRow = {
  id: string;
  name: string;
  release_year: number | null;
  version: string | null;
  upc: string | null;
  created_at: string | null;
  category_id: string;
  subcategory_id: string;
  franchise_id: string | null;
};

export type MinifigRow = {
  minifig_id: string;
  name: string;
  minifig_number: string;
  image_url: string | null;
  subcategory_id: string;
  franchise_id: string | null;
  created_at: string | null;
};

// ✅ UI-friendly minifig type (your queries alias minifig_id -> id)
export type CatalogMinifig = {
  id: string; // aliased from minifig_id
  name: string | null;
  minifig_number: string;
  image_url: string | null;
  subcategory_id: string;
  franchise_id?: string | null;
  created_at?: string | null;
};

// ✅ Selected minifigs carry qty (so sets can have duplicates)
export type SelectedMinifig = CatalogMinifig & { qty: number };

export type CatalogCard = {
  id: string;
  kind: ItemKind;
  name: string;
  secondary: string;
  image_url: string | null;

  category_id: string;
  subcategory_id: string;
  franchise_id: string | null;

  release_year: number | null;
  version: string | null;
  created_at: string | null;

  // dynamic filter ids
  bb_theme_id?: string | null;
  bb_subtheme_id?: string | null;

  card_manufacturer_id?: string | null;
  card_set_id?: string | null;
  card_type_id?: string | null;

  music_artist_id?: string | null;

  toy_manufacturer_id?: string | null;
  toy_brand_id?: string | null;
  toy_line_id?: string | null;

  game_platform_id?: string | null;

  comic_publisher_id?: string | null;
};

export type QuickAddDefault = "collection" | "wishlist" | "both" | "ask";
