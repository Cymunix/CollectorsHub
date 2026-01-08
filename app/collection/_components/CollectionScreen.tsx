// app/collection/_components/CollectionScreen.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import CollectionToolbar from "./CollectionToolbar";
import CollectionGrid from "./CollectionGrid";
import CollectionInsightsTab from "./CollectionInsightsTab";
import CollectionFilters, { type Filters } from "./CollectionFilters";
import CollectionSummary from "./CollectionSummary";
import RightCollectionPanel from "./RightCollectionPanel";

import { loadCollectionCards } from "../_lib/collectionRepo";
import type { CollectionCardModel } from "../_lib/types";

type SortKey = "name" | "copies";
type TabKey = "items" | "minifigs" | "insights";

type Props = {
  onRequireAuth?: () => void;
};

const MinifigsScreen = dynamic(() => import("./minifigs/MinifigsScreen"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border bg-white px-4 py-6 text-sm text-gray-600">
      Loading minifigs…
    </div>
  ),
});

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-full text-sm font-semibold border transition",
        active
          ? "bg-black text-white border-black"
          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

function isLikelyAuthError(e: any) {
  const msg = String(e?.message ?? e ?? "").toLowerCase();
  return (
    msg.includes("jwt") ||
    msg.includes("not authenticated") ||
    msg.includes("not authorized") ||
    msg.includes("permission denied") ||
    msg.includes("auth") ||
    msg.includes("login") ||
    msg.includes("sign in")
  );
}

export default function CollectionScreen({ onRequireAuth }: Props) {
  const [cards, setCards] = useState<CollectionCardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [tab, setTab] = useState<TabKey>("items");

  const [filters, setFilters] = useState<Filters>({
    kind: "all",
    graded: "all",
    forSale: "all",
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setErr(null);

        const data = await withTimeout(loadCollectionCards(), 12000, "loadCollectionCards()");
        if (!cancelled) setCards(data);
      } catch (e: any) {
        console.error("CollectionScreen load error:", e);

        if (!cancelled) {
          const msg = e?.message ?? "Failed to load collection.";
          setErr(msg);

          if (isLikelyAuthError(e)) {
            onRequireAuth?.();
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [onRequireAuth]);

  const filtersActive = useMemo(() => {
    return (
      q.trim().length > 0 ||
      filters.kind !== "all" ||
      filters.graded !== "all" ||
      filters.forSale !== "all"
    );
  }, [q, filters]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = [...cards];

    if (needle) {
      list = list.filter((c) => String(c?.name ?? "").toLowerCase().includes(needle));
    }

    if (filters.kind !== "all") {
      list = list.filter((c) => c.kind === filters.kind);
    }

    if (filters.forSale !== "all") {
      const want = filters.forSale === "for_sale";
      list = list.filter((c) => {
        if (c.forSale == null) return false;
        return c.forSale === want;
      });
    }

    if (filters.graded !== "all") {
      const wantGraded = filters.graded === "graded";
      list = list.filter((c) => {
        const mode = c?.condition?.mode; // "graded" | "raw" | undefined
        const isGraded = mode === "graded";
        return wantGraded ? isGraded : !isGraded;
      });
    }

    if (sort === "copies") {
      list = [...list].sort(
        (a, b) =>
          (Number(b?.copiesCount) || 0) - (Number(a?.copiesCount) || 0) ||
          String(a?.name ?? "").localeCompare(String(b?.name ?? ""))
      );
    } else {
      list = [...list].sort((a, b) =>
        String(a?.name ?? "").localeCompare(String(b?.name ?? ""))
      );
    }

    return list;
  }, [cards, q, sort, filters]);

  const emptyHint: "no_items" | "no_results" | undefined = useMemo(() => {
    if (loading) return undefined;
    if (cards.length === 0) return "no_items";
    if (filtered.length === 0) return "no_results";
    return undefined;
  }, [loading, cards.length, filtered.length]);

  return (
    <section className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Collection</h1>
          <p className="text-sm text-gray-500">
            {loading ? "Loading…" : `${filtered.length} items`}
            {filtersActive ? " (filtered)" : ""}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90"
          >
            Add items
          </Link>

          {filtersActive ? (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              onClick={() => {
                setQ("");
                setFilters({ kind: "all", graded: "all", forSale: "all" });
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Summary row */}
      <CollectionSummary allCards={cards} filteredCards={filtered} loading={loading} />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <TabButton active={tab === "items"} onClick={() => setTab("items")}>
          Items
        </TabButton>
        <TabButton active={tab === "minifigs"} onClick={() => setTab("minifigs")}>
          Minifigs
        </TabButton>
        <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>
          Insights
        </TabButton>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_340px] xl:grid-cols-[260px_1fr_360px]">
        {/* Filters */}
        <aside className="h-fit rounded-2xl border bg-white p-4 lg:sticky lg:top-24">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-base font-semibold text-gray-900">Filters</div>
            {filtersActive ? (
              <span className="text-[11px] font-semibold text-gray-500">Active</span>
            ) : null}
          </div>

          <CollectionFilters value={filters} onChange={setFilters} />
        </aside>

        {/* Main */}
        <div className="space-y-3 min-w-0">
          {tab === "items" ? (
            <>
              <CollectionToolbar
                query={q}
                onQueryChange={setQ}
                sort={sort}
                onSortChange={setSort}
              />
              <CollectionGrid items={filtered} loading={loading} emptyHint={emptyHint} />
            </>
          ) : tab === "minifigs" ? (
            <MinifigsScreen />
          ) : (
            <CollectionInsightsTab cards={cards} loading={loading} />
          )}
        </div>

        {/* Right panel */}
        <aside className="h-fit lg:sticky lg:top-24">
          <RightCollectionPanel
            q={q}
            sort={sort}
            tab={tab}
            filters={filters}
            setFilters={setFilters}
            clearAll={() => {
              setQ("");
              setFilters({ kind: "all", graded: "all", forSale: "all" });
            }}
            loading={loading}
            err={err}
            cards={filtered}
          />
        </aside>
      </div>
    </section>
  );
}
