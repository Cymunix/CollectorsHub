// app/collection/_components/minifigs/MinifigsToolbar.tsx
"use client";

import React from "react";

export default function MinifigsToolbar({
  query,
  onQueryChange,
  onlyWithSets,
  onOnlyWithSetsChange,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  onlyWithSets: boolean;
  onOnlyWithSetsChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="w-full sm:max-w-lg">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search minifigs (name / number / set)…"
          className="w-full rounded-xl border bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      <label className="flex items-center gap-2 text-sm select-none">
        <input
          type="checkbox"
          checked={onlyWithSets}
          onChange={(e) => onOnlyWithSetsChange(e.target.checked)}
          className="h-4 w-4"
        />
        Only show minifigs with connected sets
      </label>
    </div>
  );
}
