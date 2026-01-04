// components/catalog/CatalogGrid.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";
import CatalogCardTile from "@/components/catalog/CatalogCard";
import CatalogPagination from "@/components/catalog/CatalogPagination";
import { fetchCatalogListRows, type CatalogListRow } from "@/lib/catalog/listQuery";
import CatalogListRowView from "@/components/catalog/list/CatalogListRow";

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

  // ✅ list-tab data
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

  // best-effort LEGO detection for the list row component
  function isLegoCard(card: CatalogCard) {
    const kind = String((card as any).kind ?? "");
    if (kind.toLowerCase() === "lego") return true;

    const cat = String((card as any).category_name ?? (card as any).category?.name ?? "");
    const sub = String((card as any).subcategory_name ?? (card as any).subcategory?.name ?? "");
    const blob = `${cat} ${sub}`.toLowerCase();
    return blob.includes("lego");
  }

  function resolveCategoryName(card: CatalogCard, r?: CatalogListRow) {
    return (
      ((r as any)?.category_name as string | null) ??
      ((card as any)?.category_name as string | null) ??
      ((card as any)?.category?.name as string | null) ??
      ((card as any)?.categoryName as string | null) ??
      null
    );
  }

  function resolveSubcategoryName(card: CatalogCard, r?: CatalogListRow) {
    return (
      ((r as any)?.subcategory_name as string | null) ??
      ((card as any)?.subcategory_name as string | null) ??
      ((card as any)?.subcategory?.name as string | null) ??
      ((card as any)?.subcategoryName as string | null) ??
      null
    );
  }

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

                {/* catalog_items: USE the list row component */}
                {p.pagedCards
                  .filter((c) => c.kind !== "minifig")
                  .map((card) => {
                    const r = listById.get(card.id);

                    // Fallback: if listQuery didn’t return yet, render a minimal row from the card
                    const itemForRow: CatalogListRow =
                      r ??
                      ({
                        id: card.id,
                        name: card.name ?? "",
                        version: (card as any).version ?? null,
                        category_id: (card as any).category_id ?? null,
                        subcategory_id: (card as any).subcategory_id ?? null,
                        franchise_id: (card as any).franchise_id ?? null,
                        production_status: (card as any).production_status ?? null,
                        image_url: (card as any).image_url ?? null,
                        building_blocks: null,
                      } as CatalogListRow);

                    const categoryName = resolveCategoryName(card, r) ?? undefined;
                    const subcategoryName = resolveSubcategoryName(card, r) ?? undefined;

                    return (
                      <CatalogListRowView
                        key={`list:${card.id}`}
                        item={itemForRow}
                        categoryName={categoryName}
                        subcategoryName={subcategoryName}
                        isLego={isLegoCard(card)}
                        onOpen={() => p.onOpenItem(card)}
                        onToggleWishlist={(id) => void p.onAddWishlist(id)}
                        onAddToCollection={(id) => void p.onAddCollection(id)}
                        isAdmin={false}
                      />
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
