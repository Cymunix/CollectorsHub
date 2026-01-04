"use client";

import React from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";
import CatalogCardTile from "@/components/catalog/CatalogCard";

type LayoutMode = "card" | "list";

type Props = {
  layoutMode: LayoutMode;
  cards: CatalogCard[];

  onOpenItem: (id: string) => void;
  onWishlist: (id: string) => void;
  onCollection: (id: string) => void;
  onQuickAdd: (id: string, d: QuickAddDefault) => void;
};

export default function CatalogGrid({
  layoutMode,
  cards,
  onOpenItem,
  onWishlist,
  onCollection,
  onQuickAdd,
}: Props) {
  if (layoutMode === "list") {
    return (
      <div className="flex flex-col divide-y">
        {cards.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50"
          >
            {/* Thumbnail */}
            <div
              className="h-12 w-12 shrink-0 cursor-pointer"
              onClick={() => onOpenItem(c.id)}
            >
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name}
                  className="h-full w-full rounded object-cover"
                />
              ) : (
                <div className="h-full w-full rounded bg-muted" />
              )}
            </div>

            {/* Text */}
            <div
              className="flex flex-col flex-1 cursor-pointer"
              onClick={() => onOpenItem(c.id)}
            >
              <div className="font-medium leading-tight">{c.name}</div>
              <div className="text-sm text-muted-foreground">
                {c.version || "—"}
              </div>
              <div className="text-sm text-muted-foreground">
                {c.category?.name || "—"}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="text-sm px-2 py-1 rounded border"
                onClick={() => onWishlist(c.id)}
              >
                Wishlist
              </button>
              <button
                className="text-sm px-2 py-1 rounded border"
                onClick={() => onCollection(c.id)}
              >
                + Collection
              </button>
              <button
                className="text-sm px-2 py-1 rounded border"
                onClick={() => onQuickAdd(c.id, "complete")}
              >
                Quick add
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // CARD MODE (UNCHANGED)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <CatalogCardTile
          key={c.id}
          card={c}
          onOpen={() => onOpenItem(c.id)}
          onWishlist={() => onWishlist(c.id)}
          onCollection={() => onCollection(c.id)}
          onQuickAdd={(d) => onQuickAdd(c.id, d)}
        />
      ))}
    </div>
  );
}
