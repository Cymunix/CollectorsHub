// app/collection/_components/minifigs/MinifigCard.tsx
"use client";

import React, { useState } from "react";
import type { MinifigCard as MinifigCardType } from "../../_lib/minifigsTypes";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function MinifigCard({ card }: { card: MinifigCardType }) {
  const name = card.name ?? "Unknown minifig";
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border bg-white p-4">
      {/* Header: NO LINKS */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-start gap-4"
      >
        <div className="h-14 w-14 rounded-xl border overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="text-sm font-semibold text-gray-500">{initials(name)}</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold text-gray-900 truncate">{name}</div>
              <div className="text-sm text-gray-500">
                {card.minifigNumber ? `#${card.minifigNumber}` : "No number"}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] font-semibold text-gray-500">Included Qty</div>
              <div className="text-lg font-semibold text-gray-900">{card.includedQtyTotal}</div>
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500">{open ? "Hide details" : "Show details"}</div>
        </div>
      </button>

      {/* Details: NO LINKS */}
      {open ? (
        <div className="mt-4">
          <div className="text-[11px] font-semibold text-gray-500 mb-2">Connected Sets</div>

          {(card.sets?.length ?? 0) === 0 ? (
            <div className="rounded-xl border bg-gray-50 px-3 py-2 text-sm text-gray-600">
              None recorded.
            </div>
          ) : (
            <div className="space-y-2">
              {card.sets.slice(0, 10).map((s) => {
                const title = `${s.setNumber ? `${s.setNumber} ` : ""}${s.setName}`;
                return (
                  <div key={`${s.catalogItemId}-${title}`} className="rounded-xl border bg-white p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-lg border overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
                        {s.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.imageUrl} alt={title} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[11px] text-gray-400">No photo</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
                        <div className="text-xs text-gray-500">
                          Copies: {s.copiesCount} • Qty: {s.copiesQtyTotal}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {card.sets.length > 10 ? (
                <div className="text-xs text-gray-500 px-1">+ {card.sets.length - 10} more</div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
