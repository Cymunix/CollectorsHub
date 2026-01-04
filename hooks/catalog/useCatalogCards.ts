// hooks/catalog/useCatalogCards.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { CatalogCard, CatalogItemRow, MinifigRow, Category, Subcategory, Franchise } from "@/lib/catalog/types";
import { detectKindFromCategoryName } from "@/lib/catalog/utils";

type UseCatalogCardsArgs = {
  categories: Category[];
  subcategories: Subcategory[];
  franchises: Franchise[];
};

type PhotoRow = {
  catalog_item_id: string;
  image_url: string;
  is_primary: boolean | null;
  sort_order: number | null;
  created_at: string | null;
};

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getBuildingBlocksCategoryId(categories: Category[]) {
  const byName =
    categories.find((c) => {
      const n = norm(c.name);
      return (
        n.includes("building block") ||
        (n.includes("building") && n.includes("block")) ||
        n.includes("lego") ||
        n.includes("bricks")
      );
    })?.id ?? "";

  return byName;
}

export function useCatalogCards({ categories, subcategories, franchises }: UseCatalogCardsArgs) {
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lookup maps
  const catNameMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const subNameMap = useMemo(() => {
    const m = new Map<string, string>();
    subcategories.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [subcategories]);

  const franchiseNameMap = useMemo(() => {
    const m = new Map<string, string>();
    franchises.forEach((f) => m.set(f.id, f.name));
    return m;
  }, [franchises]);

  const buildingBlocksCategoryId = useMemo(() => {
    const id = getBuildingBlocksCategoryId(categories);
    if (!id && categories.length) {
      console.warn(
        "[Catalog] Could not find Building Blocks category id by name. Minifigs may not filter correctly. Categories:",
        categories.map((c) => c.name)
      );
    }
    return id;
  }, [categories]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1) Base items
      // ✅ INCLUDE image_url because some installs use catalog_items.image_url directly
      // ✅ INCLUDE is_bundle for bundle UI badges + tabs.
      // ✅ INCLUDE production_status so list view can show status and LEGO link rules.
      const { data: baseItems, error: baseErr } = await supabase
        .from("catalog_items")
        .select(
          "id,name,image_url,release_year,version,upc,created_at,category_id,subcategory_id,franchise_id,is_bundle,production_status"
        )
        .order("created_at", { ascending: false });

      if (baseErr) throw baseErr;

      const rows = (baseItems ?? []) as (CatalogItemRow & {
        image_url?: string | null;
        is_bundle?: boolean | null;
        production_status?: string | null;
      })[];

      const ids = rows.map((r) => r.id);

      // 2) Photos table (optional). If empty or table missing, we fall back to catalog_items.image_url
      const photoMap = new Map<string, string>();

      if (ids.length) {
        const { data: photoRows, error: photoErr } = await supabase
          .from("catalog_item_photos")
          .select("catalog_item_id,image_url,is_primary,sort_order,created_at")
          .in("catalog_item_id", ids)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (photoErr) {
          // Don't fail the whole catalogue if photos table isn't set up yet
          console.warn("catalog_item_photos select failed (will fall back to catalog_items.image_url):", photoErr.message);
        } else {
          for (const p of (photoRows ?? []) as PhotoRow[]) {
            if (!photoMap.has(p.catalog_item_id) && p.image_url) {
              photoMap.set(p.catalog_item_id, p.image_url);
            }
          }
        }
      }

      // 3) Detail tables
      const safeSelect = async (table: string, select: string) => {
        if (!ids.length) return [] as any[];
        const res = await supabase.from(table).select(select).in("catalog_item_id", ids);
        if (res.error) {
          console.warn(`Skipping ${table}:`, res.error.message);
          return [] as any[];
        }
        return (res.data ?? []) as any[];
      };

      // ✅ Add LEGO rows table for piece count + retail prices
      const [
        bbDetails,
        bbRowDetails,
        tradingDetails,
        sportsDetails,
        musicDetails,
        toyDetails,
        gameDetails,
        comicDetails,
      ] = await Promise.all([
        // Theme/subtheme (legacy / optional depending on your schema)
        safeSelect("catalog_building_blocks", "catalog_item_id,theme_id,subtheme_id,bb_themes(name),bb_subthemes(name)"),

        // LEGO set number / pieces / retail
        safeSelect("catalog_building_blocks_rows", "catalog_item_id,set_number,piece_count,retail_cad,retail_usd"),

        safeSelect(
          "catalog_trading_cards",
          "catalog_item_id,manufacturer_id,set_id,card_type_id,card_manufacturers(name),card_sets(name),card_types(name)"
        ),
        safeSelect(
          "catalog_sports_cards",
          "catalog_item_id,manufacturer_id,set_id,card_type_id,card_manufacturers(name),card_sets(name),card_types(name)"
        ),
        safeSelect("catalog_music", "catalog_item_id,artist_id,music_artists(name)"),
        safeSelect(
          "catalog_toys",
          "catalog_item_id,manufacturer_id,brand_id,line_id,toy_manufacturers(name),toy_brands(name),toy_lines(name)"
        ),
        safeSelect("catalog_games", "catalog_item_id,platform_id,publisher_id,game_platforms(name)"),
        safeSelect("catalog_comics", "catalog_item_id,publisher_id,series,issue_number,comic_publishers(name)"),
      ]);

      const bbMap = new Map<string, any>();
      bbDetails.forEach((d) => bbMap.set(d.catalog_item_id, d));

      const bbRowMap = new Map<string, any>();
      bbRowDetails.forEach((d) => bbRowMap.set(d.catalog_item_id, d));

      const tradingMap = new Map<string, any>();
      tradingDetails.forEach((d) => tradingMap.set(d.catalog_item_id, d));

      const sportsMap = new Map<string, any>();
      sportsDetails.forEach((d) => sportsMap.set(d.catalog_item_id, d));

      const musicMap = new Map<string, any>();
      musicDetails.forEach((d) => musicMap.set(d.catalog_item_id, d));

      const toysMap = new Map<string, any>();
      toyDetails.forEach((d) => toysMap.set(d.catalog_item_id, d));

      const gamesMap = new Map<string, any>();
      gameDetails.forEach((d) => gamesMap.set(d.catalog_item_id, d));

      const comicsMap = new Map<string, any>();
      comicDetails.forEach((d) => comicsMap.set(d.catalog_item_id, d));

      // 4) Build item cards (+ listRow payload for list view)
      const builtItems: CatalogCard[] = rows.map((r) => {
        const categoryName = catNameMap.get(r.category_id) || "";
        const kind = detectKindFromCategoryName(categoryName);

        // ✅ Use photos table if it has one, else fall back to catalog_items.image_url
        const image_url = photoMap.get(r.id) ?? (r as any).image_url ?? null;

        const franchiseName = r.franchise_id ? franchiseNameMap.get(r.franchise_id) : "";
        const subName = subNameMap.get(r.subcategory_id) || "";

        let secondary = "";

        if (kind === "building_blocks") {
          const d = bbMap.get(r.id);
          const themeName = d?.bb_themes?.name || d?.bb_themes?.[0]?.name || "";
          const subthemeName = d?.bb_subthemes?.name || d?.bb_subthemes?.[0]?.name || "";
          secondary = [themeName, subthemeName].filter(Boolean).join(" • ");
        } else if (kind === "toy") {
          const d = toysMap.get(r.id);
          const m = d?.toy_manufacturers?.name || d?.toy_manufacturers?.[0]?.name || "";
          const line = d?.toy_lines?.name || d?.toy_lines?.[0]?.name || "";
          secondary = [m, line].filter(Boolean).join(" • ");
        } else if (kind === "gaming") {
          const d = gamesMap.get(r.id);
          const platform = d?.game_platforms?.name || d?.game_platforms?.[0]?.name || "";
          secondary = [platform, r.version || ""].filter(Boolean).join(" • ");
        } else if (kind === "music") {
          const d = musicMap.get(r.id);
          const artist = d?.music_artists?.name || d?.music_artists?.[0]?.name || "";
          secondary = [artist, r.version || ""].filter(Boolean).join(" • ");
        } else if (kind === "comic") {
          const d = comicsMap.get(r.id);
          const seriesName = d?.series || "";
          const issue = d?.issue_number ? `#${String(d.issue_number).replace(/^#/, "")}` : "";
          secondary = [seriesName, issue].filter(Boolean).join(" ");
        } else if (kind === "trading_card") {
          const d = tradingMap.get(r.id);
          const man = d?.card_manufacturers?.name || d?.card_manufacturers?.[0]?.name || "";
          const set = d?.card_sets?.name || d?.card_sets?.[0]?.name || "";
          secondary = [man, set].filter(Boolean).join(" • ");
        } else if (kind === "sports_card") {
          const d = sportsMap.get(r.id);
          const man = d?.card_manufacturers?.name || d?.card_manufacturers?.[0]?.name || "";
          const set = d?.card_sets?.name || d?.card_sets?.[0]?.name || "";
          secondary = [man, set].filter(Boolean).join(" • ");
        } else if (kind === "movie") {
          secondary = [subName, franchiseName, r.version || ""].filter(Boolean).join(" • ");
        } else {
          secondary = [subName, franchiseName].filter(Boolean).join(" • ");
        }

        if (!secondary) secondary = [subName, franchiseName].filter(Boolean).join(" • ");

        const bb = bbMap.get(r.id);
        const bbRow = bbRowMap.get(r.id);

        const toys = toysMap.get(r.id);
        const games = gamesMap.get(r.id);
        const music = musicMap.get(r.id);
        const comic = comicsMap.get(r.id);
        const trading = tradingMap.get(r.id);
        const sports = sportsMap.get(r.id);

        // ✅ List-row payload (used by your dense list view)
        // Everything generic from catalog_items, LEGO extras from catalog_building_blocks_rows
        const listRow = {
          id: r.id,
          name: r.name,
          version: r.version ?? null,
          image_url,

          category_id: r.category_id,
          subcategory_id: r.subcategory_id,
          franchise_id: r.franchise_id,

          production_status: (r as any).production_status ?? null,

          // LEGO extras (null unless kind is building_blocks and rows table exists)
          lego_set_number: bbRow?.set_number ?? null,
          lego_piece_count: bbRow?.piece_count ?? null,
          lego_retail_cad: bbRow?.retail_cad ?? null,
          lego_retail_usd: bbRow?.retail_usd ?? null,
        };

        return {
          id: r.id,
          kind,
          name: r.name,
          secondary,
          image_url,

          category_id: r.category_id,
          subcategory_id: r.subcategory_id,
          franchise_id: r.franchise_id,

          release_year: typeof r.release_year === "number" ? r.release_year : null,
          version: r.version ?? null,
          created_at: r.created_at ?? null,

          // Bundles
          is_bundle: (r as any)?.is_bundle ?? null,

          // ✅ Status (so both card + list views can show it if desired)
          production_status: (r as any).production_status ?? null,

          bb_theme_id: bb?.theme_id ?? null,
          bb_subtheme_id: bb?.subtheme_id ?? null,

          card_manufacturer_id: (trading?.manufacturer_id ?? sports?.manufacturer_id) ?? null,
          card_set_id: (trading?.set_id ?? sports?.set_id) ?? null,
          card_type_id: (trading?.card_type_id ?? sports?.card_type_id) ?? null,

          music_artist_id: music?.artist_id ?? null,

          toy_manufacturer_id: toys?.manufacturer_id ?? null,
          toy_brand_id: toys?.brand_id ?? null,
          toy_line_id: toys?.line_id ?? null,

          game_platform_id: games?.platform_id ?? null,

          comic_publisher_id: comic?.publisher_id ?? null,

          // ✅ New: attach list view model
          listRow,
        } as any; // keep as any to avoid breaking if your CatalogCard type hasn't been updated yet
      });

      // 5) Minifigs
      const { data: minifigRows, error: minifigErr } = await supabase
        .from("catalog_minifigs")
        .select("minifig_id,name,minifig_number,image_url,subcategory_id,franchise_id,created_at")
        .order("created_at", { ascending: false });

      if (minifigErr) {
        console.warn("catalog_minifigs select failed:", minifigErr.message);
      }

      const builtMinifigs: CatalogCard[] = ((minifigRows ?? []) as MinifigRow[]).map((mf: any) => {
        const listRow = {
          id: mf.minifig_id,
          name: mf.name,
          version: null,
          image_url: mf.image_url ?? null,

          category_id: buildingBlocksCategoryId || "",
          subcategory_id: mf.subcategory_id,
          franchise_id: mf.franchise_id ?? null,

          production_status: null,

          lego_set_number: null,
          lego_piece_count: null,
          lego_retail_cad: null,
          lego_retail_usd: null,
        };

        return {
          id: mf.minifig_id,
          kind: "minifig",
          name: mf.name,
          secondary: mf.minifig_number ? `Fig # ${mf.minifig_number}` : "Minifig",
          image_url: mf.image_url ?? null,

          category_id: buildingBlocksCategoryId || "",
          subcategory_id: mf.subcategory_id,
          franchise_id: mf.franchise_id ?? null,

          release_year: null,
          version: null,
          created_at: mf.created_at ?? null,

          // Bundles (minifigs are never bundles)
          is_bundle: false,

          production_status: null,

          listRow,
        } as any;
      });

      setCards([...builtItems, ...builtMinifigs]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load catalogue items.");
    } finally {
      setLoading(false);
    }
  }, [catNameMap, subNameMap, franchiseNameMap, buildingBlocksCategoryId]);

  useEffect(() => {
    if (!categories.length || !subcategories.length) return;
    reload();
  }, [categories.length, subcategories.length, reload]);

  return { cards, loading, error, reload };
}
