"use client";

import React from "react";
import type { MinifigCard as MinifigCardType } from "../../_lib/minifigsTypes";
import MinifigCard from "./MinifigCard";

export default function MinifigsGrid({
  cards,
  loading,
}: {
  cards: MinifigCardType[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-6 text-sm text-gray-600">
        Loading minifigs…
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-6 text-sm text-gray-600">
        No minifigs found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {cards.map((c) => (
        <MinifigCard key={c.minifigId} card={c} />
      ))}
    </div>
  );
}
