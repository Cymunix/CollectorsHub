// components/catalog/list/CatalogListRow.tsx
"use client";

import React, { useMemo } from "react";
import type { CatalogListRow } from "@/lib/catalog/listQuery";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";
import { buildExternalLinksForListRow } from "@/lib/catalog/externalLinks";

type Props = {
  item: CatalogListRow;
  // You already have category/subcategory maps in your screen; pass them in.
  categoryName?: string;
  subcategoryName?: string;

  // If you have a kind detector, use that; otherwise pass isLego from the parent
  isLego: boolean;

  // Optional: hook row click
  onOpen?: (id: string) => void;

  // Optional actions
  onToggleWishlist?: (id: string) => void;
  onAddToCollection?: (id: string) => void;

  isAdmin?: boolean;
  onEdit?: (id: string) => void;
};

function moneyCAD(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return null;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);
}

export default function CatalogListRowView(p: Props) {
  const { label: statusLabel } = formatProductionStatus(p.item.production_status);

  const links = useMemo(
    () => buildExternalLinksForListRow({ item: p.item, isLego: p.isLego, locale: "en-ca" }),
    [p.item, p.isLego]
  );

  const bb = p.item.building_blocks ?? null;
  const setNo = bb?.set_number ?? null;
  const pieces = bb?.piece_count ?? null;

  // Retail CAD only really matters for LEGO; show when present
  const retailCad = p.isLego ? moneyCAD(bb?.retail_cad ?? null) : null;

  return (
    <div
      className="flex items-stretch gap-3 rounded-xl border bg-white p-3 hover:bg-slate-50 cursor-pointer"
      onClick={() => p.onOpen?.(p.item.id)}
    >
      {/* Thumb */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-slate-100">
        {p.item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.item.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
            No image
          </div>
        )}
      </div>

      {/* Identity block */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{p.item.name}</div>

        {p.item.version ? (
          <div className="truncate text-xs text-slate-600">{p.item.version}</div>
        ) : null}

        <div className="truncate text-xs text-slate-600">
          {p.categoryName ? <span className="font-medium">{p.categoryName}</span> : null}
          {p.subcategoryName ? <span> • {p.subcategoryName}</span> : null}
        </div>

        {/* LEGO-specific facts */}
        {p.isLego && (setNo || pieces || retailCad) ? (
          <div className="truncate text-xs text-slate-600">
            {setNo ? <span className="font-medium">{setNo}</span> : null}
            {pieces ? <span>{setNo ? " • " : ""}Pieces: {pieces.toLocaleString("en-CA")}</span> : null}
            {retailCad ? <span>{(setNo || pieces) ? " • " : ""}Retail: {retailCad}</span> : null}
          </div>
        ) : null}

        {/* Status */}
        <div className="truncate text-xs text-slate-600">
          <span className="text-slate-500">Status:</span> {statusLabel}
        </div>
      </div>

      {/* Right: links + quick actions */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        {/* Outbound links */}
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="text-slate-600 hover:text-slate-900 hover:underline"
              onClick={(e) => e.stopPropagation()}
              title={`Search on ${l.label}`}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {p.onToggleWishlist ? (
            <button
              className="rounded-lg border px-2 py-1 text-xs hover:bg-white"
              onClick={(e) => { e.stopPropagation(); p.onToggleWishlist?.(p.item.id); }}
            >
              Wishlist
            </button>
          ) : null}

          {p.onAddToCollection ? (
            <button
              className="rounded-lg border px-2 py-1 text-xs hover:bg-white"
              onClick={(e) => { e.stopPropagation(); p.onAddToCollection?.(p.item.id); }}
            >
              + Collection
            </button>
          ) : null}

          {p.isAdmin && p.onEdit ? (
            <button
              className="rounded-lg border px-2 py-1 text-xs hover:bg-white"
              onClick={(e) => { e.stopPropagation(); p.onEdit?.(p.item.id); }}
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
