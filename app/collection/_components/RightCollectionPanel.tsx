"use client";

import React, { useMemo } from "react";
import type { CollectionCardModel } from "../_lib/types";
import type { Filters } from "./CollectionFilters";

type CountRow = { id: string; name: string; count: number };

type Props = {
  q: string;
  sort: "name" | "copies";
  tab: "items" | "minifigs" | "insights";

  filters: Filters;
  setFilters: (v: Filters) => void;
  clearAll: () => void;

  loading: boolean;
  err: string | null;

  // Use *filtered* cards so the right panel reflects what user is looking at
  cards: CollectionCardModel[];
};

function makeRowsFromMap(map: Map<string, { name: string; count: number }>) {
  return Array.from(map.entries())
    .map(([id, v]) => ({ id, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export default function RightCollectionContextPanel(p: Props) {
  const focusLabel = useMemo(() => {
    const parts: string[] = [];
    if (p.tab === "items") parts.push("Items");
    if (p.tab === "minifigs") parts.push("Minifigs");
    if (p.tab === "insights") parts.push("Insights");

    if (p.filters.kind !== "all") parts.push(`Kind: ${p.filters.kind}`);
    if (p.filters.graded !== "all") parts.push(p.filters.graded === "graded" ? "Graded only" : "Ungraded only");
    if (p.filters.forSale !== "all") parts.push(p.filters.forSale === "for_sale" ? "For sale" : "Not for sale");

    if (p.q.trim()) parts.push(`Search: "${p.q.trim()}"`);
    parts.push(`Sort: ${p.sort === "name" ? "Name" : "Copies"}`);

    return parts.join(" · ");
  }, [p.tab, p.filters, p.q, p.sort]);

  const countsByKind = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    for (const c of p.cards) {
      const kind = String((c as any)?.kind ?? "unknown");
      const prev = m.get(kind) ?? { name: kind, count: 0 };
      prev.count += 1;
      m.set(kind, prev);
    }
    return makeRowsFromMap(m);
  }, [p.cards]);

  const countsByCondition = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    for (const c of p.cards) {
      const mode = (c as any)?.condition?.mode as string | undefined;
      const key = mode ? mode : "unknown";
      const name =
        key === "graded" ? "Graded" : key === "raw" ? "Raw" : key === "unknown" ? "Unknown" : key;

      const prev = m.get(key) ?? { name, count: 0 };
      prev.count += 1;
      m.set(key, prev);
    }
    return makeRowsFromMap(m);
  }, [p.cards]);

  const countsBySale = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    for (const c of p.cards) {
      const forSale = (c as any)?.forSale as boolean | null | undefined;
      const key = forSale === true ? "for_sale" : forSale === false ? "not_for_sale" : "unknown";
      const name = key === "for_sale" ? "For sale" : key === "not_for_sale" ? "Not for sale" : "Unknown";
      const prev = m.get(key) ?? { name, count: 0 };
      prev.count += 1;
      m.set(key, prev);
    }
    return makeRowsFromMap(m);
  }, [p.cards]);

  const hasFocus = true;

  if (!hasFocus) {
    return (
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A]">Context</h3>
        <p className="mt-1 text-xs text-gray-500">No focus.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-gray-500">Focus</div>
          <div className="mt-0.5 text-sm font-semibold text-[#0F172A]">My Collection</div>
          <div className="mt-1 text-[11px] text-gray-500">{focusLabel}</div>
        </div>
      </div>

      {/* Quick actions / current view */}
      <div className="mt-4 rounded-xl border bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold text-gray-600">Current view</div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              {p.loading ? "Loading…" : `${p.cards.length} items in view`}
            </div>
          </div>

          <button
            type="button"
            onClick={p.clearAll}
            disabled={p.loading}
            className="text-[11px] font-semibold text-indigo-600 hover:underline disabled:opacity-60"
          >
            Clear
          </button>
        </div>

        {p.err ? <div className="mt-2 text-xs text-red-600">{p.err}</div> : null}
      </div>

      {/* Counts by kind */}
      <div className="mt-4 rounded-xl border bg-white p-3">
        <div className="text-[11px] font-semibold text-gray-600">Items by kind</div>

        {p.loading ? (
          <div className="mt-2 text-xs text-gray-500">Loading…</div>
        ) : countsByKind.length === 0 ? (
          <div className="mt-2 text-xs text-gray-500">No items found.</div>
        ) : (
          <ul className="mt-2 space-y-1">
            {countsByKind.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-gray-50 ${
                    p.filters.kind === r.id ? "bg-gray-50 font-semibold" : ""
                  }`}
                  onClick={() => p.setFilters({ ...p.filters, kind: r.id as any })}
                >
                  <span className="text-gray-800">{r.name}</span>
                  <span className="float-right text-gray-500">{r.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Counts by grading/condition */}
      <div className="mt-3 rounded-xl border bg-white p-3">
        <div className="text-[11px] font-semibold text-gray-600">Items by condition</div>

        {p.loading ? (
          <div className="mt-2 text-xs text-gray-500">Loading…</div>
        ) : countsByCondition.length === 0 ? (
          <div className="mt-2 text-xs text-gray-500">No condition data.</div>
        ) : (
          <ul className="mt-2 space-y-1">
            {countsByCondition.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-gray-50 ${
                    (r.id === "graded" && p.filters.graded === "graded") ||
                    (r.id !== "graded" && p.filters.graded === "ungraded")
                      ? "bg-gray-50 font-semibold"
                      : ""
                  }`}
                  onClick={() => {
                    if (r.id === "graded") p.setFilters({ ...p.filters, graded: "graded" });
                    else p.setFilters({ ...p.filters, graded: "ungraded" });
                  }}
                >
                  <span className="text-gray-800">{r.name}</span>
                  <span className="float-right text-gray-500">{r.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Counts by sale status */}
      <div className="mt-3 rounded-xl border bg-white p-3">
        <div className="text-[11px] font-semibold text-gray-600">Items by sale status</div>

        {p.loading ? (
          <div className="mt-2 text-xs text-gray-500">Loading…</div>
        ) : countsBySale.length === 0 ? (
          <div className="mt-2 text-xs text-gray-500">No sale status data.</div>
        ) : (
          <ul className="mt-2 space-y-1">
            {countsBySale.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-gray-50 ${
                    (r.id === "for_sale" && p.filters.forSale === "for_sale") ||
                    (r.id === "not_for_sale" && p.filters.forSale === "not_for_sale")
                      ? "bg-gray-50 font-semibold"
                      : ""
                  }`}
                  onClick={() => {
                    if (r.id === "for_sale") p.setFilters({ ...p.filters, forSale: "for_sale" });
                    else if (r.id === "not_for_sale") p.setFilters({ ...p.filters, forSale: "not_for_sale" });
                    else p.setFilters({ ...p.filters, forSale: "all" });
                  }}
                >
                  <span className="text-gray-800">{r.name}</span>
                  <span className="float-right text-gray-500">{r.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
