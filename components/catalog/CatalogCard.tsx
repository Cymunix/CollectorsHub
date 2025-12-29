"use client";

import React from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";

function IconButton({
  title,
  onClick,
  children,
  compact = false,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-full border border-white/40 bg-white/90 hover:bg-white shadow-sm flex items-center justify-center ${
        compact ? "h-7 w-7" : "h-8 w-8"
      }`}
    >
      <span className={`leading-none ${compact ? "text-[13px]" : "text-sm"}`}>{children}</span>
    </button>
  );
}

function SmallLinkPill({
  title,
  href,
  children,
  external = true,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      title={title}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
    >
      {children}
      {external ? <span className="text-[10px] text-gray-400">↗</span> : null}
    </a>
  );
}

function quickIcon(pref: QuickAddDefault) {
  if (pref === "wishlist") return "♡";
  if (pref === "collection") return "＋";
  if (pref === "both") return "⇄";
  return "⚡";
}

function quickLabel(pref: QuickAddDefault) {
  if (pref === "wishlist") return "Quick add (Wishlist)";
  if (pref === "collection") return "Quick add (Collection)";
  if (pref === "both") return "Quick add (Both)";
  return "Quick add";
}

function buildSearchLinks(item: CatalogCard) {
  const q = (item.name || "").trim() || "collectible";
  const enc = encodeURIComponent(q);
  return {
    ebay: `https://www.ebay.ca/sch/i.html?_nkw=${enc}`,
    google: `https://www.google.com/search?q=${enc}`,
    bricklink: `https://www.bricklink.com/v2/search.page?q=${enc}`,
    amazon: `https://www.amazon.ca/s?k=${enc}`,
  };
}

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function money(v: any, currency = "CAD") {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export default function CatalogCardTile({
  item,
  onOpen,
  quickAddDefault,
  onAddWishlist,
  onAddCollection,
  onQuickAdd,
  layout = "grid",
}: {
  item: CatalogCard;
  onOpen: () => void;
  quickAddDefault: QuickAddDefault;
  onAddWishlist: (catalogItemId: string) => Promise<void>;
  onAddCollection: (catalogItemId: string) => Promise<void>;
  onQuickAdd: (catalogItemId: string, pref: QuickAddDefault) => Promise<void>;
  layout?: "grid" | "list";
}) {
  const showExplicitCollection = quickAddDefault !== "collection";
  const links = buildSearchLinks(item);

  // Duck-typed optional fields (won’t break if missing)
  const anyItem = item as any;
  const isLegoLike = item.kind === "building_blocks" || item.kind === "minifig";

  const theme = anyItem.theme ?? anyItem.franchise ?? null;
  const subtheme = anyItem.subtheme ?? anyItem.series ?? null;

  const pieces = anyItem.pieces ?? anyItem.piece_count ?? null;
  const minifigs = anyItem.minifigs ?? anyItem.minifig_count ?? null;

  // Production status (your requested label)
  const productionStatus =
    anyItem.production_status ??
    anyItem.availability ??
    (anyItem.retired === true ? "Retired" : anyItem.retired === false ? "Active" : null);

  // Optional price-style fields if you add them later
  const retail = money(anyItem.retail_cad ?? anyItem.msrp_cad ?? null);
  const value = money(anyItem.market_value_cad ?? anyItem.current_value_cad ?? null);
  const growthAbs = money(anyItem.growth_cad ?? null);
  const growthPct =
    typeof anyItem.growth_pct === "number"
      ? `${anyItem.growth_pct >= 0 ? "↑" : "↓"} ${Math.abs(anyItem.growth_pct).toFixed(1)}%`
      : null;

  // CollectorsHub listings link (your requested quick buy link)
  // This goes to the item detail page. If you later add ?tab=listings handling, it can auto-open the listings tab.
  const chListingsHref = `/catalog/${item.id}?tab=listings`;

  // ===== LIST / RECTANGLE LAYOUT (BrickEconomy-ish) =====
  if (layout === "list") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-2xl border bg-white hover:shadow-md transition overflow-hidden"
      >
        <div className="grid grid-cols-[96px_1fr_220px] items-start gap-4 p-3">
          {/* Left: image */}
          <div className="relative h-28 w-28 rounded-xl bg-gray-100 overflow-hidden shrink-0 border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-400">No image</div>
            )}
          </div>

          {/* Middle: details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
             <div className="min-w-0">
                <div className="text-base font-semibold text-[#0F172A] truncate">{item.name}</div>

                <div className="mt-2 space-y-1 text-[12px] text-gray-600">
                  {(theme || subtheme) ? (
                    <div>
                      <span className="text-gray-400">Theme / Subtheme&nbsp;</span>
                      <span className="text-gray-700 font-medium">{safeText(theme)}</span>
                      {subtheme ? <span className="text-gray-700 font-medium"> / {safeText(subtheme)}</span> : null}
                    </div>
                  ) : null}

                  {item.release_year ? (
                    <div>
                      <span className="text-gray-400">Year&nbsp;</span>
                      <span className="text-gray-700 font-medium">{item.release_year}</span>
                    </div>
                  ) : null}

                  {(pieces !== null || minifigs !== null) ? (
                    <div>
                      <span className="text-gray-400">Pieces / Minifigs&nbsp;</span>
                      <span className="text-gray-700 font-medium">
                        {pieces ?? "—"} / {minifigs ?? "—"}
                      </span>
                    </div>
                  ) : null}

                  <div>
                    <span className="text-gray-400">Production status&nbsp;</span>
                    <span className="text-gray-700 font-medium">{safeText(productionStatus)}</span>
                  </div>
                </div>

                {/* Buy row */}
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-gray-500 mb-2">Buy / View at</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SmallLinkPill title="View CollectorsHub listings" href={chListingsHref} external={false}>
                      CollectorsHub
                    </SmallLinkPill>

                    <SmallLinkPill title="Search Amazon" href={links.amazon}>
                      Amazon
                    </SmallLinkPill>

                    <SmallLinkPill title="Search eBay" href={links.ebay}>
                      eBay
                    </SmallLinkPill>

                    {isLegoLike ? (
                      <SmallLinkPill title="Search BrickLink" href={links.bricklink}>
                        BrickLink
                      </SmallLinkPill>
                    ) : null}

                    <SmallLinkPill title="Search the web" href={links.google}>
                      Web
                    </SmallLinkPill>
                  </div>
                </div>
              </div>

              {/* Right: pricing + actions */}
              <div className="shrink-0 w-[210px] text-right">
                {/* Pricing block (only shows if you later supply these fields) */}
                {(retail || value || growthAbs || growthPct) ? (
                  <div className="text-[12px] text-gray-600 space-y-1">
                    {retail ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-gray-400">Retail</span>
                        <span className="font-semibold text-gray-700">{retail}</span>
                      </div>
                    ) : null}
                    {value ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-gray-400">Value</span>
                        <span className="font-semibold text-gray-700">{value}</span>
                      </div>
                    ) : null}
                    {growthAbs ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-gray-400">Growth</span>
                        <span className="font-semibold text-emerald-700">{growthAbs}</span>
                      </div>
                    ) : null}
                    {growthPct ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-gray-400">Annual growth</span>
                        <span className="font-semibold text-gray-700">{growthPct}</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-400">
                    {/* Keep it clean when no pricing data */}
                    {item.kind === "building_blocks" ? "Pricing data not wired yet." : ""}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-3 flex items-center justify-end gap-2">
                  <IconButton
                    title="Add to wishlist"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAddWishlist(item.id);
                    }}
                  >
                    ♡
                  </IconButton>

                  {showExplicitCollection ? (
                    <IconButton
                      title="Add to collection"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAddCollection(item.id);
                      }}
                    >
                      ＋
                    </IconButton>
                  ) : null}

                  <button
                    type="button"
                    title={quickLabel(quickAddDefault)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onQuickAdd(item.id, quickAddDefault);
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-[#0F172A] text-white px-3 py-2 text-[11px] font-semibold hover:bg-black"
                  >
                    {quickIcon(quickAddDefault)} <span className="ml-1">Quick</span>
                  </button>
                </div>

                <div className="mt-2 text-[10px] text-gray-400">
                  {item.kind === "minifig" ? "minifig" : item.kind.replace("_", " ")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  }

  // ===== CURRENT TILE LAYOUT =====
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left rounded-2xl border bg-white hover:shadow-md transition overflow-hidden"
    >
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-400">
            No image
          </div>
        )}

        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <IconButton
            title="Add to wishlist"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddWishlist(item.id);
            }}
          >
            ♡
          </IconButton>

          {showExplicitCollection ? (
            <IconButton
              title="Add to collection"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddCollection(item.id);
              }}
            >
              ＋
            </IconButton>
          ) : null}

          <IconButton
            title={quickLabel(quickAddDefault)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickAdd(item.id, quickAddDefault);
            }}
          >
            {quickIcon(quickAddDefault)}
          </IconButton>
        </div>
      </div>

      <div className="p-3">
        <p className="text-xs font-semibold line-clamp-2">{item.name}</p>
        <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">{item.secondary || "—"}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SmallLinkPill title="Search eBay" href={links.ebay}>
            eBay
          </SmallLinkPill>
          {isLegoLike ? (
            <SmallLinkPill title="Search BrickLink" href={links.bricklink}>
              BrickLink
            </SmallLinkPill>
          ) : null}
          <SmallLinkPill title="Search the web" href={links.google}>
            Web
          </SmallLinkPill>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{item.release_year ? item.release_year : ""}</span>
          <span className="text-[10px] text-gray-400">
            {item.kind === "minifig" ? "minifig" : item.kind.replace("_", " ")}
          </span>
        </div>
      </div>
    </button>
  );
}

