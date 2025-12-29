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
        <div className="grid grid-cols-[96px_1fr_220px] gap-4 p-4">
          {/* Image */}
          <div className="h-28 w-28 rounded-xl bg-[#F8FAFC] border flex items-center justify-center overflow-hidden">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-[11px] text-gray-400">No image</div>
            )}
          </div>

          {/* Main info */}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#0F172A] truncate">
              {item.name}
            </h3>

            <div className="mt-1 text-[11px] text-gray-500">
              Year {item.release_year ?? "—"}
            </div>

            <div className="mt-0.5 text-[11px] text-gray-500">
              Production status —{" "}
              <span className="font-medium">
                {item.production_status ?? "Unknown"}
              </span>
            </div>

            <div className="mt-3">
              <div className="text-[11px] text-gray-500 mb-1">Buy / View at</div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-md border px-2 py-1 text-[11px] font-medium">
                  CollectorsHub
                </span>
                <span className="rounded-md border px-2 py-1 text-[11px]">
                  Amazon ↗
                </span>
                <span className="rounded-md border px-2 py-1 text-[11px]">
                  eBay ↗
                </span>
                <span className="rounded-md border px-2 py-1 text-[11px]">
                  BrickLink ↗
                </span>
                <span className="rounded-md border px-2 py-1 text-[11px]">
                  Web ↗
                </span>
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

            {showExplicitCollection && (
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
            )}

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
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="max-h-full max-w-full object-contain"
          />
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

          {showExplicitCollection && (
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
          )}

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
        <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">
          {item.secondary || "—"}
        </p>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {item.release_year ?? ""}
          </span>
          <span className="text-[10px] text-gray-400">
            {item.kind === "minifig" ? "minifig" : item.kind.replace("_", " ")}
          </span>
        </div>
      </div>
    </button>
  );
}
