"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";
import CatalogCardTile from "@/components/catalog/CatalogCard";
import CatalogPagination from "@/components/catalog/CatalogPagination";

type LayoutMode = "card" | "list";

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

const VIEW_KEY = "collectorshub_catalog_view_v1";

function readView(): LayoutMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}

export default function CatalogGrid(p: Props) {
  const [view, setView] = useState<LayoutMode>("card");

  useEffect(() => {
    setView(readView());
  }, []);

  const setAndPersist = (v: LayoutMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const header = useMemo(() => {
    return (
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAndPersist("card")}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
              view === "card" ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F8FAFC]"
            }`}
            title="Card view"
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setAndPersist("list")}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
              view === "list" ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F8FAFC]"
            }`}
            title="List view"
          >
            List
          </button>
        </div>
      </div>
    );
  }, [p.rangeStart, p.rangeEnd, p.urlSearch, p.visibleCardsCount, view]);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {p.loading ? (
        <p className="text-sm text-gray-500">Loading catalog…</p>
      ) : p.loadError ? (
        <p className="text-sm text-red-600">{p.loadError}</p>
      ) : (
        <>
          {header}

          {p.visibleCardsCount === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
              No items match your filters.
            </div>
          ) : view === "card" ? (
            <>
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
                    layout="card"   // ✅ NOT "grid"
                  />
                ))}
              </div>

              <CatalogPagination page={p.page} totalPages={p.totalPages} setPage={p.setPage} />
            </>
          ) : (
            <>
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

              <CatalogPagination page={p.page} totalPages={p.totalPages} setPage={p.setPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}
