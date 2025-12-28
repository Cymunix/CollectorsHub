"use client";

import React from "react";

export type Filters = {
  kind: string | "all";
  graded: "all" | "graded" | "raw";
  forSale: "all" | "for_sale" | "not_for_sale";
};

const KINDS: { value: Filters["kind"]; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "building_blocks", label: "Building Blocks" },
  { value: "minifig", label: "Minifigs" }, // ✅ new
  { value: "trading_card", label: "Trading Cards" },
  { value: "sports_card", label: "Sports Cards" },
  { value: "music", label: "Music" },
  { value: "movie", label: "Movies" },
  { value: "gaming", label: "Gaming" },
  { value: "comic", label: "Comics" },
  { value: "toy", label: "Toys" },
];

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium text-gray-900">{children}</div>;
}

export default function CollectionFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const isDefault =
    value.kind === "all" && value.graded === "all" && value.forSale === "all";

  return (
    <div className="space-y-4">
      <div>
        <Label>Category</Label>
        <select
          className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
          value={value.kind}
          onChange={(e) => onChange({ ...value, kind: e.target.value as any })}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Grading</Label>
        <select
          className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
          value={value.graded}
          onChange={(e) => onChange({ ...value, graded: e.target.value as any })}
        >
          <option value="all">All</option>
          <option value="graded">Graded only</option>
          <option value="raw">Raw only</option>
        </select>
      </div>

      <div>
        <Label>Sale status</Label>
        <select
          className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
          value={value.forSale}
          onChange={(e) => onChange({ ...value, forSale: e.target.value as any })}
        >
          <option value="all">All</option>
          <option value="for_sale">For sale</option>
          <option value="not_for_sale">Not for sale</option>
        </select>
        <div className="mt-1 text-xs text-gray-500">
          Applies once sale status is stored per item.
        </div>
      </div>

      <button
        type="button"
        className={[
          "w-full rounded-xl px-3 py-2 text-sm font-semibold transition",
          isDefault
            ? "border bg-white text-gray-400 cursor-not-allowed"
            : "border bg-white hover:bg-gray-50",
        ].join(" ")}
        disabled={isDefault}
        onClick={() => onChange({ kind: "all", graded: "all", forSale: "all" })}
      >
        Reset filters
      </button>
    </div>
  );
}
