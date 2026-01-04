"use client";

import React from "react";
import type { CatalogCard, QuickAddDefault } from "@/lib/catalog/types";
import CatalogCardTile from "@/components/catalog/CatalogCard";

type LayoutMode = "card" | "list";

type Props = {
  layoutMode: LayoutMode;
  cards: CatalogCard[];

  onOpenItem: (id: string) => void;

  // These may be sync or async depending on your callers — we normalise below.
  onWishlist: (id: string) => Promise<void> | void;
  onCollection: (id: string) => Promise<void> | void;
  onQuickAdd: (id: string, d: QuickAddDefault) => Promise<void> | void;

  // Optional: if your parent already knows the default, pass it in.
  quickAddDefault?: QuickAddDefault;
};

export default function CatalogGrid({
  layoutMode,
  cards,
  onOpenItem,
  onWishlist,
  onCollection,
  onQuickAdd,
  quickAddDefault,
}: Props) {
  // ✅ must exist for CatalogCardTile; if parent doesn't pass it, we cast a placeholder
  const qaDefault = (quickAddDefault ?? ("default" as unknown as QuickAddDefault)) as QuickAddDefault;

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
                <div className="text-sm text-muted-foreground">{categoryText}</div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="text-sm px-2 py-1 rounded border"
                  onClick={() => {
                    void onWishlist(c.id);
                  }}
                >
                  Wishlist
                </button>
                <button
                  className="text-sm px-2 py-1 rounded border"
                  onClick={() => {
                    void onCollection(c.id);
                  }}
                >
                  + Collection
                </button>
                <button
                  className="text-sm px-2 py-1 rounded border"
                  onClick={() => {
                    void onQuickAdd(c.id, qaDefault);
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

  // CARD MODE: pass the props CatalogCardTile actually expects
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <CatalogCardTile
          key={c.id}
          item={c}
          layout={layoutMode}
          quickAddDefault={qaDefault}
          onOpen={() => onOpenItem(c.id)}
          onAddWishlist={(catalogItemId: string) =>
            Promise.resolve(onWishlist(catalogItemId))
          }
          onAddCollection={(catalogItemId: string) =>
            Promise.resolve(onCollection(catalogItemId))
          }
          onQuickAdd={(catalogItemId: string, pref: QuickAddDefault) =>
            Promise.resolve(onQuickAdd(catalogItemId, pref))
          }
        />
      ))}
    </div>
  );
}
