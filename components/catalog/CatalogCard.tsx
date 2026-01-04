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

/**
 * Make the results scannable even with limited fields.
 * - primary: short, non-repeated title
 * - variant: the differentiator (edition/bundle/etc.)
 */
function computeDisplay(item: CatalogCard): { primary: string; variant: string | null } {
  const rawName = String(item.name ?? "").trim();
  const rawSecondary = String(item.secondary ?? "").trim();

  // Prefer secondary as the differentiator (it’s already “the second line” conceptually).
  // But if it’s empty or useless, try to pull a variant out of the name.
  const secondary = rawSecondary && rawSecondary !== "—" ? rawSecondary : "";

  // Heuristic split of the name into “franchise-ish” + “variant-ish”
  // Examples:
  // - "Call of Duty: Black Ops" => primary "Black Ops"
  // - "Call of Duty: Black Ops II" => primary "Black Ops II"
  // - "Turtle Beach Ear Force X-RAY Headset" => primary stays as-is
  const hasColon = rawName.includes(":");
  const hasDash = rawName.includes(" - ") || rawName.includes(" — ") || rawName.includes(" – ");

  let primary = rawName;
  let extractedVariant: string | null = null;

  if (hasColon) {
    // Use the right side of the colon as the primary (usually the unique bit)
    const parts = rawName.split(":");
    const rhs = parts.slice(1).join(":").trim();
    if (rhs.length) primary = rhs;
  } else if (hasDash) {
    // "Thing — Variant" or "Thing - Variant"
    const parts = rawName.split(/ — | – | - /);
    const left = parts[0]?.trim();
    const right = parts.slice(1).join(" - ").trim();
    if (left) primary = left;
    if (right) extractedVariant = right || null;
  }

  // If secondary looks like it just repeats the primary, drop it.
  const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const nPrimary = normalise(primary);
  const nSecondary = normalise(secondary);

  const secondaryRepeatsPrimary =
    !!secondary &&
    (nSecondary === nPrimary || nSecondary.includes(nPrimary) || nPrimary.includes(nSecondary));

  let variant: string | null = null;

  if (secondary && !secondaryRepeatsPrimary) {
    variant = secondary;
  } else if (extractedVariant) {
    variant = extractedVariant;
  } else {
    variant = null;
  }

  // Hard clamp so variants don’t become novels.
  if (variant && variant.length > 80) variant = variant.slice(0, 77) + "…";

  // If primary is still very long, clamp it too.
  if (primary.length > 80) primary = primary.slice(0, 77) + "…";

  return { primary, variant };
}

function kindBadge(kind: CatalogCard["kind"]): { label: string; tone: string } {
  // You can tune this mapping to your domain language.
  const k = String(kind ?? "").toLowerCase();

  if (k === "minifig") return { label: "MINIFIG", tone: "bg-white/90 text-slate-800 border-white/40" };

  if (k.includes("game")) return { label: "GAME", tone: "bg-white/90 text-slate-800 border-white/40" };
  if (k.includes("dlc") || k.includes("expansion") || k.includes("map")) {
    return { label: "DLC", tone: "bg-white/90 text-slate-800 border-white/40" };
  }
  if (k.includes("bundle") || k.includes("package") || k.includes("set")) {
    return { label: "BUNDLE", tone: "bg-white/90 text-slate-800 border-white/40" };
  }
  if (k.includes("accessory") || k.includes("controller") || k.includes("headset")) {
    return { label: "ACCESSORY", tone: "bg-white/90 text-slate-800 border-white/40" };
  }

  // Fallback: turn snake_case into badge text
  const label = k.replace(/_/g, " ").toUpperCase();
  return { label, tone: "bg-white/90 text-slate-800 border-white/40" };
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

  const display = useMemo(() => computeDisplay(item), [item]);
  const badge = useMemo(() => kindBadge(item.kind), [item.kind]);

  const year =
    typeof item.release_year === "number" && Number.isFinite(item.release_year) ? String(item.release_year) : "";

  const kindText = item.kind === "minifig" ? "minifig" : String(item.kind ?? "").replace(/_/g, " ");

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
              <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="text-[11px] text-gray-400">No image</div>
            )}

            {/* Image overlay for legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0 pointer-events-none" />

            {/* Kind badge */}
            <div
              className={`absolute left-2 top-2 text-[10px] font-semibold px-2 py-1 rounded-full border ${badge.tone}`}
            >
              {badge.label}
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#0F172A] truncate">{display.primary}</div>

                {display.variant ? (
                  <div className="mt-1 text-[11px] text-[#475569] line-clamp-2">{display.variant}</div>
                ) : (
                  <div className="mt-1 text-[11px] text-[#94A3B8]">—</div>
                )}

                <div className="mt-3 flex items-center gap-3 text-[11px] text-[#94A3B8]">
                  {year ? <span>{year}</span> : <span className="text-[#CBD5E1]">—</span>}
                  <span className="h-1 w-1 rounded-full bg-[#CBD5E1]" />
                  <span>{kindText}</span>
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

        {/* Dim + gradient for legibility */}
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 pointer-events-none" />

        {/* Kind badge */}
        <div className={`absolute left-2 top-2 text-[10px] font-semibold px-2 py-1 rounded-full border ${badge.tone}`}>
          {badge.label}
        </div>

        {/* Quick actions */}
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
        {/* Primary title (scan-first) */}
        <p className="text-xs font-semibold text-slate-900 truncate">{display.primary}</p>

        {/* Variant / differentiator (scan-second) */}
        {display.variant ? (
          <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">{display.variant}</p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-400">—</p>
        )}

        {/* Meta row (keep short) */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{year}</span>
          <span className="text-[10px] text-gray-400">{kindText}</span>
        </div>
      </div>
    </button>
  );
}
