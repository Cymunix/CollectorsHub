"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";
import CatalogCardTile from "@/components/catalog/CatalogCard";
import CatalogPagination from "@/components/catalog/CatalogPagination";

type ViewMode = "tiles" | "list";
const VIEW_KEY = "ch_catalog_view_v1";

type Props = {
  loading: boolean;
  loadError: string | null;

  urlSearch: string;
  visibleCardsCount: number;
  rangeStart: number;
  rangeEnd: number;

  pagedCards: CatalogCard[];
  onOpenItem: (it: CatalogCard) => void;

  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;

  quickAddDefault: QuickAddDefault;
  onAddWishlist: (catalogItemId: string) => Promise<void>;
  onAddCollection: (catalogItemId: string) => Promise<void>;
  onQuickAdd: (catalogItemId: string, pref: QuickAddDefault) => Promise<void>;
};

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const btn = (v: ViewMode, label: string) => {
    const active = value === v;
    return (
      <button
        type="button"
        onClick={() => onChange(v)}
        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition ${
          active
            ? "bg-[#0F172A] text-white border-[#0F172A]"
            : "bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F8FAFC]"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {btn("tiles", "Tiles")}
      {btn("list", "List")}
    </div>
  );
}

export default function CatalogGrid(p: Props) {
  const [view, setView] = useState<ViewMode>("tiles");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEW_KEY);
      if (raw === "tiles" || raw === "list") setView(raw);
    } catch {}
  }, []);

  const setAndPersist = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY: string, v);
    } catch {}
  };

  const layout = view === "list" ? "list" : "grid";

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {p.loading ? (
        <p className="text-sm text-gray-500">Loading catalog…</p>
      ) : p.loadError ? (
        <p className="text-sm text-red-600">{p.loadError}</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3 gap-3">
            <p className="text-xs text-gray-500">
              {p.visibleCardsCount === 0 ? (
                <>
                  Showing <span className="font-semibold text-gray-700">0</span> items
                </>
              ) : (
                <>
                  Showing{" "}
                  <span className="font-semibold text-gray-700">
                    {p.rangeStart}-{p.rangeEnd}
                  </span>{" "}
                  of <span className="font-semibold text-gray-700">{p.visibleCardsCount}</span>
                </>
              )}
              {p.urlSearch ? (
                <>
                  {" "}
                  for search <span className="font-semibold">“{p.urlSearch}”</span>
                </>
              ) : null}
            </p>

            <ViewToggle value={view} onChange={setAndPersist} />
          </div>

          {p.visibleCardsCount === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
              No items match your filters.
            </div>
          ) : (
            <>
              {view === "tiles" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {p.pagedCards.map((it) => (
                    <CatalogCardTile
                      key={`${it.kind}:${it.id}`}
                      item={it}
                      onOpen={() => p.onOpenItem(it)}
                      quickAddDefault={p.quickAddDefault}
                      onAddWishlist={p.onAddWishlist}
                      onAddCollection={p.onAddCollection}
                      onQuickAdd={p.onQuickAdd}
                      layout="grid"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {p.pagedCards.map((it) => (
                    <CatalogCardTile
                      key={`${it.kind}:${it.id}`}
                      item={it}
                      onOpen={() => p.onOpenItem(it)}
                      quickAddDefault={p.quickAddDefault}
                      onAddWishlist={p.onAddWishlist}
                      onAddCollection={p.onAddCollection}
                      onQuickAdd={p.onQuickAdd}
                      layout="list"
                    />
                  ))}
                </div>
              )}

              <CatalogPagination page={p.page} totalPages={p.totalPages} setPage={p.setPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}
