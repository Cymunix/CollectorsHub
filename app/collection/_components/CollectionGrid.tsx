"use client";

import React from "react";
import Link from "next/link";
import type { CollectionCardModel } from "../_lib/types";
import CollectionCard from "./CollectionCard";

export default function CollectionGrid({
  items,
  loading,
  emptyHint,
}: {
  items: CollectionCardModel[];
  loading: boolean;
  emptyHint?: "no_items" | "no_results";
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl border bg-white" />
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="text-sm font-semibold text-gray-900">
          {emptyHint === "no_results" ? "No results found" : "Nothing here yet"}
        </div>

        <div className="mt-1 text-sm text-gray-600">
          {emptyHint === "no_results"
            ? "Try a different search or reset your filters."
            : "Add items to your collection and they’ll show up here."}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90"
          >
            Add items
          </Link>

          <Link
            href="/catalog"
            className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Browse catalog
          </Link>
        </div>
      </div>
    );
  }

  // ✅ Fix: no button wrapping a Link (your previous code was invalid HTML)
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <CollectionCard key={it.catalogItemId} item={it} />
      ))}
    </div>
  );
}
