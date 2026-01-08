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

function safeConditionLabel(condition: any): string {
  try {
    if (!condition || typeof condition !== "object") return "Condition not set";
    if (condition.mode === "unknown") return "Condition not set";
    const s = formatConditionForCard(condition);
    return typeof s === "string" && s.trim().length ? s : "Condition not set";
  } catch {
    return "Condition not set";
  }
}

export default function CollectionCard({ item }: { item: CollectionCardModel }) {
  const name = item?.name ?? "Untitled";
  const photoUrl = (item as any)?.photoUrl ?? null;

  const copies = Number((item as any)?.copiesCount ?? 0) || 0;
  const isMinifig = (item as any)?.kind === "minifig" || (item as any)?.entity === "minifig";

  const conditionObj = (item as any)?.condition;
  const conditionLabel = safeConditionLabel(conditionObj);

  return (
    <Link
      href={(item as any)?.href ?? "#"}
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
          {conditionObj?.mode === "graded" ? <Badge>Graded</Badge> : null}
        </div>
      </div>

      <div className="p-3">
        <div className="text-sm font-semibold text-gray-900 line-clamp-2">{name}</div>

        {/* ✅ Always show a condition label */}
        <div className="mt-1 text-xs font-semibold text-gray-800">{conditionLabel}</div>

        {/* ✅ DEBUG: shows what condition object actually is */}
        <div className="mt-1 text-[10px] text-gray-500 break-words">
          <span className="font-semibold">debug condition:</span>{" "}
          {conditionObj ? JSON.stringify(conditionObj) : "null/undefined"}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="text-[11px] text-gray-500">View details</div>
          <div className="text-[11px] font-semibold text-gray-700 group-hover:text-black">→</div>
        </div>
      </div>
    </Link>
  );
}
