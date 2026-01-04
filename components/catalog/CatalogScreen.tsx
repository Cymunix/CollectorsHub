// components/catalog/CatalogScreen.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddItemModal from "@/components/catalog/AddItemModal";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/lib/useUserProfile";

import { useCatalogMeta } from "@/hooks/catalog/useCatalogMeta";
import { useCatalogCards } from "@/hooks/catalog/useCatalogCards";
import { useQuickAddPreference } from "@/hooks/catalog/useQuickAddPreference";

import type { CatalogCard, ItemKind, QuickAddDefault } from "@/lib/catalog/types";
import { detectKindFromCategoryName } from "@/lib/catalog/utils";

import CatalogFilters from "@/components/catalog/CatalogFilters";
import CatalogGrid from "@/components/catalog/CatalogGrid";

import RightContextPanel from "@/components/catalog/right/RightContextPanel";

function isDuplicateError(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("duplicate") || m.includes("unique") || m.includes("already exists");
}

function buildDefaultConditionJson(tier10: number) {
  return {
    v: 1,
    item_type: "generic",
    mode: "tier10",
    data: { tier10, for_parts: false },
  };
}

function norm(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/* =========================
   Sorting
   ========================= */

type SortMode =
  | "relevance"
  | "newest"
  | "oldest"
  | "az"
  | "za"
  | "recently_added"
  | "price_high"
  | "price_low";

function normaliseName(s: string) {
  return String(s ?? "").toLowerCase().trim();
}

function safeYear(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeTimeMs(v: any): number | null {
  if (!v) return null;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

function safeNumber(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tier-10 quality pricing reader (we'll sort using tier10=7).
 * Supports multiple payload shapes.
 */
function getPriceCadForTier10(it: CatalogCard, tier10: number): number | null {
  const anyIt = it as any;

  // 1) Flat field: price_tier10_7_cad
  const flat = safeNumber(anyIt[`price_tier10_${tier10}_cad`]);
  if (flat !== null) return flat;

  // 2) Map: price_tier10_cad: { "7": 12.34 } or { 7: 12.34 }
  const m1 = anyIt.price_tier10_cad;
  if (m1 && typeof m1 === "object") {
    const v = safeNumber(m1[tier10] ?? m1[String(tier10)]);
    if (v !== null) return v;
  }

  // 3) Map: pricing_tier10: { "7": 12.34 }
  const m2 = anyIt.pricing_tier10;
  if (m2 && typeof m2 === "object") {
    const v = safeNumber(m2[tier10] ?? m2[String(tier10)]);
    if (v !== null) return v;
  }

  // 4) Fallbacks (not tiered, but better than nothing)
  const p =
    safeNumber(anyIt.price_cad) ??
    safeNumber(anyIt.market_price_cad) ??
    safeNumber(anyIt.estimated_price_cad) ??
    safeNumber(anyIt.latest_sale_price_cad);

  return p ?? null;
}

function sortCatalogCards(items: CatalogCard[], mode: SortMode): CatalogCard[] {
  const copy = [...items];

  // Keep backend/hook order as-is
  if (mode === "relevance") return copy;

  if (mode === "newest") {
    return copy.sort((a, b) => {
      const ay = safeYear(a.release_year);
      const by = safeYear(b.release_year);
      if (ay === null && by === null) return normaliseName(a.name).localeCompare(normaliseName(b.name));
      if (ay === null) return 1;
      if (by === null) return -1;
      if (by !== ay) return by - ay;
      return normaliseName(a.name).localeCompare(normaliseName(b.name));
    });
  }

  if (mode === "oldest") {
    return copy.sort((a, b) => {
      const ay = safeYear(a.release_year);
      const by = safeYear(b.release_year);
      if (ay === null && by === null) return normaliseName(a.name).localeCompare(normaliseName(b.name));
      if (ay === null) return 1;
      if (by === null) return -1;
      if (ay !== by) return ay - by;
      return normaliseName(a.name).localeCompare(normaliseName(b.name));
    });
  }

  if (mode === "az") {
    return copy.sort((a, b) => normaliseName(a.name).localeCompare(normaliseName(b.name)));
  }

  if (mode === "za") {
    return copy.sort((a, b) => normaliseName(b.name).localeCompare(normaliseName(a.name)));
  }

  if (mode === "recently_added") {
    return copy.sort((a: any, b: any) => {
      const at = safeTimeMs(a.created_at);
      const bt = safeTimeMs(b.created_at);
      if (at === null && bt === null) return normaliseName(a.name).localeCompare(normaliseName(b.name));
      if (at === null) return 1;
      if (bt === null) return -1;
      if (bt !== at) return bt - at;
      return normaliseName(a.name).localeCompare(normaliseName(b.name));
    });
  }

  const DEFAULT_TIER10_FOR_PRICE = 7;

  if (mode === "price_high") {
    return copy.sort((a, b) => {
      const ap = getPriceCadForTier10(a, DEFAULT_TIER10_FOR_PRICE);
      const bp = getPriceCadForTier10(b, DEFAULT_TIER10_FOR_PRICE);

      if (ap === null && bp === null) return normaliseName(a.name).localeCompare(normaliseName(b.name));
      if (ap === null) return 1;
      if (bp === null) return -1;

      if (bp !== ap) return bp - ap; // high -> low
      return normaliseName(a.name).localeCompare(normaliseName(b.name));
    });
  }

  if (mode === "price_low") {
    return copy.sort((a, b) => {
      const ap = getPriceCadForTier10(a, DEFAULT_TIER10_FOR_PRICE);
      const bp = getPriceCadForTier10(b, DEFAULT_TIER10_FOR_PRICE);

      if (ap === null && bp === null) return normaliseName(a.name).localeCompare(normaliseName(b.name));
      if (ap === null) return 1;
      if (bp === null) return -1;

      if (ap !== bp) return ap - bp; // low -> high
      return normaliseName(a.name).localeCompare(normaliseName(b.name));
    });
  }

  return copy;
}

export default function CatalogScreen() {
  const up = useUserProfile() as any;

  // ✅ Support multiple hook shapes without breaking:
  // - { user, loading }
  // - { profile, loading }
  // - { userProfile, loading }
  const profileOrUser = up?.profile ?? up?.userProfile ?? up?.user_profile ?? up?.user ?? null;
  const profileLoading = Boolean(up?.loading ?? up?.isLoading ?? up?.profileLoading ?? false);

  const roleRaw = String(profileOrUser?.role ?? profileOrUser?.roleRaw ?? "").trim();
  const role = roleRaw.toLowerCase();

  const isAdmin = role === "admin";
  const isStoreOrPawn = role === "store" || role === "pawn" || role.includes("pawn");

  const router = useRouter();
  const sp = useSearchParams();

  // ✅ Support BOTH "search" AND "q"
  const urlSearch = (sp.get("search") || sp.get("q") || "").trim();

  // ✅ URL-driven context filters coming from item page clicks
  const urlFranchise = (sp.get("franchise") || "").trim();
  const urlSet = (sp.get("set") || "").trim();

  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Meta + cards
  const meta = useCatalogMeta();
  const cardsState = useCatalogCards({
    categories: meta.categories,
    subcategories: meta.subcategories,
    franchises: meta.franchises,
  });

  const quickPref = useQuickAddPreference();

  // -------------------- Filters --------------------
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [franchiseId, setFranchiseId] = useState("");

  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");

  const [showMinifigs, setShowMinifigs] = useState(true);

  // Dynamic filters
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

  // -------------------- Sorting --------------------
  // Default: searching -> relevance, otherwise newest.
  const [sortMode, setSortMode] = useState<SortMode>(() => (urlSearch ? "relevance" : "newest"));

  const selectedCategory = useMemo(
    () => meta.categories.find((c) => c.id === categoryId) ?? null,
    [meta.categories, categoryId]
  );

  const selectedSubcategory = useMemo(
    () => meta.subcategories.find((s) => s.id === subcategoryId) ?? null,
    [meta.subcategories, subcategoryId]
  );

  const selectedFranchise = useMemo(
    () => meta.franchises.find((f) => f.id === franchiseId) ?? null,
    [meta.franchises, franchiseId]
  );

  const selectedKind = useMemo<Exclude<ItemKind, "minifig"> | null>(() => {
    if (!selectedCategory) return null;
    return detectKindFromCategoryName(selectedCategory.name);
  }, [selectedCategory]);

  const filteredSubcategories = useMemo(
    () => meta.subcategories.filter((s) => !categoryId || s.category_id === categoryId),
    [meta.subcategories, categoryId]
  );

  const bbThemeOptions = useMemo(
    () => meta.bbThemes.filter((t) => !subcategoryId || t.subcategory_id === subcategoryId),
    [meta.bbThemes, subcategoryId]
  );

  const bbSubthemeOptions = useMemo(
    () => meta.bbSubthemes.filter((st) => !bbThemeId || st.theme_id === bbThemeId),
    [meta.bbSubthemes, bbThemeId]
  );

  const cardSetOptions = useMemo(
    () => meta.cardSets.filter((s) => !cardManufacturerId || s.manufacturer_id === cardManufacturerId),
    [meta.cardSets, cardManufacturerId]
  );

  const toyBrandOptions = useMemo(
    () => meta.toyBrands.filter((b) => !toyManufacturerId || b.manufacturer_id === toyManufacturerId),
    [meta.toyBrands, toyManufacturerId]
  );

  const toyLineOptions = useMemo(
    () => meta.toyLines.filter((l) => !toyBrandId || l.brand_id === toyBrandId),
    [meta.toyLines, toyBrandId]
  );

  // -------------------- URL Context -> Local Filter State --------------------
  useEffect(() => {
    if (urlFranchise) setFranchiseId(urlFranchise);
    if (urlSet) setCardSetId(urlSet);
  }, [urlFranchise, urlSet]);

  // -------------------- Header search intent -> focus --------------------
  useEffect(() => {
    const q = norm(urlSearch);
    if (!q) return;
    if (!meta.franchises || meta.franchises.length === 0) return;

    const exact = meta.franchises.find((f) => norm(f.name) === q) ?? null;
    const prefix = q.length >= 4 ? meta.franchises.find((f) => norm(f.name).startsWith(q)) ?? null : null;

    const hit = exact ?? prefix;
    if (!hit) return;

    if (franchiseId === hit.id) return;

    setFranchiseId(hit.id);
    setCategoryId("");
    setSubcategoryId("");
  }, [urlSearch, meta.franchises, franchiseId]);

  // -------------------- URL helpers --------------------
  const removeUrlKeys = (keys: string[]) => {
    const next = new URLSearchParams(sp.toString());
    keys.forEach((k) => next.delete(k));
    const qs = next.toString();
    router.push(qs ? `/catalog?${qs}` : "/catalog");
  };

  const clearFilters = () => {
    setCategoryId("");
    setSubcategoryId("");
    setFranchiseId("");

    setMinYear("");
    setMaxYear("");

    setShowMinifigs(true);

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

    removeUrlKeys(["franchise", "set"]);
  };

  const clearSearch = () => {
    removeUrlKeys(["search", "q"]);
  };

  // Reset dynamic filters on category change
  useEffect(() => {
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

    setShowMinifigs(true);
  }, [categoryId]);

  useEffect(() => {
    setBbThemeId("");
    setBbSubthemeId("");
  }, [subcategoryId]);

  useEffect(() => {
    setToyBrandId("");
    setToyLineId("");
  }, [toyManufacturerId]);

  useEffect(() => {
    setToyLineId("");
  }, [toyBrandId]);

  useEffect(() => {
    setCardSetId("");
  }, [cardManufacturerId]);

  // -------------------- Apply filters + header search --------------------
  const visibleCards = useMemo(() => {
    const q = urlSearch.toLowerCase();
    const minY = minYear.trim() ? Number(minYear.trim()) : null;
    const maxY = maxYear.trim() ? Number(maxYear.trim()) : null;

    return cardsState.cards.filter((it) => {
      if (it.kind === "minifig") {
        if (selectedKind !== "building_blocks") return false;
        if (!showMinifigs) return false;
      }

      if (categoryId && it.category_id !== categoryId) return false;
      if (subcategoryId && it.subcategory_id !== subcategoryId) return false;

      if (franchiseId && it.franchise_id !== franchiseId) return false;

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

      // Apply cardSetId globally if it exists
      if (cardSetId && (it as any).card_set_id !== cardSetId) return false;

      // Card-only extras still apply when in card kinds
      if (selectedKind === "trading_card" || selectedKind === "sports_card") {
        if (cardManufacturerId && it.card_manufacturer_id !== cardManufacturerId) return false;
        if (cardTypeId && it.card_type_id !== cardTypeId) return false;
      }

      if (q) {
        const hay = [
          it.name,
          it.secondary,
          String(it.release_year ?? ""),
          it.version ?? "",
          it.kind === "minifig" ? "minifig" : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    cardsState.cards,
    urlSearch,
    categoryId,
    subcategoryId,
    franchiseId,
    minYear,
    maxYear,
    selectedKind,
    showMinifigs,
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

  // -------------------- Sort (before pagination) --------------------
  const sortedCards = useMemo(() => sortCatalogCards(visibleCards, sortMode), [visibleCards, sortMode]);

  // -------------------- Pagination --------------------
  const ITEMS_PER_PAGE = 25;
  const [page, setPage] = useState<number>(1);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedCards.length / ITEMS_PER_PAGE)), [sortedCards.length]);
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedCards = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return sortedCards.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedCards, safePage]);

  useEffect(() => {
    setPage(1);
  }, [
    sortMode,
    urlSearch,
    categoryId,
    subcategoryId,
    franchiseId,
    minYear,
    maxYear,
    showMinifigs,
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

  const rangeStart = sortedCards.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ITEMS_PER_PAGE, sortedCards.length);

  // -------------------- Navigation --------------------
  const openItem = (it: CatalogCard) => {
    if (it.kind === "minifig") {
      router.push(`/catalog/${it.id}?kind=minifig`);
      return;
    }
    router.push(`/catalog/${it.id}`);
  };

  // -------------------- Quick Add helpers --------------------
  const ensureUserId = async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    const uid = data.user?.id ?? null;
    if (!uid) setAuthOpen(true);
    return uid;
  };

  const addToWishlist = async (catalogItemId: string) => {
    setBanner(null);
    const uid = await ensureUserId();
    if (!uid) return;

    const priority = (quickPref as any)?.defaultWishlistPriority ?? "medium";

    const res1 = await supabase.from("user_wishlist_items").insert([{ user_id: uid, catalog_item_id: catalogItemId, priority }]);

    if (res1.error) {
      const msg1 = res1.error.message || "Failed to add to wishlist.";
      const m = msg1.toLowerCase();
      const maybeMissingCol =
        m.includes("column") && (m.includes("priority") || m.includes("does not exist") || m.includes("unknown"));

      if (maybeMissingCol) {
        const res2 = await supabase.from("user_wishlist_items").insert([{ user_id: uid, catalog_item_id: catalogItemId }]);

        if (res2.error) {
          const msg2 = res2.error.message || "Failed to add to wishlist.";
          if (isDuplicateError(msg2)) {
            setBanner({ type: "ok", msg: "Already in your wishlist." });
            return;
          }
          setBanner({ type: "err", msg: msg2 });
          return;
        }

        setBanner({ type: "ok", msg: "Added to wishlist." });
        return;
      }

      if (isDuplicateError(msg1)) {
        setBanner({ type: "ok", msg: "Already in your wishlist." });
        return;
      }
      setBanner({ type: "err", msg: msg1 });
      return;
    }

    setBanner({ type: "ok", msg: "Added to wishlist." });
  };

  const addToCollection = async (catalogItemId: string) => {
    setBanner(null);
    const uid = await ensureUserId();
    if (!uid) return;

    const score100 = Number((quickPref as any)?.defaultConditionScore100);
    const safeScore100 = Number.isFinite(score100) ? Math.max(0, Math.min(100, Math.round(score100))) : 80;

    const tier10 = Number((quickPref as any)?.defaultConditionTier10);
    const safeTier10 = Number.isFinite(tier10) ? Math.max(1, Math.min(10, Math.round(tier10))) : 8;

    const qty = Number((quickPref as any)?.defaultQuantity);
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.min(999, Math.round(qty))) : 1;

    const visibility = String((quickPref as any)?.defaultCollectionVisibility ?? "private") === "public" ? "public" : "private";

    const condition_json = buildDefaultConditionJson(safeTier10);

    const res1 = await supabase.from("user_collection_items").insert([
      {
        user_id: uid,
        catalog_item_id: catalogItemId,
        quantity: safeQty,
        condition_score: safeScore100,
        condition_json,
        visibility,
      },
    ]);

    if (res1.error) {
      const msg1 = res1.error.message || "Failed to add to collection.";
      const m = msg1.toLowerCase();

      const maybeMissingCol =
        m.includes("column") &&
        (m.includes("condition_score") ||
          m.includes("condition_json") ||
          m.includes("quantity") ||
          m.includes("visibility") ||
          m.includes("does not exist") ||
          m.includes("unknown"));

      if (maybeMissingCol) {
        const res2 = await supabase.from("user_collection_items").insert([{ user_id: uid, catalog_item_id: catalogItemId }]);

        if (res2.error) {
          const msg2 = res2.error.message || "Failed to add to collection.";
          if (isDuplicateError(msg2)) {
            setBanner({ type: "ok", msg: "Already in your collection." });
            return;
          }
          setBanner({ type: "err", msg: msg2 });
          return;
        }

        setBanner({ type: "ok", msg: "Added to your collection." });
        return;
      }

      if (isDuplicateError(msg1)) {
        setBanner({ type: "ok", msg: "Already in your collection." });
        return;
      }
      setBanner({ type: "err", msg: msg1 });
      return;
    }

    setBanner({ type: "ok", msg: "Added to your collection." });
  };

  const quickAdd = async (catalogItemId: string, pref: QuickAddDefault) => {
    const mode = pref || "collection";
    if (mode === "wishlist") return addToWishlist(catalogItemId);
    if (mode === "collection") return addToCollection(catalogItemId);
    if (mode === "both") {
      await addToWishlist(catalogItemId);
      await addToCollection(catalogItemId);
      return;
    }
    return addToCollection(catalogItemId);
  };

  return (
    <div className="px-6 py-6">
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Top header row: keep Sort here so it lines up with Suggest Item */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Catalog</h1>
          <p className="text-xs text-gray-500">Browse items across all categories. Use the left filters to narrow results.</p>

          {urlSearch && selectedFranchise ? (
            <p className="mt-1 text-[11px] text-gray-500">
              Search matched franchise: <span className="font-semibold text-gray-700">{selectedFranchise.name}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Sort (aligned with buttons) */}
          <label className="flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs text-gray-600">
            <span className="whitespace-nowrap">Sort</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-transparent text-xs text-gray-800 outline-none"
              title="Sort results"
            >
              <option value="relevance">Relevance</option>
              <option value="newest">Newest (year)</option>
              <option value="oldest">Oldest (year)</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="recently_added">Recently added</option>
              <option value="price_high">Price (High → Low) — tier 7</option>
              <option value="price_low">Price (Low → High) — tier 7</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => router.push("/catalog/suggest")}
            className="rounded-full border bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            Suggest Item
          </button>

          <button
            type="button"
            onClick={() => router.push("/catalog/my-suggestions")}
            className="rounded-full border bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            My Suggestions
          </button>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => router.push("/catalog/suggestions")}
              className="rounded-full border bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
              disabled={profileLoading}
              title={profileLoading ? "Loading profile…" : "Admin review queue"}
            >
              Suggestions
            </button>
          ) : null}

          {isStoreOrPawn ? (
            <button
              type="button"
              onClick={() => alert("Coming soon: add non-collectible store items")}
              className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              disabled={profileLoading}
              title={profileLoading ? "Loading profile…" : "Placeholder"}
            >
              Add non-collectible (soon)
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => cardsState.reload()}
            className="rounded-full border bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
            disabled={cardsState.loading}
          >
            Refresh
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-full bg-green-500 px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
              disabled={profileLoading}
            >
              + Add Item
            </button>
          )}
        </div>
      </div>

      {banner ? (
        <div
          className={`mb-4 rounded-2xl border p-4 text-sm ${
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {banner.msg}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT FILTERS */}
        <aside className="col-span-12 md:col-span-3 md:sticky md:top-28 self-start">
          <CatalogFilters
            metaLoading={meta.loading}
            metaError={meta.error}
            categories={meta.categories}
            subcategories={meta.subcategories}
            filteredSubcategories={filteredSubcategories}
            franchises={meta.franchises}
            selectedKind={selectedKind}
            // base values
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            subcategoryId={subcategoryId}
            setSubcategoryId={setSubcategoryId}
            franchiseId={franchiseId}
            setFranchiseId={setFranchiseId}
            minYear={minYear}
            setMinYear={setMinYear}
            maxYear={maxYear}
            setMaxYear={setMaxYear}
            // building blocks
            showMinifigs={showMinifigs}
            setShowMinifigs={setShowMinifigs}
            bbThemeId={bbThemeId}
            setBbThemeId={setBbThemeId}
            bbSubthemeId={bbSubthemeId}
            setBbSubthemeId={setBbSubthemeId}
            bbThemeOptions={bbThemeOptions}
            bbSubthemeOptions={bbSubthemeOptions}
            // toys
            toyManufacturers={meta.toyManufacturers}
            toyBrands={meta.toyBrands}
            toyLines={meta.toyLines}
            toyManufacturerId={toyManufacturerId}
            setToyManufacturerId={setToyManufacturerId}
            toyBrandId={toyBrandId}
            setToyBrandId={setToyBrandId}
            toyLineId={toyLineId}
            setToyLineId={setToyLineId}
            toyBrandOptions={toyBrandOptions}
            toyLineOptions={toyLineOptions}
            // gaming
            gamePlatforms={meta.gamePlatforms}
            gamePlatformId={gamePlatformId}
            setGamePlatformId={setGamePlatformId}
            // music
            musicArtists={meta.musicArtists}
            musicArtistId={musicArtistId}
            setMusicArtistId={setMusicArtistId}
            // comics
            comicPublishers={meta.comicPublishers}
            comicPublisherId={comicPublisherId}
            setComicPublisherId={setComicPublisherId}
            // cards
            cardManufacturers={meta.cardManufacturers}
            cardSets={meta.cardSets}
            cardTypes={meta.cardTypes}
            cardManufacturerId={cardManufacturerId}
            setCardManufacturerId={setCardManufacturerId}
            cardSetId={cardSetId}
            setCardSetId={setCardSetId}
            cardTypeId={cardTypeId}
            setCardTypeId={setCardTypeId}
            cardSetOptions={cardSetOptions}
            // clear
            clearFilters={() => {
              clearFilters();
              clearSearch();
            }}
          />
        </aside>

        {/* MAIN */}
        <section className="col-span-12 md:col-span-6">
          <CatalogGrid
            loading={cardsState.loading}
            loadError={cardsState.error}
            urlSearch={urlSearch}
            visibleCardsCount={sortedCards.length}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            pagedCards={pagedCards}
            onOpenItem={openItem}
            // pagination
            page={safePage}
            totalPages={totalPages}
            setPage={setPage}
            // quick add
            quickAddDefault={quickPref.value}
            onAddWishlist={addToWishlist}
            onAddCollection={addToCollection}
            onQuickAdd={quickAdd}
          />
        </section>

        {/* RIGHT CONTEXT */}
        <aside className="col-span-12 md:col-span-3 md:sticky md:top-28 self-start">
          <RightContextPanel
            franchiseId={franchiseId}
            categoryId={categoryId}
            subcategoryId={subcategoryId}
            toyBrandId={toyBrandId}
            franchises={meta.franchises as any}
            toyBrands={meta.toyBrands as any}
            categories={meta.categories as any}
            subcategories={meta.subcategories as any}
            setCategoryId={setCategoryId}
            setSubcategoryId={setSubcategoryId}
            isAdmin={isAdmin}
          />
        </aside>
      </div>

      <AddItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          meta.reload();
          setTimeout(() => cardsState.reload(), 200);
        }}
      />
    </div>
  );
}
