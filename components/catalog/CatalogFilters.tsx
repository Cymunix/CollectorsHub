"use client";

import React from "react";
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

export default function CatalogFilters(p: Props) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">Filters</h2>
        <button type="button" onClick={p.clearFilters} className="text-[11px] text-blue-600 hover:underline">
          Clear
        </button>
      </div>

      {p.metaLoading && <p className="text-[11px] text-gray-500">Loading filters…</p>}
      {p.metaError && <p className="text-[11px] text-red-600">{p.metaError}</p>}

      <div className="mt-3 space-y-3 text-xs">
        <div className="space-y-1">
          <label className="font-medium">Category</label>
          <select value={p.categoryId} onChange={(e) => p.setCategoryId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2">
            <option value="">All</option>
            {p.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-medium">Subcategory</label>
          <select
            value={p.subcategoryId}
            onChange={(e) => p.setSubcategoryId(e.target.value)}
            className="w-full rounded-xl border bg-white px-3 py-2"
            disabled={!p.categoryId}
          >
            <option value="">{p.categoryId ? "All" : "Select category first"}</option>
            {p.filteredSubcategories.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-medium">Franchise</label>
          <select value={p.franchiseId} onChange={(e) => p.setFranchiseId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2">
            <option value="">All</option>
            {p.franchises.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="font-medium">Min Year</label>
            <input
              value={p.minYear}
              onChange={(e) => p.setMinYear(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border px-3 py-2"
              placeholder="e.g. 1990"
            />
          </div>
          <div className="space-y-1">
            <label className="font-medium">Max Year</label>
            <input
              value={p.maxYear}
              onChange={(e) => p.setMaxYear(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border px-3 py-2"
              placeholder="e.g. 2025"
            />
          </div>
        </div>

        {p.selectedKind === "building_blocks" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Building Blocks filters</p>

            <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
              <div>
                <p className="font-medium text-xs">Show Minifigs</p>
                <p className="text-[10px] text-gray-500">Display minifigs as catalog cards</p>
              </div>
              <input type="checkbox" checked={p.showMinifigs} onChange={(e) => p.setShowMinifigs(e.target.checked)} />
            </div>

            <div className="space-y-1">
              <label className="font-medium">Theme</label>
              <select
                value={p.bbThemeId}
                onChange={(e) => {
                  p.setBbThemeId(e.target.value);
                  p.setBbSubthemeId("");
                }}
                className="w-full rounded-xl border bg-white px-3 py-2"
                disabled={!p.subcategoryId}
              >
                <option value="">{p.subcategoryId ? "All" : "Select brand first"}</option>
                {p.bbThemeOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
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
                <option value="">{p.bbThemeId ? "All" : "Select theme first"}</option>
                {p.bbSubthemeOptions.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {p.selectedKind === "toy" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Toys filters</p>

            <div className="space-y-1">
              <label className="font-medium">Manufacturer</label>
              <select value={p.toyManufacturerId} onChange={(e) => p.setToyManufacturerId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2">
                <option value="">All</option>
                {p.toyManufacturers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Brand</label>
              <select value={p.toyBrandId} onChange={(e) => p.setToyBrandId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2" disabled={!p.toyManufacturerId}>
                <option value="">{p.toyManufacturerId ? "All" : "Select manufacturer first"}</option>
                {p.toyBrandOptions.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Line</label>
              <select value={p.toyLineId} onChange={(e) => p.setToyLineId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2" disabled={!p.toyBrandId}>
                <option value="">{p.toyBrandId ? "All" : "Select brand first"}</option>
                {p.toyLineOptions.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {p.selectedKind === "gaming" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Gaming filters</p>

            <div className="space-y-1">
              <label className="font-medium">Platform</label>
              <select value={p.gamePlatformId} onChange={(e) => p.setGamePlatformId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2">
                <option value="">All</option>
                {p.gamePlatforms.map((pl) => (
                  <option key={pl.id} value={pl.id}>{pl.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {p.selectedKind === "music" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Music filters</p>

            <div className="space-y-1">
              <label className="font-medium">Artist</label>
              <select value={p.musicArtistId} onChange={(e) => p.setMusicArtistId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2">
                <option value="">All</option>
                {p.musicArtists.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {p.selectedKind === "comic" && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Comics filters</p>

            <div className="space-y-1">
              <label className="font-medium">Publisher</label>
              <select value={p.comicPublisherId} onChange={(e) => p.setComicPublisherId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2">
                <option value="">All</option>
                {p.comicPublishers.map((pub) => (
                  <option key={pub.id} value={pub.id}>{pub.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {(p.selectedKind === "trading_card" || p.selectedKind === "sports_card") && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-[11px] text-gray-500">Cards filters</p>

            <div className="space-y-1">
              <label className="font-medium">Manufacturer</label>
              <select
                value={p.cardManufacturerId}
                onChange={(e) => {
                  p.setCardManufacturerId(e.target.value);
                  p.setCardSetId("");
                }}
                className="w-full rounded-xl border bg-white px-3 py-2"
              >
                <option value="">All</option>
                {p.cardManufacturers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Set</label>
              <select value={p.cardSetId} onChange={(e) => p.setCardSetId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2" disabled={!p.cardManufacturerId}>
                <option value="">{p.cardManufacturerId ? "All" : "Select manufacturer first"}</option>
                {p.cardSetOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Card Type</label>
              <select value={p.cardTypeId} onChange={(e) => p.setCardTypeId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2">
                <option value="">All</option>
                {p.cardTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
