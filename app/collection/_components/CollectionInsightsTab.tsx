"use client";

import React from "react";
import InsightsTabs from "./InsightsTabs";
import InsightsPanel from "./InsightsPanel";
import type { CollectionCardModel } from "../_lib/types";

export default function CollectionInsightsTab({
  cards,
  loading,
}: {
  cards: CollectionCardModel[];
  loading: boolean;
}) {
  // If you already have a newer InsightsPanel that includes sub-tabs internally,
  // you can just return <InsightsPanel ... /> and delete this wrapper.
  // But since you want to avoid long scrolling, we use sub-tabs here.

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
        Loading insights…
      </div>
    );
  }

  return (
    <InsightsTabs
      summary={<InsightsPanel cards={cards as any} mode="summary" />}
      breakdowns={<InsightsPanel cards={cards as any} mode="breakdowns" />}
      duplicates={<InsightsPanel cards={cards as any} mode="duplicates" />}
      completeness={<InsightsPanel cards={cards as any} mode="completeness" />}
      lego={<InsightsPanel cards={cards as any} mode="lego" />}
    />
  );
}
