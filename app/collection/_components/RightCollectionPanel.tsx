// app/collection/_components/RightCollectionPanel.tsx
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

  // pass the *filtered* list so the panel reflects the current view
  cards: CollectionCardModel[];
};

function makeRowsFromMap(map: Map<string, { name: string; count: number }>): CountRow[] {
  return Array.from(map.entries())
    .map(([id, v]) => ({ id, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function getConditionBucket(c: any): { key: string; name: string; mode: "graded" | "raw" | "unknown" } {
  const cond = c?.condition;
  const mode = (cond?.mode as string | undefined) ?? "unknown";

  if (mode === "graded") return { key: "graded", name: "Graded", mode: "graded" };

  if (mode === "raw") {
    // your normalised mapping uses tier10 in raw.score (1–10)
    const score = Number(cond?.raw?.score);
    if (!Number.isFinite(score)) return { key: "raw_unknown", name: "Raw (unknown)", mode: "raw" };

    if (score <= 4) return { key: "raw_1_4", name: "Raw (1–4)", mode: "raw" };
    if (score <= 7) return { key: "raw_5_7", name: "Raw (5–7)", mode: "raw" };
    return { key: "raw_8_10", name: "Raw (8–10)", mode: "raw" };
  }

  return { key: "unknown", name: "Unknown", mode: "unknown" };
}

export default function RightCollectionPanel(p: Props) {
  const focusLabel = useMemo(() => {
    const parts: string[] = [];

    // Tab
    parts.push(p.tab === "items" ? "Items" : p.tab === "minifigs" ? "Minifigs" : "Insights");

    // Filters
    if (p.filters.kind !== "all") parts.push(`Kind: ${p.filters.kind}`);
    if (p.filters.graded !== "all") parts.push(p.filters.graded === "graded" ? "Graded only" : "Raw only");
    if (p.filters.forSale !== "all") parts.push(p.filters.forSale === "for_sale" ? "For sale" : "Not for sale");

    // Search
    if (p.q.trim()) parts.push(`Search: "${p.q.trim()}"`);

    // Sort
    parts.push(`Sort: ${p.sort === "name" ? "Name" : "Copies"}`);

    return parts.join(" · ");
  }, [p.tab, p.filters, p.q, p.sort]);

  const countsByKind = useMemo<CountRow[]>(() => {
    const m = new Map<string, { name: string; count: number }>();
    for (const c of p.cards) {
      const kind = String((c as any)?.kind ?? "unknown");
      const prev = m.get(kind) ?? { name: kind, count: 0 };
      prev.count += 1;
      m.set(kind, prev);
    }
    return makeRowsFromMap(m);
  }, [p.cards]);

  const countsByCondition = useMemo<CountRow[]>(() => {
    const m = new Map<string, { name: string; count: number }>();
    for (const c of p.cards) {
      const b = getConditionBucket(c as any);
      const prev = m.get(b.key) ?? { name: b.name, count: 0 };
      prev.count += 1;
      m.set(b.key, prev);
    }
    return makeRowsFromMap(m);
  }, [p.cards]);

  const countsBySale = useMemo<CountRow[]>(() => {
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

  const isConditionActive = (id: string) => {
    // Your filter only supports graded/raw/all. So:
    if (p.filters.graded === "graded") return id === "graded";
    if (p.filters.graded === "raw") return id.startsWith("raw_");
    return false;
  };

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm lg:sticky lg:top-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-gray-500">Focus</div>
          <div className="mt-0.5 text-sm font-semibold text-[#0F172A]">My Collection</div>
          <div className="mt-1 text-[11px] text-gray-500">{focusLabel}</div>
        </div>
      </div>

      {/* Current view / actions */}
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

      {/* Items by kind */}
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

      {/* Items by condition */}
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
                    isConditionActive(r.id) ? "bg-gray-50 font-semibold" : ""
                  }`}
                  onClick={() => {
                    // Your Filters only support graded/raw/all:
                    if (r.id === "graded") p.setFilters({ ...p.filters, graded: "graded" });
                    else if (r.id.startsWith("raw_")) p.setFilters({ ...p.filters, graded: "raw" });
                    else p.setFilters({ ...p.filters, graded: "all" }); // unknown -> all
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

      {/* Items by sale status */}
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
                    (p.filters.forSale === "for_sale" && r.id === "for_sale") ||
                    (p.filters.forSale === "not_for_sale" && r.id === "not_for_sale")
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
