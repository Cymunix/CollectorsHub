"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CatalogListRow } from "@/lib/catalog/listQuery";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";

type Props = {
  item: CatalogListRow;

  categoryName?: string;
  subcategoryName?: string;

  isLego: boolean;

  onOpen?: (id: string) => void;

  // optional override, otherwise we use item.is_wishlisted
  isWishlisted?: boolean;
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

type BuyLink = { label: string; href: string };

function buildBuyLinks(args: { name: string; upc?: string | null; epid?: string | null }): BuyLink[] {
  const nameQ = encodeURIComponent(args.name);
  const upcQ = args.upc ? encodeURIComponent(args.upc) : null;

  const links: BuyLink[] = [];

  if (args.epid) {
    links.push({ label: "eBay", href: `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(args.epid)}` });
  } else if (upcQ) {
    links.push({ label: "eBay", href: `https://www.ebay.ca/sch/i.html?_nkw=${upcQ}` });
  } else {
    links.push({ label: "eBay", href: `https://www.ebay.ca/sch/i.html?_nkw=${nameQ}` });
  }

  links.push({
    label: "Buy",
    href: upcQ ? `https://www.google.com/search?q=${upcQ}+buy` : `https://www.google.com/search?q=${nameQ}+buy`,
  });

  return links;
}

/** NOTE: list rows are “wide”. We defensively read optional fields that may not exist yet. */
function getGenreText(item: any): string | null {
  // common patterns you might add in listQuery:
  // - genre_names: string[]   (recommended)
  // - genre_name: string
  // - genres: string[] / string
  const arr =
    Array.isArray(item?.genre_names) ? item.genre_names :
    Array.isArray(item?.genres) ? item.genres :
    null;

  if (arr && arr.length) return arr.map((x: any) => String(x ?? "").trim()).filter(Boolean).join(", ");

  const single =
    display(item?.genre_name) ??
    display(item?.genres) ??
    null;

  return single;
}

function getComicSeriesText(item: any): string | null {
  return (
    display(item?.comic_series_name) ??
    display(item?.series_name) ??
    display(item?.comic_series) ??
    null
  );
}

function getCardSetText(item: any): string | null {
  return (
    display(item?.card_set_name) ??
    display(item?.set_name) ??
    null
  );
}

export default function CatalogListRowView(p: Props) {
  const item = p.item;

  const persistedWish = typeof p.isWishlisted === "boolean" ? p.isWishlisted : !!item.is_wishlisted;

  // optimistic UI that still syncs to persisted truth
  const [wish, setWish] = useState<boolean>(persistedWish);

  useEffect(() => {
    setWish(persistedWish);
  }, [persistedWish]);

  const bb = (item as any).building_blocks ?? null;
  const setNo = bb?.set_number ?? null;
  const pieces = bb?.piece_count ?? null;
  const retailCad = p.isLego ? moneyCAD(bb?.retail_cad ?? null) : null;

  const avgDefaultCad: string | null = null;

  const { label: prodLabel } = formatProductionStatus(item.production_status);

  const categoryLine = useMemo(() => {
    if (p.categoryName && p.subcategoryName) return `${p.categoryName} • ${p.subcategoryName}`;
    if (p.categoryName) return p.categoryName;
    if (p.subcategoryName) return p.subcategoryName;
    return "";
  }, [p.categoryName, p.subcategoryName]);

  const categoryKey = useMemo(() => String(p.categoryName ?? "").toLowerCase(), [p.categoryName]);

  const isCard = useMemo(() => {
    const c = categoryKey;
    return c.includes("trading") || c.includes("sports card") || c === "cards" || c.includes("tcg");
  }, [categoryKey]);

  const isComic = useMemo(() => categoryKey.includes("comic"), [categoryKey]);
  const isMovie = useMemo(() => categoryKey.includes("movie"), [categoryKey]);
  const isMusic = useMemo(() => categoryKey.includes("music"), [categoryKey]);

  // gaming is "everything else" that isn’t cards/comics/movie/music (keeps old behaviour)
  const isGamingLike = useMemo(() => !isCard && !isComic && !isMovie && !isMusic, [isCard, isComic, isMovie, isMusic]);

  const releaseYear = item.release_year ?? null;

  // existing fields from listQuery
  const platformName = useMemo(() => display((item as any).platform_name ?? null), [item]);
  const publisherName = useMemo(
    () => display((item as any).publisher_name ?? (item as any).publisher ?? null),
    [item]
  );

  // new “slot 1” value (Genre / Series / Set / Platform)
  const slot1 = useMemo(() => {
    if (isMovie || isMusic) {
      const g = getGenreText(item as any);
      return { label: "Genre", value: g };
    }
    if (isComic) {
      const s = getComicSeriesText(item as any);
      return { label: "Series", value: s };
    }
    if (isCard) {
      const s = getCardSetText(item as any);
      return { label: "Set", value: s };
    }
    // default keeps what you had
    return { label: "Platform", value: platformName };
  }, [item, isMovie, isMusic, isComic, isCard, platformName]);

  const upc = useMemo(() => display((item as any).upc ?? null), [item]);
  const epid = useMemo(() => display((item as any).epid_ebay ?? null), [item]);
  const tcg = useMemo(() => display((item as any).tcgplayer_id ?? null), [item]);
  const cardNo = useMemo(() => display((item as any).card_number ?? null), [item]);

  const hasIds = !!(upc || epid || tcg || cardNo);

  const buyLinks = useMemo(() => buildBuyLinks({ name: item.name, upc, epid }), [item.name, upc, epid]);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm hover:bg-slate-50">
      <div className="flex items-stretch gap-4">
        {/* IMAGE TILE — NO CROPPING */}
        <button
          type="button"
          onClick={() => p.onOpen?.(item.id)}
          className="group h-28 w-28 shrink-0 rounded-xl border bg-white flex items-center justify-center"
          aria-label={`Open ${item.name}`}
        >
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" className="max-h-full max-w-full object-contain p-1" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No image</div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => p.onOpen?.(item.id)}
            className="block max-w-full truncate text-left text-lg font-semibold text-slate-900 hover:underline"
            title={item.name}
          >
            {item.name}
          </button>

          <div className="mt-0.5 max-w-full truncate text-sm text-slate-700">
            {item.version ?? <span className="text-slate-400"> </span>}
          </div>

          <div className="mt-0.5 max-w-full truncate text-sm text-slate-600">
            {categoryLine || <span className="text-slate-400"> </span>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {releaseYear ? <Badge>Release Year: {releaseYear}</Badge> : null}

            {/* Slot1: Genre / Series / Set / Platform */}
            {slot1.value ? <Badge>{slot1.label}: {slot1.value}</Badge> : null}

            {/* Keep publisher for everything (cards included, if you have it) */}
            {publisherName ? <Badge>Publisher: {publisherName}</Badge> : null}

            {/* LEGO specifics */}
            {p.isLego && setNo ? <Badge>Set: {setNo}</Badge> : null}
            {p.isLego && pieces ? <Badge>Pieces: {pieces.toLocaleString("en-CA")}</Badge> : null}

            {/* Keep production */}
            {prodLabel && prodLabel !== "—" ? <Badge>Production: {prodLabel}</Badge> : null}

            {/* If you want to *hide* Platform badge for movie/music/comics/cards even when platform exists:
                already handled by slot1 logic.
                If you want to hide publisher for cards/movies, remove above. */}
          </div>
        </div>

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

          <div className="flex w-full justify-end items-center gap-3">
            {p.onToggleWishlist ? (
              <label
                className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={wish}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => {
                    setWish((v) => !v);
                    p.onToggleWishlist?.(item.id);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                Wishlist
              </label>
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

      <div className="mt-4 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700">
            {hasIds ? (
              <>
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
