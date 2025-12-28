"use client";

import React from "react";
import Link from "next/link";
import type { CollectionCardModel } from "../_lib/types";
import { formatConditionForCard } from "../_lib/formatters";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow-sm">
      {children}
    </span>
  );
}

export default function CollectionCard({ item }: { item: CollectionCardModel }) {
  const name = item?.name ?? "Untitled";
  const photoUrl = item?.photoUrl ?? null;

  const copies = Number(item?.copiesCount ?? 0) || 0;
  const conditionLabel = formatConditionForCard(item.condition);

  const isMinifig = item.kind === "minifig" || item.entity === "minifig";

  return (
    <Link
      href={item.href}
      className="group block text-left rounded-2xl border bg-white overflow-hidden transition hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-black/20"
    >
      <div className="relative aspect-[4/3] bg-gray-50">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name}
            className="h-full w-full object-cover transition group-hover:scale-[1.01]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
            No photo
          </div>
        )}

        <div className="absolute top-2 left-2 flex gap-2">
          {copies > 0 ? <Badge>{copies} {copies === 1 ? "copy" : "copies"}</Badge> : null}
          {isMinifig ? <Badge>Minifig</Badge> : null}
          {item.condition?.mode === "graded" ? <Badge>Graded</Badge> : null}
        </div>
      </div>

      <div className="p-3">
        <div className="text-sm font-semibold text-gray-900 line-clamp-2">{name}</div>

        {!isMinifig ? (
          <div className="mt-1 text-xs font-semibold text-gray-800">{conditionLabel}</div>
        ) : (
          <div className="mt-1 text-xs font-semibold text-gray-700">Included minifig</div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div className="text-[11px] text-gray-500">View details</div>
          <div className="text-[11px] font-semibold text-gray-700 group-hover:text-black">→</div>
        </div>
      </div>
    </Link>
  );
}
