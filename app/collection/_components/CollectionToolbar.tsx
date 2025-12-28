"use client";

import React from "react";

type SortKey = "name" | "copies";

export default function CollectionToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  sort: SortKey;
  onSortChange: (v: SortKey) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex-1">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search your collection…"
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="text-xs text-gray-500">Sort</div>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="rounded-xl border bg-white px-3 py-2 text-sm"
        >
          <option value="name">Name</option>
          <option value="copies">Copies</option>
        </select>
      </div>
    </div>
  );
}
