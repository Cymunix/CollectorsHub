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

function computeVariant(item: CatalogCard): string | null {
  const rawName = String(item.name ?? "").trim();
  const rawSecondary = String(item.secondary ?? "").trim();
  const secondary = rawSecondary && rawSecondary !== "—" ? rawSecondary : "";

  // If secondary repeats the name, ignore it
  if (secondary && (normalise(secondary) === normalise(rawName) || normalise(secondary).includes(normalise(rawName)))) {
    return null;
  }

  // Prefer an explicit version if present
  const v = String((item as any).version ?? "").trim();
  if (v) return v;

  if (secondary) return secondary;

  // Fallback: try to extract after dash
  const hasDash = rawName.includes(" - ") || rawName.includes(" — ") || rawName.includes(" – ");
  if (hasDash) {
    const parts = rawName.split(/ — | – | - /);
    const right = parts.slice(1).join(" - ").trim();
    if (right) return right;
  }

  return null;
}

function safeNumber(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tier-7 "complete unsealed" pricing.
 * Supports:
 * - price_tier10_7_cad (flat)
 * - price_tier10_cad or pricing_tier10 maps
 * - fallback price_cad / market_price_cad / estimated_price_cad / latest_sale_price_cad
 */
function getTier7PriceCad(item: CatalogCard): number | null {
  const anyIt = item as any;
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

  const p =
    safeNumber(anyIt.price_cad) ??
    safeNumber(anyIt.market_price_cad) ??
    safeNumber(anyIt.estimated_price_cad) ??
    safeNumber(anyIt.latest_sale_price_cad);

  return p ?? null;
}

function formatMoneyCAD(n: number | null) {
  if (n === null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

function kindBadge(kind: CatalogCard["kind"]) {
  const k = String(kind ?? "").toLowerCase();
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

  const badgeText = useMemo(() => kindBadge(item.kind), [item.kind]);
  const variant = useMemo(() => computeVariant(item), [item]);
  const tier7 = useMemo(() => getTier7PriceCad(item), [item]);

  const year =
    typeof item.release_year === "number" && Number.isFinite(item.release_year) ? String(item.release_year) : "";

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

            {/* Badge: constrain width so it NEVER overlaps buttons (even if you add buttons later) */}
            <div className="absolute left-2 top-2 max-w-[78px] rounded-full border border-white/40 bg-white/90 px-2 py-1">
              <div className="text-[10px] font-semibold text-slate-800 truncate">{badgeText}</div>
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {/* PRICE (top line) */}
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {tier7 !== null ? `${formatMoneyCAD(tier7)} avg (tier 7)` : "— avg (tier 7)"}
                </div>

                {/* VERSION / VARIANT (second line) */}
                <div className="mt-1 text-[11px] text-slate-600 line-clamp-2">{variant || "—"}</div>

                {/* CATALOG NAME (third line) */}
                <div className="mt-2 text-xs font-semibold text-[#0F172A] line-clamp-2">{item.name}</div>

                {/* Meta row */}
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

        {/* Controls */}
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

        {/* Badge: reserve space so it can't run under the buttons */}
        <div className="absolute left-2 top-2 pr-[110px]">
          <div className="max-w-full rounded-full border border-white/40 bg-white/90 px-2 py-1">
            <div className="text-[10px] font-semibold text-slate-800 truncate">{badgeText}</div>
          </div>
        </div>
      </div>

      <div className="p-3">
        {/* PRICE (top line) */}
        <p className="text-xs font-semibold text-slate-900 truncate">
          {tier7 !== null ? `${formatMoneyCAD(tier7)} avg (tier 7)` : "— avg (tier 7)"}
        </p>

        {/* VERSION / VARIANT (second line) */}
        <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">{variant || "—"}</p>

        {/* CATALOG NAME (third line) */}
        <p className="mt-2 text-xs font-semibold text-slate-900 line-clamp-2">{item.name}</p>

        {/* Year */}
        <div className="mt-2">
          <span className="text-[10px] text-gray-400">{year}</span>
        </div>
      </div>
    </button>
  );
}
