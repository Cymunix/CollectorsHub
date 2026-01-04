"use client";

import React, { useMemo } from "react";
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

function normalise(s: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Edition / variant text: prefer item.version, else item.secondary if it isn't just repeating the name. */
function computeEdition(item: CatalogCard): string | null {
  const name = String(item.name ?? "").trim();
  const secondary = String(item.secondary ?? "").trim();
  const version = String((item as any).version ?? "").trim();

  if (version) return version;
  if (!secondary || secondary === "—") return null;

  const nS = normalise(secondary);
  const nN = normalise(name);
  if (nS === nN || nS.includes(nN) || nN.includes(nS)) return null;

  return secondary;
}

function safeNumber(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Default price = Complete / unsealed average (the default when opening an item).
 * Primary: default_price_cad
 * Fallbacks: tier-7 fields if present, else generic price fields.
 */
function getDefaultPriceCad(item: CatalogCard): number | null {
  const anyIt = item as any;

  // ✅ desired canonical field
  const dp = safeNumber(anyIt.default_price_cad);
  if (dp !== null) return dp;

  // fallback: tier 7
  const tier10 = 7;

  const flat = safeNumber(anyIt[`price_tier10_${tier10}_cad`]);
  if (flat !== null) return flat;

  const m1 = anyIt.price_tier10_cad;
  if (m1 && typeof m1 === "object") {
    const v = safeNumber(m1[tier10] ?? m1[String(tier10)]);
    if (v !== null) return v;
  }

  const m2 = anyIt.pricing_tier10;
  if (m2 && typeof m2 === "object") {
    const v = safeNumber(m2[tier10] ?? m2[String(tier10)]);
    if (v !== null) return v;
  }

  // generic fallbacks
  const p =
    safeNumber(anyIt.price_cad) ??
    safeNumber(anyIt.market_price_cad) ??
    safeNumber(anyIt.estimated_price_cad) ??
    safeNumber(anyIt.latest_sale_price_cad);

  return p ?? null;
}

function formatMoneyCAD(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

function categoryLabel(item: CatalogCard) {
  // If you later add category_name, use it here.
  // For now, you were showing kind (gaming/building blocks) — keep that behaviour.
  const k = String(item.kind ?? "").toLowerCase();
  if (k === "minifig") return "MINIFIG";
  return k.replace(/_/g, " ").toUpperCase();
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

  const edition = useMemo(() => computeEdition(item), [item]);
  const category = useMemo(() => categoryLabel(item), [item]);
  const defaultPrice = useMemo(() => getDefaultPriceCad(item), [item]);

  const year =
    typeof item.release_year === "number" && Number.isFinite(item.release_year) ? String(item.release_year) : "";

  const pricePill = defaultPrice !== null ? `Avg ${formatMoneyCAD(defaultPrice)}` : "No price";

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
          <div className="relative h-28 w-28 rounded-xl bg-gray-100 overflow-hidden shrink-0 border flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-2 bg-white" />
            ) : (
              <div className="text-[11px] text-gray-400">No image</div>
            )}

            {/* PRICE pill (top-left over image) */}
            <div className="absolute left-2 top-2">
              <div className="max-w-[110px] rounded-full border border-white/40 bg-white/90 px-2 py-1">
                <div className="text-[10px] font-semibold text-slate-900 truncate">{pricePill}</div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {/* Item Name */}
                <div className="text-sm font-semibold text-[#0F172A] line-clamp-2">{item.name}</div>

                {/* Edition */}
                <div className="mt-1 text-[11px] text-slate-600 line-clamp-2">{edition || "—"}</div>

                {/* Category */}
                <div className="mt-1 text-[10px] font-semibold text-slate-500">{category}</div>

                {/* Year */}
                <div className="mt-3 flex items-center gap-3 text-[11px] text-[#94A3B8]">
                  {year ? <span>{year}</span> : <span className="text-[#CBD5E1]">—</span>}
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
          <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-3 bg-white" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-400">No image</div>
        )}

        {/* Quick actions (top-right) */}
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

        {/* PRICE pill (top-left). Reserve space so it can’t run under the buttons */}
        <div className="absolute left-2 top-2 pr-[110px]">
          <div className="max-w-full rounded-full border border-white/40 bg-white/90 px-2 py-1">
            <div className="text-[10px] font-semibold text-slate-900 truncate">{pricePill}</div>
          </div>
        </div>
      </div>

      <div className="p-3">
        {/* Item Name */}
        <p className="text-xs font-semibold text-slate-900 line-clamp-2">{item.name}</p>

        {/* Edition */}
        <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">{edition || "—"}</p>

        {/* Category */}
        <p className="mt-1 text-[10px] font-semibold text-slate-500">{category}</p>

        {/* Year */}
        <div className="mt-2">
          <span className="text-[10px] text-gray-400">{year}</span>
        </div>
      </div>
    </button>
  );
}
