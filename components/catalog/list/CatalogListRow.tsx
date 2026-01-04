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

function formatPartialDate(
  y: number | null | undefined,
  m: number | null | undefined,
  d: number | null | undefined
) {
  if (!y) return null;
  const yy = String(y).padStart(4, "0");
  if (!m) return yy;
  const mm = String(m).padStart(2, "0");
  if (!d) return `${yy}-${mm}`;
  const dd = String(d).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

type BuyLink = { label: string; href: string };

function buildBuyLinks(args: {
  name: string;
  upc?: string | null;
  epid?: string | null;
  tcgplayerId?: string | null;
  isLego: boolean;
  setNumber?: string | number | null;
}): BuyLink[] {
  const nameQ = encodeURIComponent(args.name);
  const upcQ = args.upc ? encodeURIComponent(args.upc) : null;

  const links: BuyLink[] = [];

  // eBay: prefer ePID if available, else UPC/name search.
  if (args.epid) {
    links.push({
      label: "eBay",
      href: `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(args.epid)}`,
    });
  } else if (upcQ) {
    links.push({ label: "eBay", href: `https://www.ebay.ca/sch/i.html?_nkw=${upcQ}` });
  } else {
    links.push({ label: "eBay", href: `https://www.ebay.ca/sch/i.html?_nkw=${nameQ}` });
  }

  // TCGPlayer: if we have an ID, link to product search (safe); otherwise omit.
  if (args.tcgplayerId) {
    links.push({
      label: "TCGPlayer",
      href: `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(args.tcgplayerId)}`,
    });
  }

  // LEGO: Bricklink set number search when we have it
  if (args.isLego && args.setNumber) {
    links.push({
      label: "BrickLink",
      href: `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${encodeURIComponent(
        String(args.setNumber)
      )}`,
    });
  }

  // Google as a catch-all “Buy” jump
  if (upcQ) {
    links.push({ label: "Buy", href: `https://www.google.com/search?q=${upcQ}+buy` });
  } else {
    links.push({ label: "Buy", href: `https://www.google.com/search?q=${nameQ}+buy` });
  }

  return links;
}

export default function CatalogListRowView(p: Props) {
  const item = p.item;

  const bb = item.building_blocks ?? null;
  const setNo = bb?.set_number ?? null;
  const pieces = bb?.piece_count ?? null;
  const retailCad = p.isLego ? moneyCAD(bb?.retail_cad ?? null) : null;

  // TODO: wire real avg default when list rows include pricing summary
  const avgDefaultCad: string | null = null;

  const { label: prodLabel } = formatProductionStatus(item.production_status);

  const categoryLine = useMemo(() => {
    if (p.categoryName && p.subcategoryName) return `${p.categoryName} • ${p.subcategoryName}`;
    if (p.categoryName) return p.categoryName;
    if (p.subcategoryName) return p.subcategoryName;
    return "";
  }, [p.categoryName, p.subcategoryName]);

  const year = item.release_year ?? null;

  const startDate = useMemo(
    () => formatPartialDate(item.release_year, item.release_month, item.release_day),
    [item.release_year, item.release_month, item.release_day]
  );

  const endDate = useMemo(
    () => formatPartialDate(item.end_year, item.end_month, item.end_day),
    [item.end_year, item.end_month, item.end_day]
  );

  // Names best-effort
  const systemName = useMemo(() => display(item.platform_name ?? null), [item.platform_name]);
  const publisherName = useMemo(
    () => display(item.publisher_name ?? item.publisher ?? null),
    [item.publisher_name, item.publisher]
  );

  // IDs
  const upc = useMemo(() => display(item.upc ?? null), [item.upc]);
  const epid = useMemo(() => display(item.epid_ebay ?? null), [item.epid_ebay]);
  const tcg = useMemo(() => display(item.tcgplayer_id ?? null), [item.tcgplayer_id]);
  const cardNo = useMemo(() => display(item.card_number ?? null), [item.card_number]);

  const buyLinks = useMemo(
    () =>
      buildBuyLinks({
        name: item.name,
        upc,
        epid,
        tcgplayerId: tcg,
        isLego: p.isLego,
        setNumber: setNo,
      }),
    [item.name, upc, epid, tcg, p.isLego, setNo]
  );

  const setOrPlatform = p.isLego && setNo ? `Set: ${String(setNo)}` : systemName ? `Platform: ${systemName}` : null;

  const hasKeyLine = !!(setOrPlatform || publisherName || upc || epid || tcg || cardNo);

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
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
              No image
            </div>
          )}
        </button>

        {/* MAIN CONTENT */}
        <div className="min-w-0 flex-1">
          {/* TITLE */}
          <button
            type="button"
            onClick={() => p.onOpen?.(item.id)}
            className="block max-w-full truncate text-left text-lg font-semibold text-slate-900 hover:underline"
            title={item.name}
          >
            {item.name}
          </button>

          {/* VERSION + CATEGORY */}
          <div className="mt-0.5 max-w-full truncate text-sm text-slate-700">
            {item.version ? item.version : <span className="text-slate-400"> </span>}
          </div>

          <div className="mt-0.5 max-w-full truncate text-sm text-slate-600">
            {categoryLine ? categoryLine : <span className="text-slate-400"> </span>}
          </div>

          {/* BADGES */}
          <div className="mt-3 flex flex-wrap gap-2">
            {year ? <Badge>Year: {String(year)}</Badge> : null}

            {systemName ? <Badge>Platform: {systemName}</Badge> : null}
            {publisherName ? <Badge>Publisher: {publisherName}</Badge> : null}

            {startDate ? <Badge>Start: {startDate}</Badge> : null}
            {endDate ? <Badge>End: {endDate}</Badge> : null}

            {p.isLego && setNo ? <Badge>Set: {String(setNo)}</Badge> : null}
            {p.isLego && pieces ? <Badge>Pieces: {pieces.toLocaleString("en-CA")}</Badge> : null}

            {prodLabel && prodLabel !== "—" ? <Badge>Production: {prodLabel}</Badge> : null}
          </div>
        </div>

        {/* VALUE + ACTIONS */}
        <div className="flex w-[240px] shrink-0 flex-col items-end justify-between gap-3">
          <div className="w-full text-right">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Value</div>

            <div className="mt-1">
              <div className="text-xs text-slate-500">Avg (default)</div>
              <div className="text-lg font-semibold leading-tight text-slate-900">
                {avgDefaultCad ?? <span className="text-slate-400">—</span>}
              </div>
            </div>

            <div className="mt-2">
              <div className="text-xs text-slate-500">Retail</div>
              <div className="text-sm font-medium text-slate-700">
                {retailCad ?? <span className="text-slate-400">—</span>}
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

      {/* BOTTOM RAIL: KEY META + BUY BOX */}
      <div className="mt-4 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Key identifiers */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700">
            {hasKeyLine ? (
              <>
                {setOrPlatform ? (
                  <span>
                    <span className="text-slate-500">{p.isLego && setNo ? "Set:" : "Platform:"}</span>{" "}
                    {p.isLego && setNo ? String(setNo) : systemName}
                  </span>
                ) : null}

                {publisherName ? (
                  <span>
                    <span className="text-slate-500">Publisher:</span> {publisherName}
                  </span>
                ) : null}

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
              </>
            ) : (
              <span className="text-slate-400"> </span>
            )}
          </div>

          {/* Buy links */}
          <div className="flex flex-wrap justify-end gap-2">
            {buyLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                onClick={(e) => e.stopPropagation()}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
