"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  BbSubtheme,
  BbTheme,
  CardManufacturer,
  CardSet,
  CardType,
  Category,
  ComicPublisher,
  Franchise,
  GamePlatform,
  MusicArtist,
  Subcategory,
  ToyBrand,
  ToyLine,
  ToyManufacturer,
} from "@/lib/catalog/types";

type CatalogMeta = {
  categories: Category[];
  subcategories: Subcategory[];
  franchises: Franchise[];

  bbThemes: BbTheme[];
  bbSubthemes: BbSubtheme[];

  cardManufacturers: CardManufacturer[];
  cardSets: CardSet[];
  cardTypes: CardType[];

  musicArtists: MusicArtist[];

  toyManufacturers: ToyManufacturer[];
  toyBrands: ToyBrand[];
  toyLines: ToyLine[];

  gamePlatforms: GamePlatform[];

  comicPublishers: ComicPublisher[];
};

export function useCatalogMeta() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<CatalogMeta>({
    categories: [],
    subcategories: [],
    franchises: [],

    bbThemes: [],
    bbSubthemes: [],

    cardManufacturers: [],
    cardSets: [],
    cardTypes: [],

    musicArtists: [],

    toyManufacturers: [],
    toyBrands: [],
    toyLines: [],

    gamePlatforms: [],

    comicPublishers: [],
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        catRes,
        subRes,
        franchiseRes,

        bbThemeRes,
        bbSubthemeRes,

        cardManRes,
        cardSetRes,
        cardTypeRes,

        musicArtistRes,

        toyManRes,
        toyBrandRes,
        toyLineRes,

        platformRes,

        comicPubRes,
      ] = await Promise.all([
        supabase.from("categories").select("id,name").order("name"),
        supabase.from("subcategories").select("id,name,category_id").order("name"),
        supabase.from("franchises").select("id,name").order("name"),

        supabase.from("bb_themes").select("id,name,subcategory_id").order("name"),
        supabase.from("bb_subthemes").select("id,name,theme_id").order("name"),

        supabase.from("card_manufacturers").select("id,name").order("name"),
        supabase.from("card_sets").select("id,name,manufacturer_id").order("name"),
        supabase.from("card_types").select("id,name").order("name"),

        supabase.from("music_artists").select("id,name").order("name"),

        supabase.from("toy_manufacturers").select("id,name").order("name"),
        supabase.from("toy_brands").select("id,name,manufacturer_id").order("name"),
        supabase.from("toy_lines").select("id,name,brand_id").order("name"),

        supabase.from("game_platforms").select("id,name").order("name"),

        supabase.from("comic_publishers").select("id,name").order("name"),
      ]);

      if (catRes.error) throw catRes.error;
      if (subRes.error) throw subRes.error;

      setMeta({
        categories: (catRes.data ?? []) as Category[],
        subcategories: (subRes.data ?? []) as Subcategory[],
        franchises: !franchiseRes.error ? ((franchiseRes.data ?? []) as Franchise[]) : [],

        bbThemes: !bbThemeRes.error ? ((bbThemeRes.data ?? []) as BbTheme[]) : [],
        bbSubthemes: !bbSubthemeRes.error ? ((bbSubthemeRes.data ?? []) as BbSubtheme[]) : [],

        cardManufacturers: !cardManRes.error ? ((cardManRes.data ?? []) as CardManufacturer[]) : [],
        cardSets: !cardSetRes.error ? ((cardSetRes.data ?? []) as CardSet[]) : [],
        cardTypes: !cardTypeRes.error ? ((cardTypeRes.data ?? []) as CardType[]) : [],

        musicArtists: !musicArtistRes.error ? ((musicArtistRes.data ?? []) as MusicArtist[]) : [],

        toyManufacturers: !toyManRes.error ? ((toyManRes.data ?? []) as ToyManufacturer[]) : [],
        toyBrands: !toyBrandRes.error ? ((toyBrandRes.data ?? []) as ToyBrand[]) : [],
        toyLines: !toyLineRes.error ? ((toyLineRes.data ?? []) as ToyLine[]) : [],

        gamePlatforms: !platformRes.error ? ((platformRes.data ?? []) as GamePlatform[]) : [],

        comicPublishers: !comicPubRes.error ? ((comicPubRes.data ?? []) as ComicPublisher[]) : [],
      });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load filters.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...meta, loading, error, reload };
}
