// components/catalog/add-item/hooks/useCatalogMeta.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  AddItemMeta,
  Category,
  Subcategory,
  Franchise,
  BbTheme,
  BbSubtheme,
  CardManufacturer,
  CardSet,
  CardType,
  MusicArtist,
  ToyManufacturer,
  ToyBrand,
  ToyLine,
  Person,
  GamePlatform,
  GamePublisher,
  ComicPublisher,
} from "@/lib/catalog/types";

export function useCatalogMeta(open: boolean) {
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [meta, setMeta] = useState<AddItemMeta>({
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
    people: [],
    gamePlatforms: [],
    gamePublishers: [],
    comicPublishers: [],
  });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      setMetaLoading(true);
      setMetaError(null);

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

          artistRes,

          toyManRes,
          toyBrandRes,
          toyLineRes,

          peopleRes,

          platformRes,
          publisherRes,

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

          supabase.from("people").select("id,name").order("name"),

          supabase.from("game_platforms").select("id,name").order("name"),
          supabase.from("game_publishers").select("id,name").order("name"),

          supabase.from("comic_publishers").select("id,name").order("name"),
        ]);

        if (catRes.error) throw catRes.error;
        if (subRes.error) throw subRes.error;

        if (cancelled) return;

        setMeta({
          categories: (catRes.data ?? []) as Category[],
          subcategories: (subRes.data ?? []) as Subcategory[],
          franchises: franchiseRes.error ? [] : ((franchiseRes.data ?? []) as Franchise[]),

          bbThemes: bbThemeRes.error ? [] : ((bbThemeRes.data ?? []) as BbTheme[]),
          bbSubthemes: bbSubthemeRes.error ? [] : ((bbSubthemeRes.data ?? []) as BbSubtheme[]),

          cardManufacturers: cardManRes.error ? [] : ((cardManRes.data ?? []) as CardManufacturer[]),
          cardSets: cardSetRes.error ? [] : ((cardSetRes.data ?? []) as CardSet[]),
          cardTypes: cardTypeRes.error ? [] : ((cardTypeRes.data ?? []) as CardType[]),

          musicArtists: artistRes.error ? [] : ((artistRes.data ?? []) as MusicArtist[]),

          toyManufacturers: toyManRes.error ? [] : ((toyManRes.data ?? []) as ToyManufacturer[]),
          toyBrands: toyBrandRes.error ? [] : ((toyBrandRes.data ?? []) as ToyBrand[]),
          toyLines: toyLineRes.error ? [] : ((toyLineRes.data ?? []) as ToyLine[]),

          people: peopleRes.error ? [] : ((peopleRes.data ?? []) as Person[]),

          gamePlatforms: platformRes.error ? [] : ((platformRes.data ?? []) as GamePlatform[]),
          gamePublishers: publisherRes.error ? [] : ((publisherRes.data ?? []) as GamePublisher[]),

          comicPublishers: comicPubRes.error ? [] : ((comicPubRes.data ?? []) as ComicPublisher[]),
        });
      } catch (e: any) {
        if (!cancelled) setMetaError(e?.message || "Failed to load catalog metadata.");
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  return { meta, setMeta, metaLoading, metaError };
}
