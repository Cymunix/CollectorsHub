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
        "px-4 py-2 rounded-full text-sm font-semibold border transition",
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

function RightCollectionPanel({
  loading,
  err,
  summary,
}: {
  loading: boolean;
  err: string | null;
  summary: {
    uniqueItems: number;
    totalCopies: number;
    gradedItems: number;
    duplicates: number;
    unknownCondition: number;
  };
}) {
  return (
    <div className="lg:sticky lg:top-24 space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#0F172A]">Quick actions</div>

        <div className="mt-3 grid gap-2">
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Add items
          </Link>

          <button
            type="button"
            disabled
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 opacity-60"
            title="Coming next: export"
          >
            Export CSV
          </button>

          <button
            type="button"
            disabled
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 opacity-60"
            title="Coming next: bulk edit"
          >
            Bulk edit
          </button>
        </div>

        {err ? <div className="mt-3 text-xs text-red-600">{err}</div> : null}
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#0F172A]">Summary</div>

        {loading ? (
          <div className="mt-2 text-xs text-gray-500">Loading…</div>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Unique items</dt>
              <dd className="font-semibold">{summary.uniqueItems}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Total copies</dt>
              <dd className="font-semibold">{summary.totalCopies}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Graded items</dt>
              <dd className="font-semibold">{summary.gradedItems}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Duplicates</dt>
              <dd className="font-semibold">{summary.duplicates}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Unknown condition</dt>
              <dd className="font-semibold">{summary.unknownCondition}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#0F172A]">Next</div>
        <div className="mt-2 text-sm text-gray-600">
          If you want “Total paid / Missing paid price” here, you need the collection rows to expose paid price fields in
          <code className="mx-1 rounded bg-gray-50 px-1 py-0.5 text-xs">CollectionCardModel</code>
          (or load them separately).
        </div>
      </div>
    </div>
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

        // If this never resolves, we want an on-screen error, not a forever spinner.
        const data = await withTimeout(loadCollectionCards(), 12000, "loadCollectionCards()");

        if (!cancelled) setCards(data);
      } catch (e: any) {
        console.error("CollectionScreen load error:", e);

        if (!cancelled) {
          const msg = e?.message ?? "Failed to load collection.";
          setErr(msg);

          // If auth is the problem, open the AuthModal via page.tsx
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
      const want = filters.graded === "graded";
      list = list.filter((c) => {
        const isGraded = c?.condition?.mode === "graded";
        return want ? isGraded : !isGraded;
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

  const rightSummary = useMemo(() => {
    const uniqueItems = filtered.length;

    const totalCopies = filtered.reduce((acc, c) => acc + (Number(c?.copiesCount) || 0), 0);
    const duplicates = Math.max(0, totalCopies - uniqueItems);

    const gradedItems = filtered.reduce((acc, c) => acc + (c?.condition?.mode === "graded" ? 1 : 0), 0);

    const unknownCondition = filtered.reduce((acc, c) => {
      // If condition missing entirely, treat as unknown
      if (!c?.condition) return acc + 1;
      // If it’s graded but missing details, still not "unknown" from a UX POV
      // If you have a better "unknown" signal in your model, use it here.
      return acc;
    }, 0);

    return { uniqueItems, totalCopies, gradedItems, duplicates, unknownCondition };
  }, [filtered]);

  return (
    <section className="space-y-5">
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

      <CollectionSummary allCards={cards} filteredCards={filtered} loading={loading} />

      <div className="flex items-center gap-2">
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

      {/* 3-column desktop layout: Filters | Main | Right Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr_320px]">
        <aside className="rounded-2xl border bg-white p-4 h-fit sticky top-24">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold text-gray-900">Filters</div>
            {filtersActive ? (
              <span className="text-[11px] font-semibold text-gray-500">Active</span>
            ) : null}
          </div>

          <CollectionFilters value={filters} onChange={setFilters} />
        </aside>

        <div className="space-y-4">
          {tab === "items" ? (
            <>
              <CollectionToolbar query={q} onQueryChange={setQ} sort={sort} onSortChange={setSort} />
              <CollectionGrid items={filtered} loading={loading} emptyHint={emptyHint} />
            </>
          ) : tab === "minifigs" ? (
            <MinifigsScreen />
          ) : (
            <CollectionInsightsTab cards={cards} loading={loading} />
          )}
        </div>

        <aside>
          <RightCollectionPanel loading={loading} err={err} summary={rightSummary} />
        </aside>
      </div>
    </section>
  );
}
