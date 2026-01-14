"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// IMPORTANT:
// If your MinifigPanel import path differs, adjust it.
// If you don't want minifigs at all on this page yet, delete this import + usage.
import MinifigPanel from "./_components/MinifigPanel";

type CollectionItemRow = {
  id: string;
  user_id?: string | null;
  catalog_item_id: string | null;

  condition?: string | null;
  graded_score?: number | null;
  paid_price?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

type CatalogItemRow = {
  id: string;
  name: string | null;
  kind: string | null;

  description?: string | null;
  release_year?: number | null;

  franchise_id?: string | null;
  manufacturer_id?: string | null;
  publisher_id?: string | null;

  // LEGO-ish optional fields (won’t break if absent)
  set_number?: string | null;
};

type TabKey = "overview" | "copies";

function money(n: number | null | undefined) {
  const v = typeof n === "number" ? n : 0;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);
}

function labelCondition(condition: string | null | undefined) {
  if (!condition) return "Not set";
  const map: Record<string, string> = {
    complete: "Complete",
    sealed: "Sealed",
    used: "Used",
    new: "New",
    damaged: "Damaged",
  };
  return map[condition] ?? condition;
}

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
        "rounded-full px-4 py-2 text-sm transition",
        active ? "bg-gray-900 text-white" : "border bg-white text-gray-800 hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function CollectionItemPage() {
  const params = useParams();
  const router = useRouter();
  const catalogItemId = String(params?.catalogItemId ?? "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [item, setItem] = useState<CollectionItemRow | null>(null);
  const [catalog, setCatalog] = useState<CatalogItemRow | null>(null);
  const [copies, setCopies] = useState<CollectionItemRow[]>([]);
  const [tab, setTab] = useState<TabKey>("overview");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!catalogItemId) {
        setErr("Missing catalog item id in route.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        // 1) Must be signed in
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!user) {
          if (!cancelled) {
            setErr("You must be signed in to view this page.");
            setLoading(false);
          }
          return;
        }

        // 2) Load the user's collection item row for this catalog item
        // If you allow multiple copies, there will be multiple rows.
        // We'll pick the oldest as "primary", and show the rest in Copies tab.
        const { data: ownedRows, error: ownedErr } = await supabase
          .from("user_collection_items")
          .select("*")
          .eq("user_id", user.id)
          .eq("catalog_item_id", catalogItemId)
          .order("created_at", { ascending: true });

        if (ownedErr) throw ownedErr;

        const rows = (ownedRows ?? []) as CollectionItemRow[];
        if (rows.length === 0) {
          if (!cancelled) {
            setErr("You don’t have this item in your collection.");
            setLoading(false);
          }
          return;
        }

        const primary = rows[0];

        // 3) Load catalog row
        const { data: catRow, error: catErr } = await supabase
          .from("catalog_items")
          .select("*")
          .eq("id", catalogItemId)
          .maybeSingle();

        if (catErr) throw catErr;

        if (!catRow) {
          if (!cancelled) {
            setErr("Catalog item not found.");
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setItem(primary);
          setCatalog(catRow as CatalogItemRow);
          setCopies(rows);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message ?? "Failed to load this page.");
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const title = catalog?.name ?? "Collection item";
  const kind = catalog?.kind ?? null;

  const conditionDisplay = useMemo(() => {
    const score = item?.graded_score ?? null;
    if (typeof score === "number") return `Graded: ${score}`;
    return labelCondition(item?.condition ?? null);
  }, [item?.condition, item?.graded_score]);

  // HARD GATE: don't show minifigs unless it makes sense
  const showMinifigs = useMemo(() => {
    return kind === "building_blocks" || kind === "minifig";
  }, [kind]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4">
          <button
            className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            onClick={() => router.back()}
          >
            Back
          </button>
        </div>
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-sm font-semibold text-gray-900">Can’t load item</div>
          <div className="mt-2 text-sm text-gray-700">{err}</div>
        </div>
      </div>
    );
  }

  if (!item || !catalog) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
          Missing data to render this page.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 truncate">{title}</h1>
          <div className="mt-1 text-sm text-gray-600">
            {kind ? kind : "unknown"}
            {catalog.release_year ? ` • ${catalog.release_year}` : ""}
            {catalog.set_number ? ` • Set ${catalog.set_number}` : ""}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href="/collection"
              className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              Back to collection
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">Condition</div>
          <div className="text-sm font-semibold text-gray-900">{conditionDisplay}</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
              Overview
            </TabButton>
            <TabButton active={tab === "copies"} onClick={() => setTab("copies")}>
              Copies ({copies.length})
            </TabButton>
          </div>

          {/* Overview */}
          {tab === "overview" ? (
            <div className="space-y-4">
              {/* Kind-specific panels */}
              {showMinifigs ? (
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold text-gray-900">Minifigs</div>

                  {/* IMPORTANT:
                      We do NOT pass hideIfEmpty here. That prop does not exist and will fail your build.
                      If you want it, you add it to MinifigPanel properly later.
                   */}
                  <div className="mt-3">
                    <MinifigPanel userCollectionItemId={item.id} />
                  </div>
                </div>
              ) : null}

              {/* Description */}
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Description</div>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                  {catalog.description?.trim() ? catalog.description : "No description."}
                </div>
              </div>
            </div>
          ) : null}

          {/* Copies */}
          {tab === "copies" ? (
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Your copies</div>

              {copies.length === 0 ? (
                <div className="mt-2 text-sm text-gray-700">No copies found.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {copies.map((c, idx) => {
                    const isPrimary = c.id === item.id;
                    const score = c.graded_score ?? null;
                    const condition = typeof score === "number" ? `Graded: ${score}` : labelCondition(c.condition);

                    return (
                      <div key={c.id} className="rounded-2xl border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">
                              Copy {idx + 1}{" "}
                              {isPrimary ? <span className="text-xs text-gray-500">(primary)</span> : null}
                            </div>
                            <div className="mt-1 text-sm text-gray-700">{condition}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">{money(c.paid_price)}</div>
                            <div className="text-xs text-gray-500">Paid</div>
                          </div>
                        </div>

                        {c.notes?.trim() ? (
                          <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{c.notes}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Right panel */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Ownership</div>

            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-gray-600">Condition</div>
                <div className="font-medium text-gray-900">{conditionDisplay}</div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-gray-600">Paid</div>
                <div className="font-medium text-gray-900">{money(item.paid_price)}</div>
              </div>
            </div>

            {item.notes?.trim() ? (
              <>
                <div className="mt-4 text-sm font-semibold text-gray-900">Notes</div>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{item.notes}</div>
              </>
            ) : null}
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Actions</div>
            <div className="mt-2 text-sm text-gray-700">
              Wire edit/remove actions here when you’re ready.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
