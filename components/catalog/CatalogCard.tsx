"use client";

import React from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";

export type LayoutMode = "card" | "list";

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

export default function CatalogCardTile({
  item,
  onOpen,
  quickAddDefault,
  onAddWishlist,
  onAddCollection,
  onQuickAdd,
  layout = "card",
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

  // ===== LIST / RECTANGLE LAYOUT =====
  if (layout === "list") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-2xl border bg-white hover:shadow-md transition overflow-hidden"
      >
        <div className="grid grid-cols-[120px_1fr] gap-5 p-4">
          {/* Image */}
          <div className="h-28 w-28 rounded-xl bg-gray-100 overflow-hidden shrink-0 border flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-[11px] text-gray-400">No image</div>
            )}
          </div>

          {/* Content */}
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#0F172A] truncate">{item.name}</div>
                <div className="mt-1 text-[11px] text-[#64748B] line-clamp-2">{item.secondary || "—"}</div>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-[#94A3B8]">
                  <span>{typeof item.release_year === "number" ? item.release_year : ""}</span>
                  <span className="h-1 w-1 rounded-full bg-[#CBD5E1]" />
                  <span>{item.kind === "minifig" ? "minifig" : item.kind.replace("_", " ")}</span>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-1.5 shrink-0 pt-1">
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
          </div>
        </div>
      </button>
    );
  }

  // ===== CARD / TILE LAYOUT =====
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
          <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-400">No image</div>
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
          <span className="text-[10px] text-gray-400">
            {typeof item.release_year === "number" ? item.release_year : ""}
          </span>
          <span className="text-[10px] text-gray-400">
            {item.kind === "minifig" ? "minifig" : item.kind.replace("_", " ")}
          </span>
        </div>
      </div>
    </button>
  );
}
