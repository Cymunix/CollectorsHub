"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// -----------------------
// Types (keep them loose-ish so it doesn't explode on minor schema drift)
// -----------------------
type CollectionItemRow = {
  id: string;
  catalog_item_id: string | null;

  // ownership fields (names based on what you've described; adapt if yours differ)
  condition?: string | null; // e.g. "complete", "sealed", "used"
  graded_score?: number | null; // only if graded
  paid_price?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

type CatalogItemRow = {
  id: string;
  name: string | null;
  kind: string | null; // "building_blocks" | "trading_card" | etc

  description?: string | null;
  release_year?: number | null;

  // common ids
  franchise_id?: string | null;
  manufacturer_id?: string | null;
  publisher_id?: string | null;

  // lego-ish / extra fields (optional)
  set_number?: string | null;
  theme_id?: string | null;
  subtheme_id?: string | null;
};

// -----------------------
// UI helpers
// -----------------------
function money(n: number | null | undefined) {
  const v = typeof n === "number" ? n : 0;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);
}

function labelCondition(condition: string | null | undefined) {
  if (!condition) return "Not set";
  // Map your enums to human labels if needed
  const map: Record<string, string> = {
    complete: "Complete",
    sealed: "Sealed",
    used: "Used",
    new: "New",
    damaged: "Damaged",
    // add more as needed
  };
  return map[condition] ?? condition;
}

function KindPill({ kind }: { kind: string | null }) {
  const text = kind ?? "unknown";
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-xs text-gray-700">
      {text}
    </span>
  );
}

type TabKey = "overview" | "copies";

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

// -----------------------
// Page
// -----------------------
export default function CollectionItemPage() {
  const params = useParams();
  const router = useRouter();
  const collectionItemId = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [owned, setOwned] = useState<CollectionItemRow | null>(null);
  const [catalog, setCatalog] = useState<CatalogItemRow | null>(null);

  const [copies, setCopies] = useState<CollectionItemRow[]>([]);
  const [tab, setTab] = useState<TabKey>("overview");

  // Lookups (optional; you can wire these properly later)
  const [franchiseName, setFranchiseName] = useState<string | null>(null);
  const [makerName, setMakerName] = useState<string | null>(null);
  const [publisherName, setPublisherName] = useState<string | null>(null);

  // 1) Load core rows
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!collectionItemId) return;

      setLoading(true);
      setErr(null);

      // NOTE:
      // - user_collection_items is assumed as table name; change if yours differs.
      // - We fetch the collection item, then the linked catalog item.
      try {
        const { data: ownedRow, error: ownedErr } = await supabase
          .from("user_collection_items")
          .select("*")
          .eq("id", collectionItemId)
          .maybeSingle();

        if (ownedErr) throw ownedErr;
        if (!ownedRow) {
          if (!cancelled) {
            setOwned(null);
            setCatalog(null);
            setCopies([]);
            setErr("Collection item not found.");
            setLoading(false);
          }
          return;
        }

        const ownedTyped = ownedRow as CollectionItemRow;

        if (!ownedTyped.catalog_item_id) {
          if (!cancelled) {
            setOwned(ownedTyped);
            setCatalog(null);
            setCopies([]);
            setErr("This collection item is missing catalog_item_id.");
            setLoading(false);
          }
          return;
        }

        const { data: catalogRow, error: catErr } = await supabase
          .from("catalog_items")
          .select("*")
          .eq("id", ownedTyped.catalog_item_id)
          .maybeSingle();

        if (catErr) throw catErr;

        if (!cancelled) {
          setOwned(ownedTyped);
          setCatalog((catalogRow ?? null) as CatalogItemRow | null);
        }

        // 2) Load "copies" tab data:
        // If you model multiple copies as multiple rows pointing to same catalog_item_id,
        // then this is the correct query.
        const { data: copyRows, error: copiesErr } = await supabase
          .from("user_collection_items")
          .select("*")
          .eq("catalog_item_id", ownedTyped.catalog_item_id)
          .order("created_at", { ascending: true });

        if (copiesErr) throw copiesErr;

        if (!cancelled) {
          setCopies((copyRows ?? []) as CollectionItemRow[]);
        }

        // 3) Optional lookups: franchise/manufacturer/publisher
        // This is deliberately defensive because your publisher tables vary by kind.
        // If you unify publishers/manufacturers later, this gets simpler.

        if (catalogRow) {
          const cat = catalogRow as CatalogItemRow;

          // Franchise (assumes a unified franchises table)
          if (cat.franchise_id) {
            const { data, error } = await supabase
              .from("franchises")
              .select("name")
              .eq("id", cat.franchise_id)
              .maybeSingle();
            if (!cancelled && !error) setFranchiseName((data as any)?.name ?? null);
          }

          // Manufacturer (assumes unified manufacturers table)
          if (cat.manufacturer_id) {
            const { data, error } = await supabase
              .from("manufacturers")
              .select("name")
              .eq("id", cat.manufacturer_id)
              .maybeSingle();
            if (!cancelled && !error) setMakerName((data as any)?.name ?? null);
          }

          // Publisher (you said yours is split: game_publishers, comic_publishers, etc.)
          // We'll pick table based on kind. Add cases as you need.
          if (cat.publisher_id && cat.kind) {
            const kind = cat.kind;
            let table: string | null = null;

            if (kind === "gaming") table = "game_publishers";
            else if (kind === "comic") table = "comic_publishers";
            else if (kind === "movie") table = "movie_publishers";
            else if (kind === "music") table = "music_publishers";
            else table = null;

            if (table) {
              const { data, error } = await supabase
                .from(table)
                .select("name")
                .eq("id", cat.publisher_id)
                .maybeSingle();
              if (!cancelled && !error) setPublisherName((data as any)?.name ?? null);
            } else {
              if (!cancelled) setPublisherName(null);
            }
          }
        }

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message ?? "Failed to load collection item.");
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [collectionItemId]);

  const title = catalog?.name ?? "Collection item";
  const kind = catalog?.kind ?? null;

  const conditionDisplay = useMemo(() => {
    // Do not map to a score unless graded_score exists (or you add a graded flag)
    const score = owned?.graded_score ?? null;
    if (typeof score === "number") return `Graded: ${score}`;
    return labelCondition(owned?.condition ?? null);
  }, [owned?.condition, owned?.graded_score]);

  const metaLine = useMemo(() => {
    const bits: string[] = [];

    if (franchiseName) bits.push(franchiseName);
    if (publisherName) bits.push(publisherName);
    if (makerName) bits.push(makerName);
    if (catalog?.release_year) bits.push(String(catalog.release_year));

    return bits.length ? bits.join(" • ") : null;
  }, [franchiseName, publisherName, makerName, catalog?.release_year]);

  // Hard gate: never render wrong-kind sections
  function renderKindSpecific() {
    if (!catalog) return null;

    switch (catalog.kind) {
      case "building_blocks":
        return (
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Building blocks details</div>
            <div className="mt-2 text-sm text-gray-700 space-y-1">
              {catalog.set_number ? <div>Set number: {catalog.set_number}</div> : null}
              {/* Add theme/subtheme once you wire lookups */}
            </div>
          </div>
        );

      case "minifig":
        return (
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Minifig details</div>
            <div className="mt-2 text-sm text-gray-700">
              {/* Put minifig fields here, but ONLY here */}
              This section only renders for kind === "minifig".
            </div>
          </div>
        );

      case "trading_card":
      case "sports_card":
        return (
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Card details</div>
            <div className="mt-2 text-sm text-gray-700">
              {/* card fields here */}
              Add card set, number, etc.
            </div>
          </div>
        );

      case "comic":
        return (
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Comic details</div>
            <div className="mt-2 text-sm text-gray-700">
              {/* comic fields here */}
              Publisher is shown from the correct publisher table.
            </div>
          </div>
        );

      default:
        return (
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Item details</div>
            <div className="mt-2 text-sm text-gray-700">
              No kind-specific panel configured for: {catalog.kind ?? "unknown"}.
            </div>
          </div>
        );
    }
  }

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

  if (!owned || !catalog) {
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 truncate">{title}</h1>
            <KindPill kind={kind} />
          </div>
          {metaLine ? <div className="mt-1 text-sm text-gray-600">{metaLine}</div> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href="/collection"
              className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              Back to collection
            </Link>

            {/* Add your actions here (edit, remove, etc.) */}
          </div>
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

          {tab === "overview" ? (
            <div className="space-y-4">
              {renderKindSpecific()}

              {/* Description */}
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Description</div>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                  {catalog.description?.trim() ? catalog.description : "No description."}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "copies" ? (
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Your copies</div>

              {copies.length === 0 ? (
                <div className="mt-2 text-sm text-gray-700">No copies found.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {copies.map((c, idx) => {
                    const isThis = c.id === owned.id;
                    const score = c.graded_score ?? null;
                    const condition = typeof score === "number" ? `Graded: ${score}` : labelCondition(c.condition);

                    return (
                      <div key={c.id} className="rounded-2xl border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">
                              Copy {idx + 1} {isThis ? <span className="text-xs text-gray-500">(current)</span> : null}
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

                        {/* If you want each copy clickable, point it to its own /collection/[id] */}
                        {!isThis ? (
                          <div className="mt-2">
                            <Link
                              href={`/collection/${c.id}`}
                              className="inline-flex rounded-full border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
                            >
                              Open
                            </Link>
                          </div>
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
                <div className="font-medium text-gray-900">{money(owned.paid_price)}</div>
              </div>
            </div>

            {owned.notes?.trim() ? (
              <>
                <div className="mt-4 text-sm font-semibold text-gray-900">Notes</div>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{owned.notes}</div>
              </>
            ) : null}
          </div>

          {/* Placeholder: future actions */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Actions</div>
            <div className="mt-2 text-sm text-gray-700">
              Add edit/remove buttons here once your edit flow is ready.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
