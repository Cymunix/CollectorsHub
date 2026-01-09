"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCollectionItem } from "../_hooks/useCollectionItem";
import { loadItemWorthCad } from "../_lib/worth";

import CopiesList from "./CopiesList";
import VariantsTab from "./VariantsTab";
import ReviewsTab from "./ReviewsTab";
import SalesHistoryTab from "./SalesHistoryTab";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type TabKey = "overview" | "copies" | "variants" | "reviews" | "sales";

function moneyCad(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

export default function CollectionItemScreen({ catalogItemId }: { catalogItemId: string }) {
  const router = useRouter();
  const { loading, err, item, photoUrl, copies, stats, refresh } = useCollectionItem(catalogItemId);

  const [tab, setTab] = useState<TabKey>("overview");

  const [worthCad, setWorthCad] = useState<number | null>(null);
  const [worthLoading, setWorthLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!catalogItemId) return;
      setWorthLoading(true);
      try {
        const v = await loadItemWorthCad(catalogItemId);
        if (!cancelled) setWorthCad(v);
      } finally {
        if (!cancelled) setWorthLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const title = item?.name?.trim() || "Untitled item";

  const subtitle = useMemo(() => {
    const total = stats.total;
    if (!total) return "No copies yet";
    return `${total} copy${total === 1 ? "" : "ies"} • ${stats.raw} raw • ${stats.graded} graded`;
  }, [stats]);

  const tabs = useMemo(
    () =>
      [
        { key: "overview" as const, label: "Overview" },
        { key: "copies" as const, label: "Copies" },
        { key: "variants" as const, label: "Variants" },
        { key: "reviews" as const, label: "Reviews" },
        { key: "sales" as const, label: "Sales History" },
      ] as const,
    []
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-3xl border bg-white p-6 text-sm text-gray-600">Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{String(err)}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 space-y-5">
      {/* Top nav row */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => router.push("/collection")}
        >
          ← Back
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              loading ? "border bg-gray-100 text-gray-500" : "border bg-white hover:bg-gray-50"
            )}
            onClick={refresh}
            disabled={loading}
          >
            Refresh
          </button>

          <button
            type="button"
            className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => router.push(`/catalog/${encodeURIComponent(catalogItemId)}`)}
            title="Open the catalog page for this item"
          >
            Open catalog item →
          </button>
        </div>
      </div>

      {/* Hero (catalog-style) */}
      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
          <div className="bg-slate-50">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={title} className="h-full w-full object-cover aspect-[4/3]" />
            ) : (
              <div className="aspect-[4/3] flex items-center justify-center text-xs text-gray-400">No photo</div>
            )}
          </div>

          <div className="p-6">
            <div className="text-2xl font-semibold tracking-tight">{title}</div>
            <div className="mt-1 text-sm text-gray-500">{subtitle}</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Chip label="Copies" value={String(stats.total)} />
              <Chip label="Raw" value={String(stats.raw)} />
              <Chip label="Graded" value={String(stats.graded)} />
              <Chip label="Value" value={worthLoading ? "Loading…" : worthCad == null ? "—" : moneyCad(worthCad)} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90"
                onClick={() => setTab("copies")}
              >
                View copies
              </button>

              <button
                type="button"
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => setTab("overview")}
              >
                Overview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs (catalog-style) */}
      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-white">
          <div className="p-4 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition",
                  tab === t.key ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === "overview" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded-2xl border bg-gray-50 p-4">
                <div className="text-lg font-semibold">At a glance</div>
                <div className="mt-1 text-sm text-gray-600">
                  This is your collection view of the item: what you own, what it’s worth, and what’s included per copy.
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Stat label="Copies" value={String(stats.total)} />
                  <Stat label="Raw" value={String(stats.raw)} />
                  <Stat label="Graded" value={String(stats.graded)} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Estimated value</div>
                  <div className="mt-2 text-sm text-gray-600">
                    {worthLoading ? (
                      "Loading…"
                    ) : worthCad == null ? (
                      "No value data yet."
                    ) : (
                      <>
                        <div className="text-2xl font-semibold text-gray-900">{moneyCad(worthCad)}</div>
                        <div className="mt-1 text-xs text-gray-500">Based on catalog pricing data</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Next actions</div>
                  <div className="mt-2 text-sm text-gray-600">
                    Use <span className="font-semibold">Copies</span> to manage each copy’s condition and included items.
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "copies" && (
            <CopiesList
              catalogItemId={catalogItemId}
              itemName={title}
              copies={copies as any}
              worthCad={worthCad}
              itemKind={(item as any)?.kind ?? null}
            />
          )}

          {tab === "variants" && <VariantsTab catalogItemId={catalogItemId} />}
          {tab === "reviews" && <ReviewsTab catalogItemId={catalogItemId} />}
          {tab === "sales" && <SalesHistoryTab catalogItemId={catalogItemId} />}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
