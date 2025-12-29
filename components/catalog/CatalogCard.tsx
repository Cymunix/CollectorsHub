"use client";

import React from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";

type LayoutMode = "tiles" | "list";

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

function LinkPill({
  label,
  href,
  onClick,
}: {
  label: string;
  href: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-[#E5E9F2] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
    >
      {label}
      <span className="text-[10px] text-[#3B82F6]">↗</span>
    </a>
  );
}

export default function CatalogCardTile({
  item,
  onOpen,
  quickAddDefault,
  onAddWishlist,
  onAddCollection,
  onQuickAdd,
  layout = "tiles",
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

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const chListingsHref = `/catalog/${item.id}?tab=listings`;

  // ===== LIST / RECTANGLE LAYOUT (BrickEconomy-ish) =====
  if (layout === "list") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-2xl border bg-white hover:shadow-md transition overflow-hidden"
      >
        {/* NOTE: bigger image column + bigger gap fixes cramped text */}
        <div className="grid grid-cols-[128px_1fr_220px] items-start gap-6 p-4">
          {/* Left: image */}
          <div className="relative h-28 w-28 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-[#E5E9F2] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-400">
                No image
              </div>
            )}
          </div>

          {/* Middle: details */}
          <div className="min-w-0 pl-1">
            <div className="text-base font-semibold text-[#0F172A] truncate">
              {item.name}
            </div>

            <div className="mt-1 text-[12px] text-[#64748B] line-clamp-1">
              {item.secondary || "—"}
            </div>

            <div className="mt-2 space-y-1 text-[11px] text-[#64748B]">
              <div>
                <span className="text-[#94A3B8]">Year</span>{" "}
                <span className="font-medium text-[#0F172A]">
                  {item.release_year ?? "—"}
                </span>
              </div>

              {/* IMPORTANT: do NOT read item.production_status (not in type yet). */}
              <div>
                <span className="text-[#94A3B8]">Production status</span>{" "}
                <span className="font-medium text-[#0F172A]">Unknown</span>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[11px] text-[#94A3B8] mb-1">Buy / View at</div>
              <div className="flex flex-wrap gap-2">
                {/* CH Listings should go to your internal listings tab */}
                <a
                  href={chListingsHref}
                  onClick={(e) => {
                    stop(e);
                    window.location.href = chListingsHref;
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[#E5E9F2] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  CH Listings
                </a>

                {/* External links (only show if they exist on the item object) */}
                {(item as any)?.amazon_url ? (
                  <LinkPill
                    label="Amazon"
                    href={(item as any).amazon_url}
                    onClick={stop}
                  />
                ) : null}

                {(item as any)?.ebay_url ? (
                  <LinkPill
                    label="eBay"
                    href={(item as any).ebay_url}
                    onClick={stop}
                  />
                ) : null}

                {(item as any)?.bricklink_url ? (
                  <LinkPill
                    label="BrickLink"
                    href={(item as any).bricklink_url}
                    onClick={stop}
                  />
                ) : null}

                {(item as any)?.web_url ? (
                  <LinkPill
                    label="Web"
                    href={(item as any).web_url}
                    onClick={stop}
                  />
                ) : null}
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-start justify-end gap-2">
            <button
              type="button"
              title="Add to wishlist"
              onClick={(e) => {
                stop(e);
                onAddWishlist(item.id);
              }}
              className="h-9 w-9 rounded-full border border-[#E5E9F2] bg-white hover:bg-[#F8FAFC] shadow-sm flex items-center justify-center"
            >
              ♡
            </button>

            {showExplicitCollection ? (
              <button
                type="button"
                title="Add to collection"
                onClick={(e) => {
                  stop(e);
                  onAddCollection(item.id);
                }}
                className="h-9 w-9 rounded-full border border-[#E5E9F2] bg-white hover:bg-[#F8FAFC] shadow-sm flex items-center justify-center"
              >
                ＋
              </button>
            ) : null}

            <button
              type="button"
              title={quickLabel(quickAddDefault)}
              onClick={(e) => {
                stop(e);
                onQuickAdd(item.id, quickAddDefault);
              }}
              className="h-9 rounded-full px-3 border border-[#0F172A] bg-[#0F172A] text-white hover:bg-black shadow-sm flex items-center justify-center text-[11px] font-semibold"
            >
              + Quick
            </button>
          </div>
        </div>

        {/* Bottom right small kind label (optional) */}
        <div className="px-4 pb-3">
          <div className="text-[10px] text-[#94A3B8] text-right">
            {item.kind === "minifig" ? "minifig" : item.kind.replace("_", " ")}
          </div>
        </div>
      </button>
    );
  }

  // ===== TILE LAYOUT (existing) =====
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
              stop(e);
              onAddWishlist(item.id);
            }}
          >
            ♡
          </IconButton>

          {showExplicitCollection ? (
            <IconButton
              title="Add to collection"
              onClick={(e) => {
                stop(e);
                onAddCollection(item.id);
              }}
            >
              ＋
            </IconButton>
          ) : null}

          <IconButton
            title={quickLabel(quickAddDefault)}
            onClick={(e) => {
              stop(e);
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
          <span className="text-[10px] text-gray-400">{item.release_year ? item.release_year : ""}</span>
          <span className="text-[10px] text-gray-400">
            {item.kind === "minifig" ? "minifig" : item.kind.replace("_", " ")}
          </span>
        </div>
      </div>
    </button>
  );
}
