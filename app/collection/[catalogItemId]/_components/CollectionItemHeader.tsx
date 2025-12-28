"use client";

import React from "react";

export default function CollectionItemHeader({
  name,
  photoUrl,
  stats,
}: {
  name: string;
  photoUrl: string | null;
  stats: { total: number; graded: number; raw: number };
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="h-28 w-28 overflow-hidden rounded-2xl border bg-gray-50 flex items-center justify-center">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="text-xs text-gray-500 px-3 text-center">No photo</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold truncate">{name}</div>

          <div className="mt-2 flex flex-wrap gap-2">
            <StatPill label="Copies" value={stats.total} />
            <StatPill label="Raw" value={stats.raw} />
            <StatPill label="Graded" value={stats.graded} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
