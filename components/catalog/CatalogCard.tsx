"use client";

import React from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";

type LayoutMode = "grid" | "list";

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="h-8 w-8 rounded-full border border-white/40 bg-white/90 hover:bg-white shadow-sm flex items-center justify-center"
    >
      <span className="text-sm leading-none">{children}</span>
    </button>
  );
}

function LinkPill({
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
      title={title}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      onClick={(e) => e.stopPropagation()}
      className="rounded-md border px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
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
    chListings: `/catalog/${item.id}?tab=listings`,
    amazon: `https://www.amazon.ca/s?k=${enc}`,
    ebay: `https://www.ebay.ca/sch/i.html?_nkw=${enc}`,
    bricklink: `https://www.bricklink.com/v2/search.page?q=${enc}`,
    web: `https://www.google.com/search?q=${enc}`,
  };
}

export default function CatalogCard({
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
  layout?: LayoutMode;
}) {
  const showExplicitCollection = quickAddDefault !== "collection";

  const anyItem = item as any; // ✅ allows optional fields without breaking types
  const productionStatus: string =
    (typeof anyItem.production_status === "string" && anyItem.production_status.trim()) ||
    (typeof anyItem.availability === "string" && anyItem.availability.trim()) ||
    "Unknown";

  const links = buildSearchLinks(item);
  const isLegoLike = item.kind === "building_blocks" || item.kind === "minifig";

  // =========================
  // LIST / RECTANGLE LAYOUT
  // =========================
  if (layout === "list") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-2xl border bg-white hover:shadow-md transition overflow-hidden"
      >
        <div className="grid grid-cols-[128px_1fr_220px] gap-6 p-4">
          {/* Image */}
          <div className="h-28 w-28 rounded-xl bg-[#F8FAFC] border flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-[11px] text-gray-400">No image</div>
            )}
          </div>

          {/* Main info */}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#0F172A] truncate">{item.name}</h3>

            <div className="mt-1 text-[11px] text-gray-500">{item.secondary || "—"}</div>

            <div className="mt-2 text-[11px] text-gray-500">
              Year <span className="font-medium text-gray-700">{item.release_year ?? "—"}</span>
            </div>

            <div className="mt-0.5 text-[11px] text-gray-500">
              Production status — <span className="font-medium text-gray-700">{productionStatus}</span>
            </div>

            <div className="mt-3">
              <div className="text-[11px] text-gray-500 mb-1">Buy / View at</div>
              <div className="flex flex-wrap gap-1.5">
                <LinkPill title="View CollectorsHub listings" href={links.chListings} external={false}>
                  CH Listings
                </LinkPill>
                <LinkPill title="Search Amazon" href={links.amazon}>
                  Amazon
                </LinkPill>
                <LinkPill title="Search eBay" href={links.ebay}>
                  eBay
                </LinkPill>
                {isLegoLike ? (
                  <LinkPill title="Search BrickLink" href={links.bricklink}>
                    BrickLink
                  </LinkPill>
                ) : null}
                <LinkPill title="Search the web" href={links.web}>
                  Web
                </LinkPill>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-start justify-end gap-2 pt-1">
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
      </button>
    );
  }

  // =========================
  // GRID / TILE LAYOUT
  // =========================
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left rounded-2xl border bg-white hover:shadow-md transition overflow-hidden"
    >
      <div className="relative aspect-square bg-[#F8FAFC] flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-[11px] text-gray-400">No image</div>
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

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{item.release_year ?? ""}</span>
          <span className="text-[10px] text-gray-400">
            {item.kind === "minifig" ? "minifig" : item.kind.replace("_", " ")}
          </span>
        </div>
      </div>
    </button>
  );
}

