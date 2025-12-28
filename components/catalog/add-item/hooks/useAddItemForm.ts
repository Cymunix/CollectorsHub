"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NamedRow = { id: string; name: string };

export type CatalogMeta = {
  categories: NamedRow[];
  subcategories: Array<NamedRow & { category_id?: string | null }>;
  franchises: NamedRow[];

  // Building Blocks
  bbThemes: any[];
  bbSubthemes: any[];

  // Cards
  cardManufacturers: any[];
  cardSets: any[];
  cardTypes: any[];

  // Music
  musicArtists: any[];

  // Toys
  toyManufacturers: any[];
  toyBrands: any[];
  toyLines: any[];

  // People (movies, etc.)
  people: NamedRow[];

  // Gaming
  gamePlatforms: any[];
  gamePublishers: any[];

  // Comics
  comicPublishers: any[];

  [key: string]: any;
};

const EMPTY_META: CatalogMeta = {
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
};

export function useCatalogMeta(open: boolean) {
  const [meta, setMeta] = useState<CatalogMeta>(EMPTY_META);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!open) return;

      setMetaLoading(true);
      setMetaError(null);

      try {
        // NOTE: keep selects conservative (id,name) so schema mismatches don't explode builds.
        const [
          categoriesRes,
          subcategoriesRes,
          franchisesRes,
          bbThemesRes,
          bbSubthemesRes,
          cardManufacturersRes,
          cardSetsRes,
          cardTypesRes,
          musicArtistsRes,
          toyManufacturersRes,
          toyBrandsRes,
          toyLinesRes,
          peopleRes,
          gamePlatformsRes,
          gamePublishersRes,
          comicPublishersRes,
        ] = await Promise.all([
          supabase.from("categories").select("id,name").order("name", { ascending: true }),
          supabase.from("subcategories").select("id,name,category_id").order("name", { ascending: true }),
          supabase.from("franchises").select("id,name").order("name", { ascending: true }),

          supabase.from("bb_themes").select("*").order("name", { ascending: true }),
          supabase.from("bb_subthemes").select("*").order("name", { ascending: true }),

          supabase.from("card_manufacturers").select("*").order("name", { ascending: true }),
          supabase.from("card_sets").select("*").order("name", { ascending: true }),
          supabase.from("card_types").select("*").order("name", { ascending: true }),

          supabase.from("music_artists").select("*").order("name", { ascending: true }),

          supabase.from("toy_manufacturers").select("*").order("name", { ascending: true }),
          supabase.from("toy_brands").select("*").order("name", { ascending: true }),
          supabase.from("toy_lines").select("*").order("name", { ascending: true }),

          supabase.from("people").select("id,name").order("name", { ascending: true }),

          supabase.from("game_platforms").select("*").order("name", { ascending: true }),
          supabase.from("game_publishers").select("*").order("name", { ascending: true }),

          supabase.from("comic_publishers").select("*").order("name", { ascending: true }),
        ]);

        const firstErr =
          categoriesRes.error ||
          subcategoriesRes.error ||
          franchisesRes.error ||
          bbThemesRes.error ||
          bbSubthemesRes.error ||
          cardManufacturersRes.error ||
          cardSetsRes.error ||
          cardTypesRes.error ||
          musicArtistsRes.error ||
          toyManufacturersRes.error ||
          toyBrandsRes.error ||
          toyLinesRes.error ||
          peopleRes.error ||
          gamePlatformsRes.error ||
          gamePublishersRes.error ||
          comicPublishersRes.error;

        if (firstErr) throw firstErr;

        if (cancelled) return;

        setMeta({
          categories: (categoriesRes.data ?? []) as any,
          subcategories: (subcategoriesRes.data ?? []) as any,
          franchises: (franchisesRes.data ?? []) as any,

          bbThemes: (bbThemesRes.data ?? []) as any,
          bbSubthemes: (bbSubthemesRes.data ?? []) as any,

          cardManufacturers: (cardManufacturersRes.data ?? []) as any,
          cardSets: (cardSetsRes.data ?? []) as any,
          cardTypes: (cardTypesRes.data ?? []) as any,

          musicArtists: (musicArtistsRes.data ?? []) as any,

          toyManufacturers: (toyManufacturersRes.data ?? []) as any,
          toyBrands: (toyBrandsRes.data ?? []) as any,
          toyLines: (toyLinesRes.data ?? []) as any,

          people: (peopleRes.data ?? []) as any,

          gamePlatforms: (gamePlatformsRes.data ?? []) as any,
          gamePublishers: (gamePublishersRes.data ?? []) as any,

          comicPublishers: (comicPublishersRes.data ?? []) as any,
        });
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setMeta(EMPTY_META);
          setMetaError(e?.message || "Failed to load catalog metadata.");
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return { meta, setMeta, metaLoading, metaError };
}
