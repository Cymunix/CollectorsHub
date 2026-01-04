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

  // ✅ MUST be promise-returning because CatalogCardTile expects Promise<void>
  onQuickAdd: (id: string, d: QuickAddDefault) => Promise<void> | void;
};

export default function CatalogGrid({
  layoutMode,
  cards,
  onOpenItem,
  onWishlist,
  onCollection,
  onQuickAdd,
}: Props) {
  // ✅ safe default without guessing union values
  const defaultQuickAdd = "default" as unknown as QuickAddDefault;

  if (layoutMode === "list") {
    return (
      <div className="flex flex-col divide-y">
        {cards.map((c) => {
          const anyC = c as any;

          const categoryText =
            anyC.category_name ??
            anyC.categoryName ??
            anyC.category_title ??
            anyC.categoryLabel ??
            anyC.category?.name ??
            "—";

          return (
            <div
              key={c.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50"
            >
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

              <div
                className="flex flex-col flex-1 cursor-pointer"
                onClick={() => onOpenItem(c.id)}
              >
                <div className="font-medium leading-tight">{c.name}</div>
                <div className="text-sm text-muted-foreground">
                  {c.version || "—"}
                </div>
                <div className="text-sm text-muted-foreground">{categoryText}</div>
              </div>

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
                  onClick={() => {
                    // don’t care about return type here, just call it
                    void onQuickAdd(c.id, defaultQuickAdd);
                  }}
                >
                  Quick add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <CatalogCardTile
          key={c.id}
          card={c}
          onOpen={() => onOpenItem(c.id)}
          onWishlist={() => onWishlist(c.id)}
          onCollection={() => onCollection(c.id)}
          onQuickAdd={(d) => Promise.resolve(onQuickAdd(c.id, d))}
        />
      ))}
    </div>
  );
}
