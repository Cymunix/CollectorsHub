"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// These are in /components/collection per your tree screenshot
import Header from "@/components/collection/Header";
import SecondaryNav from "@/components/collection/SecondaryNav";

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

  const [primary, setPrimary] = useState<CollectionItemRow | null>(null);
  const [copies, setCopies] = useState<CollectionItemRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItemRow | null>(null);

  const [tab, setTab] = useState<TabKey>("overview");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!catalogItemId) {
        setErr("Missing catalog item id in the route.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) {
          if (!cancelled) {
            setErr("You must be signed in to view this item.");
            setLoading(false);
          }
          return;
        }

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

        if (!cancelled) {
          setCatalog(catRow as CatalogItemRow);
          setCopies(rows);
          setPrimary(rows[0]);
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
    const score = primary?.graded_score ?? null;
    if (typeof score === "number") return `Graded: ${score}`;
    return labelCondition(primary?.condition ?? null);
  }, [primary?.condition, primary?.graded_score]);

  return (
    <div className="min-h-screen">
      <Header />
      <SecondaryNav />

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">Loading…</div>
        ) : err ? (
          <div>
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
        ) : !catalog || !primary ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
            Missing data to render this page.
          </div>
        ) : (
          <>
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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
              {/* Left */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
                    Overview
                  </TabButton>
                  <TabButton active={tab === "copies"} onClick={() => setTab("copies")}>
                    Copies ({copies.length})
                  </TabButton>
                </div>

                {tab === "overview" ? (
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">Description</div>
                    <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {catalog.description?.trim() ? catalog.description : "No description."}
                    </div>
                  </div>
                ) : null}

                {tab === "copies" ? (
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">Your copies</div>
                    <div className="mt-3 space-y-3">
                      {copies.map((c, idx) => {
                        const isPrimary = c.id === primary.id;
                        const score = c.graded_score ?? null;
                        const condition =
                          typeof score === "number" ? `Graded: ${score}` : labelCondition(c.condition);

                        return (
                          <div key={c.id} className="rounded-2xl border p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900">
                                  Copy {idx + 1}{" "}
                                  {isPrimary ? (
                                    <span className="text-xs text-gray-500">(primary)</span>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-sm text-gray-700">{condition}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-gray-900">
                                  {money(c.paid_price)}
                                </div>
                                <div className="text-xs text-gray-500">Paid</div>
                              </div>
                            </div>

                            {c.notes?.trim() ? (
                              <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                                {c.notes}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Right */}
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
                      <div className="font-medium text-gray-900">{money(primary.paid_price)}</div>
                    </div>
                  </div>

                  {primary.notes?.trim() ? (
                    <>
                      <div className="mt-4 text-sm font-semibold text-gray-900">Notes</div>
                      <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {primary.notes}
                      </div>
                    </>
                  ) : null}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
