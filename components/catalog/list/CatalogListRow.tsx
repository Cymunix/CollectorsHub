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

function joinDot(parts: Array<string | null | undefined>) {
  return parts.filter((p) => !!p && String(p).trim().length).join(" • ");
}

export default function CatalogListRowView(p: Props) {
  const bb = p.item.building_blocks ?? null;
  const setNo = bb?.set_number ?? null;
  const pieces = bb?.piece_count ?? null;

  const retailCad = p.isLego ? moneyCAD(bb?.retail_cad ?? null) : null;

  const { label: statusLabel } = formatProductionStatus(p.item.production_status);

  const links = useMemo(
    () => buildExternalLinksForListRow({ item: p.item, isLego: p.isLego, locale: "en-ca" }),
    [p.item, p.isLego]
  );

  const contextLine = useMemo(() => {
    // Keep this intentionally short; it’s the “Theme/Subtheme” line equivalent.
    return joinDot([
      p.categoryName ?? null,
      p.subcategoryName ?? null,
      // if you later add franchise_name/platform_name to the row, you can include it here:
      (p.item as any).franchise_name ?? null,
      (p.item as any).platform_name ?? null,
    ]);
  }, [p.categoryName, p.subcategoryName, p.item]);

  const facts = useMemo(() => {
    const rows: Array<{ k: string; v: string }> = [];

    const year = (p.item as any).release_year ?? null;
    if (year) rows.push({ k: "Year", v: String(year) });

    if (p.isLego && setNo) rows.push({ k: "Set", v: String(setNo) });
    if (p.isLego && pieces) rows.push({ k: "Pieces", v: pieces.toLocaleString("en-CA") });

    if (statusLabel) rows.push({ k: "Availability", v: statusLabel });

    return rows;
  }, [p.item, p.isLego, setNo, pieces, statusLabel]);

  return (
    <div className="rounded-xl border bg-white p-3 hover:bg-slate-50">
      <div className="flex items-stretch gap-4">
        {/* Image (bigger, like the reference) */}
        <button
          type="button"
          onClick={() => p.onOpen?.(p.item.id)}
          className="group h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-slate-100"
          aria-label={`Open ${p.item.name}`}
        >
          {p.item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.item.image_url}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
              No image
            </div>
          )}
        </button>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <button
            type="button"
            onClick={() => p.onOpen?.(p.item.id)}
            className="block max-w-full truncate text-left text-base font-semibold text-slate-900 hover:underline"
            title={p.item.name}
          >
            {p.item.name}
          </button>

          {/* Edition / version */}
          {p.item.version ? (
            <div className="mt-0.5 truncate text-sm text-slate-700">{p.item.version}</div>
          ) : (
            <div className="mt-0.5 text-sm text-slate-400"> </div>
          )}

          {/* Context line */}
          {contextLine ? (
            <div className="mt-0.5 truncate text-xs text-slate-600">{contextLine}</div>
          ) : (
            <div className="mt-0.5 text-xs text-slate-400"> </div>
          )}

          {/* Facts row (compact, like Orthanc’s metadata lines) */}
          {facts.length ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
              {facts.map((f) => (
                <div key={f.k} className="flex items-baseline gap-1">
                  <span className="text-slate-500">{f.k}:</span>
                  <span className="font-medium text-slate-900">{f.v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-400"> </div>
          )}

          {/* LEGO value block (this is the "Retail / Value" style block starter) */}
          {p.isLego ? (
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <div className="text-slate-600">
                <span className="text-slate-500">Retail:</span>{" "}
                <span className="font-semibold text-slate-900">{retailCad ?? "—"}</span>
              </div>

              {/* Placeholder for your “Avg (Complete / 7)” once your pricing engine feeds it */}
              <div className="text-slate-600">
                <span className="text-slate-500">Avg:</span>{" "}
                <span className="font-semibold text-slate-900">—</span>
                <span className="ml-1 text-slate-500">(default condition)</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right column: links + actions (kept, but visually secondary) */}
        <div className="flex shrink-0 flex-col items-end justify-between gap-3">
          {/* Outbound links */}
          <div className="flex max-w-[260px] flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs">
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
