// components/catalog/CatalogFilters.tsx
"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  ItemKind,
} from "@/lib/catalog/types";

type IdName = { id: string; name: string };

type Props = {
  metaLoading: boolean;
  metaError: string | null;

  categories: Category[];
  subcategories: Subcategory[];
  filteredSubcategories: Subcategory[];
  franchises: Franchise[];

  selectedKind: Exclude<ItemKind, "minifig"> | null;

  categoryId: string;
  setCategoryId: (v: string) => void;
  subcategoryId: string;
  setSubcategoryId: (v: string) => void;
  franchiseId: string;
  setFranchiseId: (v: string) => void;

  minYear: string;
  setMinYear: (v: string) => void;
  maxYear: string;
  setMaxYear: (v: string) => void;

  // Building blocks
  showMinifigs: boolean;
  setShowMinifigs: (v: boolean) => void;

  bbThemeId: string;
  setBbThemeId: (v: string) => void;
  bbSubthemeId: string;
  setBbSubthemeId: (v: string) => void;
  bbThemeOptions: BbTheme[];
  bbSubthemeOptions: BbSubtheme[];

  // ✅ NEW: Building Blocks Set filter (optional so build doesn't break until wired)
  bbSetId?: string;
  setBbSetId?: (v: string) => void;
  bbSetOptions?: IdName[];

  // Toys
  toyManufacturers: ToyManufacturer[];
  toyBrands: ToyBrand[];
  toyLines: ToyLine[];
  toyManufacturerId: string;
  setToyManufacturerId: (v: string) => void;
  toyBrandId: string;
  setToyBrandId: (v: string) => void;
  toyLineId: string;
  setToyLineId: (v: string) => void;
  toyBrandOptions: ToyBrand[];
  toyLineOptions: ToyLine[];

  // Gaming
  gamePlatforms: GamePlatform[];
  gamePlatformId: string;
  setGamePlatformId: (v: string) => void;

  // optional mirror state used elsewhere (platform_id)
  platformId?: string;
  setPlatformId?: (v: string) => void;

  // Music
  musicArtists: MusicArtist[];
  musicArtistId: string;
  setMusicArtistId: (v: string) => void;

  // Comics
  comicPublishers: ComicPublisher[];
  comicPublisherId: string;
  setComicPublisherId: (v: string) => void;

  // Cards
  cardManufacturers: CardManufacturer[];
  cardSets: CardSet[];
  cardTypes: CardType[];
  cardManufacturerId: string;
  setCardManufacturerId: (v: string) => void;
  cardSetId: string;
  setCardSetId: (v: string) => void;
  cardTypeId: string;
  setCardTypeId: (v: string) => void;
  cardSetOptions: CardSet[];

  clearFilters: () => void;
};

/* ------------------------------------------------------------------
   Franchise ComboBox: lightweight, no shadcn dependency
   ------------------------------------------------------------------ */
function FranchiseComboBox({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selectedName = useMemo(() => {
    if (!value) return "";
    return options.find((o) => o.id === value)?.name ?? "";
  }, [options, value]);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.name.toLowerCase().includes(query));
  }, [options, q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="space-y-1" ref={wrapRef}>
      <label className="font-medium">Franchise</label>

      <div className="relative">
        <input
          value={open ? q : selectedName}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQ("");
          }}
          placeholder="All"
          disabled={disabled}
          className="w-full rounded-xl border bg-white px-3 py-2"
        />

        {open && !disabled && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-64 overflow-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setQ("");
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
            >
              All
            </button>

            {shown.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-500">
                No matches
              </div>
            ) : (
              shown.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={[
                    "w-full text-left px-3 py-2 text-xs hover:bg-gray-50",
                    o.id === value ? "bg-gray-50" : "",
                  ].join(" ")}
                >
                  {o.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CatalogFilters(p: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const hasBbSetSupport =
    typeof p.bbSetId === "string" &&
    typeof p.setBbSetId === "function" &&
    Array.isArray(p.bbSetOptions);

  /* -----------------------------
     Reset helpers
     ----------------------------- */
  const clearBuildingBlocks = () => {
    p.setShowMinifigs(false);

    if (hasBbSetSupport) p.setBbSetId!("");

    p.setBbThemeId("");
    p.setBbSubthemeId("");
  };

  const clearToys = () => {
    p.setToyManufacturerId("");
    p.setToyBrandId("");
    p.setToyLineId("");
  };

  const clearGaming = () => {
    p.setGamePlatformId("");
    p.setPlatformId?.("");
  };

  const clearMusic = () => {
    p.setMusicArtistId("");
  };

  const clearComics = () => {
    p.setComicPublisherId("");
  };

  const clearCards = () => {
    p.setCardManufacturerId("");
    p.setCardSetId("");
    p.setCardTypeId("");
  };

  const clearKindSpecific = () => {
    clearBuildingBlocks();
    clearToys();
    clearGaming();
    clearMusic();
    clearComics();
    clearCards();
  };

  /* -----------------------------
     Header search reset hook
     If URL has ?search=...&reset=1
     then nuke all left-side filters.
     Then remove reset=1 so it only happens once.
     ----------------------------- */
  const lastResetSigRef = useRef<string>("");

  useEffect(() => {
    const q = (searchParams.get("search") ?? "").trim();
    const reset = searchParams.get("reset") === "1";
    if (!reset || !q) return;

    const sig = `${q}::${searchParams.toString()}`;
    if (lastResetSigRef.current === sig) return;
    lastResetSigRef.current = sig;

    p.clearFilters();
    clearKindSpecific();

    const next = new URLSearchParams(searchParams.toString());
    next.delete("reset");
    router.replace(`/catalog?${next.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  /* -----------------------------
     When kind changes, clear kind-specific filters
     ----------------------------- */
  const prevKindRef = useRef<Props["selectedKind"]>(p.selectedKind);
  useEffect(() => {
    if (prevKindRef.current !== p.selectedKind) {
      clearKindSpecific();
      prevKindRef.current = p.selectedKind;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.selectedKind]);

  /* -----------------------------
     Change handlers with proper cascading resets
     ----------------------------- */
  const onCategoryChange = (nextCategoryId: string) => {
    p.setCategoryId(nextCategoryId);

    // downstream globals
    p.setSubcategoryId("");
    p.setFranchiseId("");

    // downstream kind-specific
    clearKindSpecific();
  };

  const onSubcategoryChange = (nextSubcategoryId: string) => {
    p.setSubcategoryId(nextSubcategoryId);
    p.setFranchiseId(""); // keep global filters coherent
    clearKindSpecific();
  };

  const onFranchiseChange = (nextFranchiseId: string) => {
    p.setFranchiseId(nextFranchiseId);
  };

  const onMinYearChange = (v: string) => {
    const cleaned = v.replace(/\D/g, "").slice(0, 4);
    p.setMinYear(cleaned);
  };

  const onMaxYearChange = (v: string) => {
    const cleaned = v.replace(/\D/g, "").slice(0, 4);
    p.setMaxYear(cleaned);
  };

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">Filters</h2>
        <button
          type="button"
          onClick={p.clearFilters}
          className="text-[11px] text-blue-600 hover:underline"
        >
          Clear
        </button>
      </div>

      {p.metaLoading && (
        <p className="text-[11px] text-gray-500">Loading filters…</p>
      )}
      {p.metaError && <p className="text-[11px] text-red-600">{p.metaError}</p>}

      <div className="mt-3 space-y-3 text-xs">
        {/* -----------------------------
            Global filters
           ----------------------------- */}
        <div className="space-y-1">
          <label className="font-medium">Category</label>
          <select
            value={p.categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full rounded-xl border bg-white px-3 py-2"
          >
            <option value="">All</option>
            {p.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-medium">Subcategory</label>
          <select
            value={p.subcategoryId}
            onChange={(e) => onSubcategoryChange(e.target.value)}
            className="w-full rounded-xl border bg-white px-3 py-2"
            disabled={!p.categoryId}
          >
            <option value="">
              {p.categoryId ? "All" : "Select category first"}
            </option>
            {p.filteredSubcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* ✅ REPLACED: Franchise now type-to-filter dropdown */}
        <FranchiseComboBox
          options={p.franchises.map((f) => ({ id: f.id, name: f.name }))}
          value={p.franchiseId}
          onChange={onFranchiseChange}
          disabled={p.metaLoading || !!p.metaError}
        />

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="font-medium">Min Year</label>
            <input
              value={p.minYear}
              onChange={(e) => onMinYearChange(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border px-3 py-2"
              placeholder="e.g. 1990"
            />
          </div>
          <div className="space-y-1">
            <label className="font-medium">Max Year</label>
            <input
              value={p.maxYear}
              onChange={(e) => onMaxYearChange(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border px-3 py-2"
              placeholder="e.g. 2025"
            />
          </div>
        </div>

        {/* -----------------------------
            Building Blocks
           ----------------------------- */}
        {p.selectedKind === "building_blocks" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">
              Building Blocks filters
            </p>

            {/* ✅ Toggle: Show/Hide minifigs */}
            <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
              <div>
                <p className="font-medium text-xs">Show Minifigs</p>
                <p className="text-[10px] text-gray-500">
                  Include minifigs in results
                </p>
              </div>
              <input
                type="checkbox"
                checked={p.showMinifigs}
                onChange={(e) => p.setShowMinifigs(e.target.checked)}
              />
            </div>

            {/* ✅ Set filter (only renders when wired from CatalogScreen) */}
            {hasBbSetSupport && (
              <div className="space-y-1">
                <label className="font-medium">Set</label>
                <select
                  value={p.bbSetId}
                  onChange={(e) => {
                    const v = e.target.value;
                    p.setBbSetId!(v);

                    // changing set should reset theme hierarchy unless you're sure they're independent
                    p.setBbThemeId("");
                    p.setBbSubthemeId("");
                  }}
                  className="w-full rounded-xl border bg-white px-3 py-2"
                >
                  <option value="">All</option>
                  {p.bbSetOptions!.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-medium">Theme</label>
              <select
                value={p.bbThemeId}
                onChange={(e) => {
                  p.setBbThemeId(e.target.value);
                  p.setBbSubthemeId("");
                }}
                className="w-full rounded-xl border bg-white px-3 py-2"
              >
                <option value="">All</option>
                {p.bbThemeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Subtheme</label>
              <select
                value={p.bbSubthemeId}
                onChange={(e) => p.setBbSubthemeId(e.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-2"
                disabled={!p.bbThemeId}
              >
                <option value="">
                  {p.bbThemeId ? "All" : "Select theme first"}
                </option>
                {p.bbSubthemeOptions.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* -----------------------------
            Toys
           ----------------------------- */}
        {p.selectedKind === "toy" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Toys filters</p>

            <div className="space-y-1">
              <label className="font-medium">Manufacturer</label>
              <select
                value={p.toyManufacturerId}
                onChange={(e) => {
                  const v = e.target.value;
                  p.setToyManufacturerId(v);
                  p.setToyBrandId("");
                  p.setToyLineId("");
                }}
                className="w-full rounded-xl border bg-white px-3 py-2"
              >
                <option value="">All</option>
                {p.toyManufacturers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Brand</label>
              <select
                value={p.toyBrandId}
                onChange={(e) => {
                  const v = e.target.value;
                  p.setToyBrandId(v);
                  p.setToyLineId("");
                }}
                className="w-full rounded-xl border bg-white px-3 py-2"
                disabled={!p.toyManufacturerId}
              >
                <option value="">
                  {p.toyManufacturerId ? "All" : "Select manufacturer first"}
                </option>
                {p.toyBrandOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Line</label>
              <select
                value={p.toyLineId}
                onChange={(e) => p.setToyLineId(e.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-2"
                disabled={!p.toyBrandId}
              >
                <option value="">
                  {p.toyBrandId ? "All" : "Select brand first"}
                </option>
                {p.toyLineOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* -----------------------------
            Gaming
           ----------------------------- */}
        {p.selectedKind === "gaming" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Gaming filters</p>

            <div className="space-y-1">
              <label className="font-medium">Platform</label>
              <select
                value={p.gamePlatformId}
                onChange={(e) => {
                  const v = e.target.value;
                  p.setGamePlatformId(v);
                  p.setPlatformId?.(v);
                }}
                className="w-full rounded-xl border bg-white px-3 py-2"
              >
                <option value="">All</option>
                {p.gamePlatforms.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* -----------------------------
            Music
           ----------------------------- */}
        {p.selectedKind === "music" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Music filters</p>

            <div className="space-y-1">
              <label className="font-medium">Artist</label>
              <select
                value={p.musicArtistId}
                onChange={(e) => p.setMusicArtistId(e.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-2"
              >
                <option value="">All</option>
                {p.musicArtists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* -----------------------------
            Comics
           ----------------------------- */}
        {p.selectedKind === "comic" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Comics filters</p>

            <div className="space-y-1">
              <label className="font-medium">Publisher</label>
              <select
                value={p.comicPublisherId}
                onChange={(e) => p.setComicPublisherId(e.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-2"
              >
                <option value="">All</option>
                {p.comicPublishers.map((pub) => (
                  <option key={pub.id} value={pub.id}>
                    {pub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* -----------------------------
            Cards
           ----------------------------- */}
        {(p.selectedKind === "trading_card" ||
          p.selectedKind === "sports_card") && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Cards filters</p>

            <div className="space-y-1">
              <label className="font-medium">Manufacturer</label>
              <select
                value={p.cardManufacturerId}
                onChange={(e) => {
                  const v = e.target.value;
                  p.setCardManufacturerId(v);
                  p.setCardSetId("");
                }}
                className="w-full rounded-xl border bg-white px-3 py-2"
              >
                <option value="">All</option>
                {p.cardManufacturers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Set</label>
              <select
                value={p.cardSetId}
                onChange={(e) => p.setCardSetId(e.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-2"
                disabled={!p.cardManufacturerId}
              >
                <option value="">
                  {p.cardManufacturerId ? "All" : "Select manufacturer first"}
                </option>
                {p.cardSetOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Card Type</label>
              <select
                value={p.cardTypeId}
                onChange={(e) => p.setCardTypeId(e.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-2"
              >
                <option value="">All</option>
                {p.cardTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
