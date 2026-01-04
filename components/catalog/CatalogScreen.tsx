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
  // If header search exactly matches a franchise name, automatically focus that franchise.
  // This "overrides" the left filters so user doesn't have to clear manually.
  useEffect(() => {
    const q = norm(urlSearch);
    if (!q) return;
    if (!meta.franchises || meta.franchises.length === 0) return;

    // exact match first
    const exact = meta.franchises.find((f) => norm(f.name) === q) ?? null;

    // optional prefix match (only when query is >=4 chars to avoid noise)
    const prefix =
      q.length >= 4 ? meta.franchises.find((f) => norm(f.name).startsWith(q)) ?? null : null;

    const hit = exact ?? prefix;
    if (!hit) return;

    if (franchiseId === hit.id) return;

    // ✅ set focus
    setFranchiseId(hit.id);

    // ✅ override the left-side selection that blocks results + sidebar
    setCategoryId("");
    setSubcategoryId("");

    // Optional: do NOT clear years, etc. Those can remain as user intent filters.
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

  // -------------------- Pagination --------------------
  const ITEMS_PER_PAGE = 25;
  const [page, setPage] = useState<number>(1);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(visibleCards.length / ITEMS_PER_PAGE)), [visibleCards.length]);
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedCards = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return visibleCards.slice(start, start + ITEMS_PER_PAGE);
  }, [visibleCards, safePage]);

  useEffect(() => {
    setPage(1);
  }, [
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

  const rangeStart = visibleCards.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ITEMS_PER_PAGE, visibleCards.length);

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

    const res1 = await supabase
      .from("user_wishlist_items")
      .insert([{ user_id: uid, catalog_item_id: catalogItemId, priority }]);

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

    const visibility =
      String((quickPref as any)?.defaultCollectionVisibility ?? "private") === "public" ? "public" : "private";

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

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Catalog</h1>
          <p className="text-xs text-gray-500">Browse items across all categories. Use the left filters to narrow results.</p>

          {/* Optional: show auto-focus hint */}
          {urlSearch && selectedFranchise ? (
            <p className="mt-1 text-[11px] text-gray-500">
              Search matched franchise: <span className="font-semibold text-gray-700">{selectedFranchise.name}</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
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
            banner.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
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
            visibleCardsCount={visibleCards.length}
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
