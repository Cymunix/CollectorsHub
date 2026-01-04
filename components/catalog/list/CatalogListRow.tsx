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

export default function CatalogListRowView(p: Props) {
  const bb = p.item.building_blocks ?? null;
  const setNo = bb?.set_number ?? null;
  const pieces = bb?.piece_count ?? null;
  const retailCad = p.isLego ? moneyCAD(bb?.retail_cad ?? null) : null;

  const { label: statusLabel } = formatProductionStatus(p.item.production_status);

  const categoryLine = useMemo(() => {
    // This is the “Category” line in the spec. Keep it simple.
    // If you want franchise/platform here instead, say so and we’ll swap it.
    if (p.categoryName && p.subcategoryName) return `${p.categoryName} • ${p.subcategoryName}`;
    if (p.categoryName) return p.categoryName;
    if (p.subcategoryName) return p.subcategoryName;
    return "";
  }, [p.categoryName, p.subcategoryName]);

  // Optional if your list row has year/platform names later
  const year = (p.item as any).release_year ?? null;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm hover:bg-slate-50">
      <div className="flex items-stretch gap-4">
        {/* IMAGE TILE */}
        <button
          type="button"
          onClick={() => p.onOpen?.(p.item.id)}
          className="group h-28 w-28 shrink-0 overflow-hidden rounded-xl border bg-slate-100"
          aria-label={`Open ${p.item.name}`}
        >
          {p.item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.item.image_url}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
              No image
            </div>
          )}
        </button>

        {/* IDENTITY + BADGES */}
        <div className="min-w-0 flex-1">
          {/* STRICT HIERARCHY: Name / Edition / Category */}
          <button
            type="button"
            onClick={() => p.onOpen?.(p.item.id)}
            className="block max-w-full truncate text-left text-lg font-semibold text-slate-900 hover:underline"
            title={p.item.name}
          >
            {p.item.name}
          </button>

          <div className="mt-0.5 max-w-full truncate text-sm text-slate-700">
            {p.item.version ? p.item.version : <span className="text-slate-400"> </span>}
          </div>

          <div className="mt-0.5 max-w-full truncate text-sm text-slate-600">
            {categoryLine ? categoryLine : <span className="text-slate-400"> </span>}
          </div>

          {/* BADGES ROW (secondary info only) */}
          <div className="mt-3 flex flex-wrap gap-2">
            {year ? <Badge>Year: {String(year)}</Badge> : null}
            {p.isLego && setNo ? <Badge>Set: {String(setNo)}</Badge> : null}
            {p.isLego && pieces ? <Badge>Pieces: {pieces.toLocaleString("en-CA")}</Badge> : null}
            {statusLabel ? <Badge>Status: {statusLabel}</Badge> : null}
          </div>
        </div>

        {/* VALUE BOX + ACTIONS */}
        <div className="flex w-[210px] shrink-0 flex-col items-end justify-between gap-3">
          {/* Value box (this is the bit you actually care about long term) */}
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
                {/* You told me: show avg based on default condition (e.g., complete / 7).
                    That number is NOT in CatalogListRow yet, so placeholder until wired. */}
                <span className="text-slate-400">—</span>
              </div>
            </div>
          </div>

          {/* Actions (secondary, not dominating) */}
          <div className="flex w-full justify-end gap-2">
            {p.onToggleWishlist ? (
              <button
                type="button"
                className="rounded-full border px-3 py-1 text-xs font-medium text-slate-800 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  p.onToggleWishlist?.(p.item.id);
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
                  p.onAddToCollection?.(p.item.id);
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
                  p.onEdit?.(p.item.id);
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
