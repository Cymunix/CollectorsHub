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
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50"
    >
      {children}
      <span className="text-[10px] text-gray-400">↗</span>
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
  };
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
  const isLegoLike = item.kind === "building_blocks" || item.kind === "minifig";

  // ===== LIST / RECTANGLE LAYOUT (BrickEconomy-ish) =====
  if (layout === "list") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-2xl border bg-white hover:shadow-md transition overflow-hidden"
      >
        <div className="flex items-stretch gap-3 p-3">
          <div className="relative h-24 w-24 rounded-xl bg-gray-100 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-400">
                No image
              </div>
            )}

            {/* compact actions on image */}
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <IconButton
                compact
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
                  compact
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
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{item.name}</p>
                <p className="mt-0.5 text-[12px] text-gray-500 line-clamp-1">{item.secondary || "—"}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SmallLinkPill title="Search on eBay" href={links.ebay}>
                    eBay
                  </SmallLinkPill>
                  {isLegoLike ? (
                    <SmallLinkPill title="Search on BrickLink" href={links.bricklink}>
                      BrickLink
                    </SmallLinkPill>
                  ) : null}
                  <SmallLinkPill title="Search the web" href={links.google}>
                    Web
                  </SmallLinkPill>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[10px] text-gray-400">{item.release_year ? item.release_year : ""}</div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {item.kind === "minifig" ? "minifig" : item.kind.replace("_", " ")}
                </div>

                <button
                  type="button"
                  title={quickLabel(quickAddDefault)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onQuickAdd(item.id, quickAddDefault);
                  }}
                  className="mt-2 inline-flex items-center justify-center rounded-full border border-[#E5E9F2] bg-white px-3 py-1.5 text-[11px] font-semibold hover:bg-[#F8FAFC]"
                >
                  {quickIcon(quickAddDefault)} <span className="ml-1">Quick</span>
                </button>
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
          <SmallLinkPill title="Search on eBay" href={links.ebay}>
            eBay
          </SmallLinkPill>
          {isLegoLike ? (
            <SmallLinkPill title="Search on BrickLink" href={links.bricklink}>
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
