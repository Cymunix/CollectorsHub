"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCollectionItem } from "../_hooks/useCollectionItem";
import CopiesList from "./CopiesList";
import { loadItemWorthCad } from "../_lib/worth";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type TabKey = "copies" | "variants" | "reviews" | "sales";

export default function CollectionItemScreen({ catalogItemId }: { catalogItemId: string }) {
  const router = useRouter();
  const { loading, err, item, photoUrl, copies, stats, refresh } = useCollectionItem(catalogItemId);

  const [worthCad, setWorthCad] = useState<number | null>(null);
  const [worthLoading, setWorthLoading] = useState(false);

  const [tab, setTab] = useState<TabKey>("copies");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!catalogItemId) return;
      setWorthLoading(true);
      const v = await loadItemWorthCad(catalogItemId);
      if (!cancelled) setWorthCad(v);
      if (!cancelled) setWorthLoading(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
              onClick={() => router.push("/collection")}
            >
              ← Back
            </button>

            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <div className="text-sm text-gray-500">Collection</div>
              <div className="text-gray-300">/</div>
              <div className="text-sm font-semibold truncate max-w-[40vw]">{title}</div>
            </div>

            <div className="sm:hidden text-sm font-semibold truncate max-w-[55vw]">{title}</div>
          </div>

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
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        {loading ? (
          <Card>Loading…</Card>
        ) : err ? (
          <Card tone="danger">{String(err)}</Card>
        ) : (
          <>
            {/* Hero */}
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
                    <Pill label="Copies" value={stats.total} />
                    <Pill label="Raw" value={stats.raw} />
                    <Pill label="Graded" value={stats.graded} />
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
                      onClick={() => router.push(`/catalog/${encodeURIComponent(catalogItemId)}`)}
                      title="Open the catalog page for this item"
                    >
                      Open catalog item
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
              {/* Main (Tabs + Content) */}
              <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b bg-white">
                  <div className="p-4 flex flex-wrap gap-2">
                    <TabButton label="Copies" active={tab === "copies"} onClick={() => setTab("copies")} />
                    <TabButton label="Variants" active={tab === "variants"} onClick={() => setTab("variants")} />
                    <TabButton label="Reviews" active={tab === "reviews"} onClick={() => setTab("reviews")} />
                    <TabButton label="Sales History" active={tab === "sales"} onClick={() => setTab("sales")} />
                  </div>
                </div>

                <div className="p-4">
                  {tab === "copies" && (
                    <div id="copies">
                      <CopiesList
                        catalogItemId={catalogItemId}
                        itemName={title}
                        copies={copies as any}
                        worthCad={worthCad}
                      />
                    </div>
                  )}

                  {tab === "variants" && (
                    <EmptyPanel
                      title="Variants"
                      body="This will mirror the Catalog variants tab: alternate versions, linked SKUs, regional releases, etc."
                    />
                  )}

                  {tab === "reviews" && (
                    <EmptyPanel
                      title="Reviews"
                      body="This will allow adding a review (rating + text), and show existing reviews."
                    />
                  )}

                  {tab === "sales" && (
                    <EmptyPanel
                      title="Sales History"
                      body="This will show sold comps / pricing history (date, price, source, link)."
                    />
                  )}
                </div>
              </div>

              {/* Right side */}
              <div className="space-y-5 lg:sticky lg:top-[78px]">
                <div className="rounded-3xl border bg-white shadow-sm p-5">
                  <div className="text-sm font-semibold">Value</div>
                  <div className="mt-2 text-sm text-gray-600">
                    {worthLoading ? (
                      "Loading value…"
                    ) : worthCad == null ? (
                      "No value data yet."
                    ) : (
                      <>
                        Estimated market value
                        <div className="mt-2 text-2xl font-semibold text-gray-900">${worthCad.toFixed(2)} CAD</div>
                        <div className="mt-1 text-xs text-gray-500">Based on catalog pricing data</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border bg-white shadow-sm p-5">
                  <div className="text-sm font-semibold">Quick notes</div>
                  <div className="mt-2 text-sm text-gray-600">
                    Each card is one copy you own. Minifigs are tracked per-copy via{" "}
                    <span className="font-mono text-xs">user_collection_item_minifigs</span>.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ children, tone }: { children: React.ReactNode; tone?: "danger" }) {
  const base = "rounded-3xl border p-6 text-sm shadow-sm";
  if (tone === "danger") return <div className={`${base} border-red-200 bg-red-50 text-red-700`}>{children}</div>;
  return <div className={`${base} bg-white text-gray-700`}>{children}</div>;
}

function Pill({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition",
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
      )}
    >
      {label}
    </button>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{body}</div>
    </div>
  );
}
