"use client";

import React, { useMemo } from "react";
import type { CatalogListRow } from "@/lib/catalog/listQuery";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";

type Props = {
  item: CatalogListRow;

  categoryName?: string;
  subcategoryName?: string;

  isLego: boolean;

  onOpen?: (id: string) => void;

  onToggleWishlist?: (id: string) => void;
  onAddToCollection?: (id: string) => void;

  isAdmin?: boolean;
  onEdit?: (id: string) => void;
};

function moneyCAD(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return null;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);
}

function Badge(p: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700">
      {p.children}
    </span>
  );
}

function display(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function formatPartialDate(y: number | null | undefined, m: number | null | undefined, d: number | null | undefined) {
  if (!y) return null;
  const yy = String(y).padStart(4, "0");
  if (!m) return yy;
  const mm = String(m).padStart(2, "0");
  if (!d) return `${yy}-${mm}`;
  const dd = String(d).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function CatalogListRowView(p: Props) {
  const item = p.item;

  const bb = item.building_blocks ?? null;
  const setNo = bb?.set_number ?? null;
  const pieces = bb?.piece_count ?? null;
  const retailCad = p.isLego ? moneyCAD(bb?.retail_cad ?? null) : null;

  // Production status (clean label)
  const prod = useMemo(() => formatProductionStatus(item.production_status), [item.production_status]);

  // Context line (Category/Subcategory)
  const categoryLine = useMemo(() => {
    if (p.categoryName && p.subcategoryName) return `${p.categoryName} • ${p.subcategoryName}`;
    if (p.categoryName) return p.categoryName;
    if (p.subcategoryName) return p.subcategoryName;
    return "";
  }, [p.categoryName, p.subcategoryName]);

  // Dates (start/end)
  const startDate = useMemo(
    () => formatPartialDate((item as any).release_year ?? null, (item as any).release_month ?? null, (item as any).release_day ?? null),
    [item]
  );
  const endDate = useMemo(
    () => formatPartialDate((item as any).end_year ?? null, (item as any).end_month ?? null, (item as any).end_day ?? null),
    [item]
  );

  // System / Publisher (prefer normalised name fields if present)
  const systemName = useMemo(() => display((item as any).platform_name ?? null), [item]);
  const publisherName = useMemo(
    () => display((item as any).publisher_name ?? (item as any).publisher ?? null),
    [item]
  );

  // IDs
  const upc = useMemo(() => display((item as any).upc ?? null), [item]);
  const epid = useMemo(() => display((item as any).epid_ebay ?? null), [item]);
  const tcg = useMemo(() => display((item as any).tcgplayer_id ?? null), [item]);
  const cardNo = useMemo(() => display((item as any).card_number ?? null), [item]);

  // Year badge (keep)
  const year = (item as any).release_year ?? null;

  const hasIds = !!(upc || epid || tcg || cardNo);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm hover:bg-slate-50">
      <div className="flex items-stretch gap-4">
        {/* IMAGE TILE */}
        <button
          type="button"
          onClick={() => p.onOpen?.(item.id)}
          className="group h-28 w-28 shrink-0 overflow-hidden rounded-xl border bg-slate-100"
          aria-label={`Open ${item.name}`}
        >
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No image</div>
          )}
        </button>

        {/* IDENTITY + META */}
        <div className="min-w-0 flex-1">
          {/* STRICT HIERARCHY: Name / Edition / Category */}
          <button
            type="button"
            onClick={() => p.onOpen?.(item.id)}
            className="block max-w-full truncate text-left text-lg font-semibold text-slate-900 hover:underline"
            title={item.name}
          >
            {item.name}
          </button>

          <div className="mt-0.5 max-w-full truncate text-sm text-slate-700">
            {item.version ? item.version : <span className="text-slate-400"> </span>}
          </div>

          <div className="mt-0.5 max-w-full truncate text-sm text-slate-600">
            {categoryLine ? categoryLine : <span className="text-slate-400"> </span>}
          </div>

          {/* BADGES ROW (structured description info, no free text) */}
          <div className="mt-3 flex flex-wrap gap-2">
            {year ? <Badge>Year: {String(year)}</Badge> : null}

            {/* Games / media meta */}
            {systemName ? <Badge>System: {systemName}</Badge> : null}
            {publisherName ? <Badge>Publisher: {publisherName}</Badge> : null}

            {/* Dates */}
            {startDate ? <Badge>Start: {startDate}</Badge> : null}
            {endDate ? <Badge>End: {endDate}</Badge> : null}

            {/* LEGO meta */}
            {p.isLego && setNo ? <Badge>Set: {String(setNo)}</Badge> : null}
            {p.isLego && pieces ? <Badge>Pieces: {pieces.toLocaleString("en-CA")}</Badge> : null}

            {/* Production */}
            {prod ? <Badge>Production: {prod}</Badge> : null}
          </div>

          {/* ID codes line */}
          {hasIds ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
              {upc ? (
                <span>
                  <span className="text-slate-500">UPC:</span> {upc}
                </span>
              ) : null}
              {epid ? (
                <span>
                  <span className="text-slate-500">ePID:</span> {epid}
                </span>
              ) : null}
              {cardNo ? (
                <span>
                  <span className="text-slate-500">Card #:</span> {cardNo}
                </span>
              ) : null}
              {tcg ? (
                <span>
                  <span className="text-slate-500">TCG:</span> {tcg}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-slate-400"> </div>
          )}
        </div>

        {/* VALUE BOX + ACTIONS */}
        <div className="flex w-[210px] shrink-0 flex-col items-end justify-between gap-3">
          <div className="w-full rounded-xl border bg-white p-3 text-right">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Value</div>

            <div className="mt-1">
              <div className="text-xs text-slate-500">Retail</div>
              <div className="text-base font-semibold text-slate-900">
                {retailCad ?? <span className="text-slate-400">—</span>}
              </div>
            </div>

            <div className="mt-2">
              <div className="text-xs text-slate-500">Avg (default)</div>
              <div className="text-base font-semibold text-slate-900">
                <span className="text-slate-400">—</span>
              </div>
            </div>
          </div>

          <div className="flex w-full justify-end gap-2">
            {p.onToggleWishlist ? (
              <button
                type="button"
                className="rounded-full border px-3 py-1 text-xs font-medium text-slate-800 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  p.onToggleWishlist?.(item.id);
                }}
              >
                Wishlist
              </button>
            ) : null}

            {p.onAddToCollection ? (
              <button
                type="button"
                className="rounded-full border px-3 py-1 text-xs font-medium text-slate-800 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  p.onAddToCollection?.(item.id);
                }}
              >
                + Collection
              </button>
            ) : null}

            {p.isAdmin && p.onEdit ? (
              <button
                type="button"
                className="rounded-full border px-3 py-1 text-xs font-medium text-slate-800 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  p.onEdit?.(item.id);
                }}
              >
                Edit
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
