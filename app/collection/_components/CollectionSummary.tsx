"use client";

import React, { useMemo } from "react";
import type { CollectionCardModel } from "../_lib/types";

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export default function CollectionSummary({
  allCards,
  filteredCards,
  loading,
}: {
  allCards: CollectionCardModel[];
  filteredCards: CollectionCardModel[];
  loading: boolean;
}) {
  const stats = useMemo(() => {
    const uniqueItems = allCards.length;

    const totalCopies = allCards.reduce((sum, c) => sum + (Number(c.copiesCount) || 0), 0);

    const gradedCount = allCards.filter((c) => c.condition?.mode === "graded").length;

    const unknownConditionCount = allCards.filter((c) => c.condition?.mode === "unknown").length;

    const duplicates = allCards.filter((c) => (Number(c.copiesCount) || 0) > 1).length;

    // LEGO heuristic: you don't have kind on the model yet, so we infer from name.
    // (Once you add kind, replace this with c.kind === "building_blocks".)
    const legoCount = allCards.filter((c) => String(c.name ?? "").toLowerCase().includes("lego")).length;

    const filteredCount = filteredCards.length;

    return {
      uniqueItems,
      totalCopies,
      gradedCount,
      unknownConditionCount,
      duplicates,
      legoCount,
      filteredCount,
    };
  }, [allCards, filteredCards]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          {loading ? (
            "Loading collection stats…"
          ) : (
            <>
              Showing <span className="font-semibold text-gray-900">{stats.filteredCount}</span>{" "}
              of <span className="font-semibold text-gray-900">{stats.uniqueItems}</span> items
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Unique items" value={loading ? "—" : stats.uniqueItems} />
        <StatCard label="Total copies" value={loading ? "—" : stats.totalCopies} />
        <StatCard label="Graded items" value={loading ? "—" : stats.gradedCount} />
        <StatCard label="Duplicates" value={loading ? "—" : stats.duplicates} />
        <StatCard label="Unknown condition" value={loading ? "—" : stats.unknownConditionCount} />
        <StatCard label="LEGO (name match)" value={loading ? "—" : stats.legoCount} />
      </div>
    </div>
  );
}
