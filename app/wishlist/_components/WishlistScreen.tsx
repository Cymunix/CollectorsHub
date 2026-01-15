// app/wishlist/_components/WishlistScreen.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/lib/useUserProfile";

type Category = { id: string; name: string };
type Subcategory = { id: string; name: string; category_id: string };
type Franchise = { id: string; name: string };

type ItemKind =
  | "building_blocks"
  | "toy"
  | "gaming"
  | "music"
  | "comic"
  | "trading_card"
  | "sports_card"
  | "movie"
  | "minifig";

type CatalogCard = {
  id: string; // catalog_item_id (or minifig id if kind=minifig)
  kind: ItemKind;
  name: string;
  secondary: string;
  image_url: string | null;

  category_id: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;

  release_year: number | null;
  version: string | null;
  created_at: string | null;

  // dynamic filter keys
  bb_theme_id?: string | null;
  bb_subtheme_id?: string | null;

  toy_manufacturer_id?: string | null;
  toy_brand_id?: string | null;
  toy_line_id?: string | null;

  game_platform_id?: string | null;

  music_artist_id?: string | null;

  comic_publisher_id?: string | null;

  card_manufacturer_id?: string | null;
  card_set_id?: string | null;
  card_type_id?: string | null;
};

type BbTheme = { id: string; name: string };
type BbSubtheme = { id: string; name: string };

type CardManufacturer = { id: string; name: string };
type CardSet = { id: string; name: string; manufacturer_id: string };
type CardType = { id: string; name: string };

type MusicArtist = { id: string; name: string };

type ToyManufacturer = { id: string; name: string };
type ToyBrand = { id: string; name: string; manufacturer_id: string };
type ToyLine = { id: string; name: string; brand_id: string };

type GamePlatform = { id: string; name: string };

type ComicPublisher = { id: string; name: string };

type WishlistTab = "saved" | "alerts" | "insights" | "suggestions";

type Props = {
  onRequireAuth?: () => void;
};

function detectKindFromCategoryName(categoryName: string): Exclude<ItemKind, "minifig"> {
  const n = (categoryName || "").toLowerCase();
  if (n.includes("sports") && n.includes("card")) return "sports_card";
  if (n.includes("trading") && n.includes("card")) return "trading_card";

  if (n.includes("music")) return "music";
  if (n.includes("toy")) return "toy";
  if (n.includes("movie") || n.includes("film")) return "movie";
  if (n.includes("gaming") || n.includes("video game") || n.includes("games")) return "gaming";
  if (n.includes("comic")) return "comic";

  return "building_blocks";
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-full border text-[12px] font-semibold transition",
        active ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-gray-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ComingSoonPanel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{subtitle}</p>

      <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-gray-500">Coming soon.</div>
    </div>
  );
}

export default function WishlistScreen({ onRequireAuth }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const urlSearch = (sp.get("search") || "").trim();

  const { user, loading: profileLoading } = useUserProfile() as any;

  const [activeTab, setActiveTab] = useState<WishlistTab>("saved");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);

  const [bbThemes, setBbThemes] = useState<BbTheme[]>([]);
  const [bbSubthemes, setBbSubthemes] = useState<BbSubtheme[]>([]);

  const [cardManufacturers, setCardManufacturers] = useState<CardManufacturer[]>([]);
  const [cardSets, setCardSets] = useState<CardSet[]>([]);
  const [cardTypes, setCardTypes] = useState<CardType[]>([]);

  const [musicArtists, setMusicArtists] = useState<MusicArtist[]>([]);

  const [toyManufacturers, setToyManufacturers] = useState<ToyManufacturer[]>([]);
  const [toyBrands, setToyBrands] = useState<ToyBrand[]>([]);
  const [toyLines, setToyLines] = useState<ToyLine[]>([]);

  const [gamePlatforms, setGamePlatforms] = useState<GamePlatform[]>([]);

  const [comicPublishers, setComicPublishers] = useState<ComicPublisher[]>([]);

  const [cards, setCards] = useState<CatalogCard[]>([]);

  // -------------------- Filters --------------------
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [franchiseId, setFranchiseId] = useState("");

  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");

  const [selectedKind, setSelectedKind] = useState<ItemKind | "all">("all");

  const [bbThemeId, setBbThemeId] = useState("");
  const [bbSubthemeId, setBbSubthemeId] = useState("");

  const [cardManufacturerId, setCardManufacturerId] = useState("");
  const [cardSetId, setCardSetId] = useState("");
  const [cardTypeId, setCardTypeId] = useState("");

  const [musicArtistId, setMusicArtistId] = useState("");

  const [toyManufacturerId, setToyManufacturerId] = useState("");
  const [toyBrandId, setToyBrandId] = useState("");
  const [toyLineId, setToyLineId] = useState("");

  const [gamePlatformId, setGamePlatformId] = useState("");

  const [comicPublisherId, setComicPublisherId] = useState("");

  const clearFilters = () => {
    setSelectedKind("all");
    setCategoryId("");
    setSubcategoryId("");
    setFranchiseId("");
    setMinYear("");
    setMaxYear("");

    setBbThemeId("");
    setBbSubthemeId("");

    setCardManufacturerId("");
    setCardSetId("");
    setCardTypeId("");

    setMusicArtistId("");

    setToyManufacturerId("");
    setToyBrandId("");
    setToyLineId("");

    setGamePlatformId("");

    setComicPublisherId("");
  };

  const loadMeta = async () => {
    setMetaLoading(true);
    setMetaError(null);

    try {
      const [
        catRes,
        subRes,
        frRes,

        bbThemeRes,
        bbSubRes,

        cardManRes,
        cardSetRes,
        cardTypeRes,

        artistRes,

        toyManRes,
        toyBrandRes,
        toyLineRes,

        platformRes,

        comicPubRes,
      ] = await Promise.all([
        supabase.from("categories").select("id,name").order("name"),
        supabase.from("subcategories").select("id,name,category_id").order("name"),
        supabase.from("franchises").select("id,name").order("name"),

        supabase.from("bb_themes").select("id,name").order("name"),
        supabase.from("bb_subthemes").select("id,name").order("name"),

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

      const err =
        catRes.error ||
        subRes.error ||
        frRes.error ||
        bbThemeRes.error ||
        bbSubRes.error ||
        cardManRes.error ||
        cardSetRes.error ||
        cardTypeRes.error ||
        artistRes.error ||
        toyManRes.error ||
        toyBrandRes.error ||
        toyLineRes.error ||
        platformRes.error ||
        comicPubRes.error;

      if (err) throw err;

      setCategories((catRes.data ?? []) as Category[]);
      setSubcategories((subRes.data ?? []) as Subcategory[]);
      setFranchises((frRes.data ?? []) as Franchise[]);

      setBbThemes((bbThemeRes.data ?? []) as BbTheme[]);
      setBbSubthemes((bbSubRes.data ?? []) as BbSubtheme[]);

      setCardManufacturers((cardManRes.data ?? []) as CardManufacturer[]);
      setCardSets((cardSetRes.data ?? []) as CardSet[]);
      setCardTypes((cardTypeRes.data ?? []) as CardType[]);

      setMusicArtists((artistRes.data ?? []) as MusicArtist[]);

      setToyManufacturers((toyManRes.data ?? []) as ToyManufacturer[]);
      setToyBrands((toyBrandRes.data ?? []) as ToyBrand[]);
      setToyLines((toyLineRes.data ?? []) as ToyLine[]);

      setGamePlatforms((platformRes.data ?? []) as GamePlatform[]);

      setComicPublishers((comicPubRes.data ?? []) as ComicPublisher[]);
    } catch (e: any) {
      console.error(e);
      setMetaError(e?.message || "Failed to load filter metadata.");
    } finally {
      setMetaLoading(false);
    }
  };

  const loadWishlist = async () => {
    if (!user?.userId) return;

    setLoading(true);
    setLoadError(null);

    try {
      const wishRes = await supabase
        .from("user_wishlist_items")
        .select("catalog_item_id,created_at")
        .eq("user_id", user.userId)
        .order("created_at", { ascending: false });

      if (wishRes.error) throw wishRes.error;

      const wishlistIds = (wishRes.data ?? []).map((r: any) => r.catalog_item_id).filter(Boolean);
      if (wishlistIds.length === 0) {
        setCards([]);
        return;
      }

      const itemsRes = await supabase
        .from("catalog_items")
        .select("id,name,category_id,subcategory_id,franchise_id,release_year,version,created_at")
        .in("id", wishlistIds);

      if (itemsRes.error) throw itemsRes.error;

      const itemRows = (itemsRes.data ?? []) as any[];

      const photosRes = await supabase
        .from("catalog_item_photos")
        .select("catalog_item_id,image_url,is_primary,sort_order")
        .in("catalog_item_id", wishlistIds)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });

      if (photosRes.error) {
        console.warn("Skipping catalog_item_photos:", photosRes.error.message);
      }

      const photoMap = new Map<string, string>();
      for (const p of photosRes.data ?? []) {
        const cid = (p as any).catalog_item_id as string;
        if (!photoMap.has(cid) && (p as any).image_url) {
          photoMap.set(cid, (p as any).image_url as string);
        }
      }

      const catNameMap = new Map<string, string>();
      for (const c of categories) catNameMap.set(c.id, c.name);

      const safeSelect = async (table: string, select: string) => {
        const res = await supabase.from(table).select(select).in("catalog_item_id", wishlistIds);
        if (res.error) {
          console.warn(`Skipping ${table}:`, res.error.message);
          return [] as any[];
        }
        return (res.data ?? []) as any[];
      };

      const [bbDetails, tradingDetails, sportsDetails, musicDetails, toyDetails, gameDetails, comicDetails] =
        await Promise.all([
          safeSelect("catalog_building_blocks", "catalog_item_id,theme_id,subtheme_id,bb_themes(name),bb_subthemes(name)"),
          safeSelect("catalog_trading_cards", "catalog_item_id,manufacturer_id,set_id,card_type_id,card_manufacturers(name),card_sets(name),card_types(name)"),
          safeSelect("catalog_sports_cards", "catalog_item_id,manufacturer_id,set_id,card_type_id,card_manufacturers(name),card_sets(name),card_types(name)"),
          safeSelect("catalog_music", "catalog_item_id,artist_id,music_artists(name)"),
          safeSelect("catalog_toys", "catalog_item_id,manufacturer_id,brand_id,line_id,toy_manufacturers(name),toy_brands(name),toy_lines(name)"),
          safeSelect("catalog_games", "catalog_item_id,platform_id,game_platforms(name)"),
          safeSelect("catalog_comics", "catalog_item_id,publisher_id,series,issue_number,comic_publishers(name)"),
        ]);

      const bbMap = new Map<string, any>();
      bbDetails.forEach((d) => bbMap.set(d.catalog_item_id, d));

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

      const itemById = new Map<string, any>();
      itemRows.forEach((r) => itemById.set(r.id, r));

      const built: CatalogCard[] = wishlistIds
        .map((id) => itemById.get(id))
        .filter(Boolean)
        .map((r: any) => {
          const catName = r.category_id ? catNameMap.get(r.category_id) || "" : "";
          const kind = detectKindFromCategoryName(catName);

          const subName = subcategories.find((s) => s.id === r.subcategory_id)?.name || "";
          const franchiseName = franchises.find((f) => f.id === r.franchise_id)?.name || "";

          const photo = photoMap.get(r.id) ?? null;

          let secondary = "";
          if (kind === "building_blocks") {
            const d = bbMap.get(r.id);
            const themeName = d?.bb_themes?.name || d?.bb_themes?.[0]?.name || "";
            const subthemeName = d?.bb_subthemes?.name || d?.bb_subthemes?.[0]?.name || "";
            secondary = [themeName, subthemeName].filter(Boolean).join(" • ");
          } else if (kind === "toy") {
            const d = toysMap.get(r.id);
            const man = d?.toy_manufacturers?.name || d?.toy_manufacturers?.[0]?.name || "";
            const brand = d?.toy_brands?.name || d?.toy_brands?.[0]?.name || "";
            const line = d?.toy_lines?.name || d?.toy_lines?.[0]?.name || "";
            secondary = [man, brand, line].filter(Boolean).join(" • ");
          } else if (kind === "gaming") {
            const d = gamesMap.get(r.id);
            const platform = d?.game_platforms?.name || d?.game_platforms?.[0]?.name || "";
            secondary = [platform, subName, franchiseName].filter(Boolean).join(" • ");
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
          const toys = toysMap.get(r.id);
          const games = gamesMap.get(r.id);
          const music = musicMap.get(r.id);
          const comic = comicsMap.get(r.id);
          const trading = tradingMap.get(r.id);
          const sports = sportsMap.get(r.id);

          return {
            id: r.id,
            kind,
            name: r.name,
            secondary,
            image_url: photo,

            category_id: r.category_id,
            subcategory_id: r.subcategory_id,
            franchise_id: r.franchise_id,

            release_year: typeof r.release_year === "number" ? r.release_year : null,
            version: r.version ?? null,
            created_at: r.created_at ?? null,

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
          };
        });

      setCards(built);
    } catch (e: any) {
      console.error(e);
      setLoadError(e?.message || "Failed to load wishlist.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileLoading) return;
    if (!user) onRequireAuth?.();
  }, [profileLoading, user, onRequireAuth]);

  useEffect(() => {
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.userId) return;
    if (categories.length === 0) return;
    loadWishlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, categories.length]);

  const visibleCards = useMemo(() => {
    const q = urlSearch.toLowerCase();

    return (cards ?? []).filter((it) => {
      if (selectedKind !== "all" && it.kind !== selectedKind) return false;

      if (categoryId && it.category_id !== categoryId) return false;
      if (subcategoryId && it.subcategory_id !== subcategoryId) return false;
      if (franchiseId && it.franchise_id !== franchiseId) return false;

      const minY = minYear ? Number(minYear) : null;
      const maxY = maxYear ? Number(maxYear) : null;
      if (minY !== null || maxY !== null) {
        if (typeof it.release_year !== "number") return false;
        if (minY !== null && it.release_year < minY) return false;
        if (maxY !== null && it.release_year > maxY) return false;
      }

      if (selectedKind === "building_blocks") {
        if (bbThemeId && it.bb_theme_id !== bbThemeId) return false;
        if (bbSubthemeId && it.bb_subtheme_id !== bbSubthemeId) return false;
      }

      if (selectedKind === "toy") {
        if (toyManufacturerId && it.toy_manufacturer_id !== toyManufacturerId) return false;
        if (toyBrandId && it.toy_brand_id !== toyBrandId) return false;
        if (toyLineId && it.toy_line_id !== toyLineId) return false;
      }

      if (selectedKind === "gaming") {
        if (gamePlatformId && it.game_platform_id !== gamePlatformId) return false;
      }

      if (selectedKind === "music") {
        if (musicArtistId && it.music_artist_id !== musicArtistId) return false;
      }

      if (selectedKind === "comic") {
        if (comicPublisherId && it.comic_publisher_id !== comicPublisherId) return false;
      }

      if (selectedKind === "trading_card" || selectedKind === "sports_card") {
        if (cardManufacturerId && it.card_manufacturer_id !== cardManufacturerId) return false;
        if (cardSetId && it.card_set_id !== cardSetId) return false;
        if (cardTypeId && it.card_type_id !== cardTypeId) return false;
      }

      if (q) {
        const hay = [it.name, it.secondary, String(it.release_year ?? ""), it.version ?? "", it.kind]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    cards,
    urlSearch,
    selectedKind,
    categoryId,
    subcategoryId,
    franchiseId,
    minYear,
    maxYear,
    bbThemeId,
    bbSubthemeId,
    toyManufacturerId,
    toyBrandId,
    toyLineId,
    gamePlatformId,
    musicArtistId,
    comicPublisherId,
    cardManufacturerId,
    cardSetId,
    cardTypeId,
  ]);

  const ITEMS_PER_PAGE = 25;
  const [page, setPage] = useState<number>(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(visibleCards.length / ITEMS_PER_PAGE)),
    [visibleCards.length]
  );
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedCards = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return visibleCards.slice(start, start + ITEMS_PER_PAGE);
  }, [visibleCards, safePage]);

  useEffect(() => {
    setPage(1);
  }, [
    urlSearch,
    selectedKind,
    categoryId,
    subcategoryId,
    franchiseId,
    minYear,
    maxYear,
    bbThemeId,
    bbSubthemeId,
    toyManufacturerId,
    toyBrandId,
    toyLineId,
    gamePlatformId,
    musicArtistId,
    comicPublisherId,
    cardManufacturerId,
    cardSetId,
    cardTypeId,
  ]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const rangeStart = visibleCards.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ITEMS_PER_PAGE, visibleCards.length);

  const removeFromWishlist = async (catalogItemId: string) => {
    if (!user?.userId) return;
    const ok = window.confirm("Remove this from your wishlist?");
    if (!ok) return;

    const { error } = await supabase
      .from("user_wishlist_items")
      .delete()
      .eq("user_id", user.userId)
      .eq("catalog_item_id", catalogItemId);

    if (error) {
      console.error(error);
      alert(error.message || "Failed to remove item.");
      return;
    }

    setCards((prev) => prev.filter((c) => c.id !== catalogItemId));
  };

  const isSavedTab = activeTab === "saved";

  return (
    <div className="w-full bg-[#F4F7FD] text-[#0F172A]">
      <div className="px-0 py-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">Wishlist</h1>
            <p className="text-xs text-gray-500">Everything you’ve saved for later.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => isSavedTab && loadWishlist()}
              className="rounded-full border bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={loading || !isSavedTab}
              title={!isSavedTab ? "Only applies to Saved tab for now" : "Refresh wishlist"}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <TabButton active={activeTab === "saved"} label="Saved" onClick={() => setActiveTab("saved")} />
          <TabButton active={activeTab === "alerts"} label="Alerts" onClick={() => setActiveTab("alerts")} />
          <TabButton active={activeTab === "insights"} label="Insights" onClick={() => setActiveTab("insights")} />
          <TabButton active={activeTab === "suggestions"} label="Suggestions" onClick={() => setActiveTab("suggestions")} />
        </div>

        {activeTab !== "saved" ? (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12">
              {activeTab === "alerts" ? (
                <ComingSoonPanel
                  title="Wishlist Alerts"
                  subtitle="Get notified when wishlist items go on sale, drop in price, or become available."
                />
              ) : activeTab === "insights" ? (
                <ComingSoonPanel
                  title="Wishlist Insights"
                  subtitle="See trends, movement, and value changes for the items you’re watching."
                />
              ) : (
                <ComingSoonPanel
                  title="Suggestions"
                  subtitle="Recommended items based on your collection and wishlist—built to help complete sets, themes, and franchises."
                />
              )}
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            <aside className="col-span-12 md:col-span-3 md:sticky md:top-28 self-start">
              {/* filters unchanged */}
              <div className="rounded-2xl border bg-white p-4 shadow-sm max-h-[calc(100vh-8rem)] overflow-y-auto">
                {/* ... keep your filter JSX exactly as-is ... */}
                {/* NOTE: I’m leaving the filter JSX out here to avoid duplicating 500 lines.
                    Move it from your current page.tsx into this exact spot unchanged. */}
                <div className="text-xs text-gray-500">
                  Paste your existing Filters JSX block here (unchanged).
                </div>
              </div>
            </aside>

            <section className="col-span-12 md:col-span-9">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                {loading ? (
                  <p className="text-sm text-gray-500">Loading wishlist…</p>
                ) : loadError ? (
                  <p className="text-sm text-red-600">{loadError}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-gray-500">
                        {visibleCards.length === 0 ? (
                          <>
                            Showing <span className="font-semibold text-gray-700">0</span> items
                          </>
                        ) : (
                          <>
                            Showing{" "}
                            <span className="font-semibold text-gray-700">
                              {rangeStart}-{rangeEnd}
                            </span>{" "}
                            of <span className="font-semibold text-gray-700">{visibleCards.length}</span>
                          </>
                        )}
                        {urlSearch ? (
                          <>
                            {" "}
                            for search <span className="font-semibold">“{urlSearch}”</span>
                          </>
                        ) : null}
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => loadWishlist()}
                          className="rounded-full border bg-white px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
                          disabled={loading}
                        >
                          Refresh
                        </button>
                      </div>
                    </div>

                    {visibleCards.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
                        Your wishlist is empty (or no items match your filters).
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {pagedCards.map((it) => (
                            <div
                              key={it.id}
                              className="group rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden hover:shadow-md transition"
                            >
                              <button
                                type="button"
                                onClick={() => router.push(`/catalog/${it.id}`)}
                                className="w-full text-left"
                              >
                                <div className="aspect-[4/3] bg-[#EEF2F7] flex items-center justify-center">
                                  {it.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="text-xs text-gray-500">No image</span>
                                  )}
                                </div>

                                <div className="p-3">
                                  <p className="text-sm font-semibold leading-tight line-clamp-2">{it.name}</p>
                                  <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">
                                    {it.secondary || "—"}
                                  </p>

                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[10px] text-gray-400">
                                      {it.release_year ? it.release_year : ""}
                                    </span>
                                    <span className="text-[10px] text-gray-400">{it.kind.replace("_", " ")}</span>
                                  </div>
                                </div>
                              </button>

                              <div className="px-3 pb-3">
                                <button
                                  type="button"
                                  onClick={() => removeFromWishlist(it.id)}
                                  className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-[11px] text-gray-500">
                            Page <span className="font-semibold text-gray-700">{safePage}</span> of{" "}
                            <span className="font-semibold text-gray-700">{totalPages}</span>
                          </p>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              disabled={safePage === 1}
                              className="rounded-full border bg-white px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                              disabled={safePage === totalPages}
                              className="rounded-full border bg-white px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
