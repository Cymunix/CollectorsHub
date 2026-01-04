// components/catalog/CatalogGrid.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";
import CatalogCardTile from "@/components/catalog/CatalogCard";
import CatalogPagination from "@/components/catalog/CatalogPagination";
import { fetchCatalogListRows, type CatalogListRow } from "@/lib/catalog/listQuery";

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

function stop(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export default function CatalogGrid(p: Props) {
  const [view, setView] = useState<LayoutMode>("card");

  // ✅ list-tab data (uses the “new code”)
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listRows, setListRows] = useState<CatalogListRow[]>([]);

  useEffect(() => {
    setView(readView());
  }, []);

  const setAndPersist = (v: LayoutMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  // ✅ When toggled to list, fetch enriched rows for the current page IDs
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (view !== "list") return;

      // Exclude minifigs (they are not in catalog_items)
      const ids = p.pagedCards.filter((c) => c.kind !== "minifig").map((c) => c.id);

      setListLoading(true);
      setListError(null);

      try {
        const rows = await fetchCatalogListRows({ ids });
        if (cancelled) return;
        setListRows(rows);
      } catch (e: any) {
        if (cancelled) return;
        setListError(e?.message || "Failed to load list details.");
        setListRows([]);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [view, p.pagedCards]);

  const header = useMemo(() => {
    return (
      <div className="mb-3 flex items-center justify-between gap-3">
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
              view === "card"
                ? "border-[#0F172A] bg-[#0F172A] text-white"
                : "border-[#E5E9F2] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
            }`}
            title="Card view"
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setAndPersist("list")}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
              view === "list"
                ? "border-[#0F172A] bg-[#0F172A] text-white"
                : "border-[#E5E9F2] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
            }`}
            title="List view"
          >
            List
          </button>
        </div>
      </div>
    );
  }, [p.rangeStart, p.rangeEnd, p.urlSearch, p.visibleCardsCount, view]);

  // Map listRows by id for quick lookup
  const listById = useMemo(() => {
    const m = new Map<string, CatalogListRow>();
    listRows.forEach((r) => m.set(r.id, r));
    return m;
  }, [listRows]);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {p.loading ? (
        <p className="text-sm text-gray-500">Loading catalogue…</p>
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {p.pagedCards.map((it) => (
                  <CatalogCardTile
                    key={`${it.kind}:${it.id}`}
                    item={it}
                    onOpen={() => p.onOpenItem(it)}
                    quickAddDefault={p.quickAddDefault}
                    onAddWishlist={p.onAddWishlist}
                    onAddCollection={p.onAddCollection}
                    onQuickAdd={p.onQuickAdd}
                    layout="card"
                  />
                ))}
              </div>

              <CatalogPagination page={p.page} totalPages={p.totalPages} setPage={p.setPage} />
            </>
          ) : (
            <>
              {listLoading ? <p className="text-xs text-gray-500">Loading list details…</p> : null}
              {listError ? <p className="text-xs text-red-600">{listError}</p> : null}

              <div className="space-y-2">
                {/* Minifigs: keep existing tile (not in catalog_items) */}
                {p.pagedCards
                  .filter((c) => c.kind === "minifig")
                  .map((it) => (
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

                {/* catalog_items: SIMPLE list rows using listQuery */}
                {p.pagedCards
                  .filter((c) => c.kind !== "minifig")
                  .map((card) => {
                    const r = listById.get(card.id);

                    // Line 1: Item Name
                    const name = r?.name ?? card.name;

                    // Line 2: Edition (version)
                    const version = (r?.version ?? (card.version ?? null)) as string | null;

                    // Line 3: Category (use listQuery if present, otherwise fall back to whatever the card already provides)
                    const category =
                      (r as any)?.category_name ??
                      (r as any)?.category ??
                      (card as any)?.category_name ??
                      (card as any)?.category?.name ??
                      (card as any)?.categoryName ??
                      card.secondary ??
                      "—";

                    const imageUrl = (r as any)?.image_url ?? (card.image_url ?? null);

                    return (
                      <div
                        key={`list:${card.id}`}
                        className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition hover:bg-gray-50 cursor-pointer"
                        onClick={() => p.onOpenItem(card)}
                      >
                        {/* Thumb */}
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                        </div>

                        {/* Text: EXACT 3 lines */}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900">{name}</div>
                          {version ? <div className="truncate text-xs text-gray-600">{version}</div> : <div className="text-xs text-gray-600">—</div>}
                          <div className="truncate text-xs text-gray-600">{String(category || "—")}</div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg border px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-white"
                            onClick={(e) => {
                              stop(e);
                              p.onAddWishlist(card.id);
                            }}
                          >
                            Wishlist
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-white"
                            onClick={(e) => {
                              stop(e);
                              p.onAddCollection(card.id);
                            }}
                          >
                            + Collection
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-white"
                            onClick={(e) => {
                              stop(e);
                              p.onQuickAdd(card.id, p.quickAddDefault);
                            }}
                            title="Quick add"
                          >
                            Quick add
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <CatalogPagination page={p.page} totalPages={p.totalPages} setPage={p.setPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}
