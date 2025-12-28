// components/catalog/add-item/hooks/useCatalogMeta.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ---------------- local types ---------------- */

type Category = { id: string; name: string };
type Subcategory = { id: string; name: string; category_id: string | null };

type Franchise = { id: string; name: string };

type BbTheme = { id: string; name: string; subcategory_id: string | null };
type BbSubtheme = { id: string; name: string; theme_id: string | null };

type CardManufacturer = { id: string; name: string };
type CardSet = { id: string; name: string; manufacturer_id: string | null };
type CardType = { id: string; name: string };

type MusicArtist = { id: string; name: string };

type ToyManufacturer = { id: string; name: string };
type ToyBrand = { id: string; name: string; manufacturer_id: string | null };
type ToyLine = { id: string; name: string; brand_id: string | null };

type Person = { id: string; name: string };

type GamePlatform = { id: string; name: string };
type GamePublisher = { id: string; name: string };

type ComicPublisher = { id: string; name: string };

export type AddItemMeta = {
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

  people: Person[];

  gamePlatforms: GamePlatform[];
  gamePublishers: GamePublisher[];

  comicPublishers: ComicPublisher[];
};

/* ---------------- hook ---------------- */

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

        // hard fail only on the foundational tables
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
        console.error(e);
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

export default useCatalogMeta;
