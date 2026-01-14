"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";

// same folder pattern as your ItemDescription
import ItemDescription from "../../catalog/[id]/blocks/item_description";
import ItemImage from "../../catalog/[id]/blocks/item_image";

// ✅ Reviews + marketplace helpers (as you provided)
import { fetchItemReviews, insertItemReview } from "../_lib/queries";
import type { ReviewRow } from "../_lib/queries";

import { createMarketplaceListing, saveListingMinifigs } from "../_lib/marketplace";

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

type TabKey = "overview" | "copies" | "reviews";

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

/* ----------------------------
   REVIEWS TAB (inline)
----------------------------- */
function clampRating(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 5;
  return Math.max(1, Math.min(5, Math.round(x)));
}

function Stars({ n }: { n: number }) {
  const stars = Array.from({ length: 5 }, (_, i) => (i < n ? "★" : "☆"));
  return <div className="text-sm leading-none">{stars.join("")}</div>;
}

function ReviewsTab({ catalogItemId }: { catalogItemId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);

  // add form
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchItemReviews(catalogItemId);
      setRows(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!catalogItemId) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId]);

  const avg = useMemo(() => {
    if (rows.length === 0) return null;
    const sum = rows.reduce((s, r) => s + (Number(r.rating) || 0), 0);
    return Math.round((sum / rows.length) * 10) / 10;
  }, [rows]);

  async function onSubmit() {
    setErr(null);
    setSavedMsg(null);

    const r = clampRating(rating);
    const t = title.trim();
    const b = body.trim();

    if (!b) {
      setErr("Write something in the review body.");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw new Error(error.message);
      const userId = data?.user?.id;
      if (!userId) throw new Error("You must be signed in to post a review.");

      await insertItemReview({
        catalogItemId,
        userId,
        rating: r,
        title: t || null,
        body: b,
      });

      setTitle("");
      setBody("");
      setRating(5);
      setSavedMsg("Review added.");
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Reviews</div>
          <div className="text-sm text-gray-500">
            {avg ? (
              <>
                Average: <span className="font-medium text-gray-800">{avg}</span> / 5 • {rows.length} review
                {rows.length === 1 ? "" : "s"}
              </>
            ) : (
              "No reviews yet."
            )}
          </div>
        </div>
      </div>

      {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {savedMsg && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{savedMsg}</div>
      )}

      {/* Add review */}
      <div className="mt-4 rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Add a review</div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-xs text-gray-500">Rating</label>
            <select
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              <option value={5}>5 — Amazing</option>
              <option value={4}>4 — Good</option>
              <option value={3}>3 — Okay</option>
              <option value={2}>2 — Meh</option>
              <option value={1}>1 — Bad</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">Title (optional)</label>
            <input
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short headline"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs text-gray-500">Review</label>
            <textarea
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you like? What should people watch for?"
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium",
              saving ? "bg-gray-200 text-gray-600" : "bg-gray-900 text-white hover:bg-black",
            ].join(" ")}
          >
            {saving ? "Saving..." : "Post review"}
          </button>
        </div>
      </div>

      {/* Review list */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-20 rounded-2xl bg-gray-100" />
            <div className="h-20 rounded-2xl bg-gray-100" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-600">Be the first to review this item.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stars n={clampRating(r.rating)} />
                    <div className="font-semibold">{r.title?.trim() ? r.title : "Review"}</div>
                  </div>
                  <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                {r.body && <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{r.body}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------
   LIST FOR SALE MODAL (inline)
----------------------------- */
type MinifigRow = {
  minifig_id: string;
  included_qty: number;
  catalog_minifigs: { name: string | null; minifig_number: string | null; image_url: string | null } | null;
};

function clampQty(v: any) {
  const n = Math.floor(Number(v ?? 0));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function ListForSaleModal(props: {
  open: boolean;
  onClose: () => void;
  catalogItemId: string;
  userCollectionItemId: string;
  itemName: string;
  defaultPriceCad: number;
}) {
  const { open, onClose, catalogItemId, userCollectionItemId, itemName, defaultPriceCad } = props;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [price, setPrice] = useState<string>(String(defaultPriceCad ?? 0));
  const [rows, setRows] = useState<
    Array<{ minifig_id: string; name: string; number: string | null; image_url: string | null; include: boolean; qty: number }>
  >([]);

  // load per-copy minifigs so you can choose which are included in the listing
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!open) return;
      if (!userCollectionItemId) return;

      setErr(null);
      setLoading(true);

      try {
        const res = await supabase
          .from("user_collection_item_minifigs")
          .select(
            `
            minifig_id,
            included_qty,
            catalog_minifigs (
              name,
              minifig_number,
              image_url
            )
          `
          )
          .eq("user_collection_item_id", userCollectionItemId)
          .order("created_at", { ascending: true });

        if (res.error) throw res.error;

        const data = (res.data ?? []) as any as MinifigRow[];
        const mapped = data.map((r) => {
          const m = (r as any).catalog_minifigs;
          const name = (m?.name ?? "Unknown minifig") as string;
          const number = (m?.minifig_number ?? null) as string | null;
          const img = (m?.image_url ?? null) as string | null;

          // default include = whatever is included in the copy
          const qty = clampQty((r as any).included_qty);
          return {
            minifig_id: String((r as any).minifig_id),
            name,
            number,
            image_url: img,
            include: qty > 0,
            qty: qty > 0 ? qty : 1,
          };
        });

        if (!cancelled) setRows(mapped);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load minifigs");
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, userCollectionItemId]);

  useEffect(() => {
    if (!open) return;
    setPrice(String(defaultPriceCad ?? 0));
  }, [open, defaultPriceCad]);

  const selected = useMemo(() => rows.filter((r) => r.include), [rows]);
  const priceNum = useMemo(() => {
    const n = Number(price);
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
  }, [price]);

  async function submit() {
    setErr(null);

    if (priceNum <= 0) {
      setErr("Price must be greater than 0.");
      return;
    }

    setLoading(true);
    try {
      const listing = await createMarketplaceListing({
        userCollectionItemId,
        catalogItemId,
        title: itemName,
        priceCad: priceNum,
        description: null,
      });

      await saveListingMinifigs({
        listingId: listing.id,
        rows: selected.map((r) => ({ minifig_id: r.minifig_id, included_qty: clampQty(r.qty) || 1 })),
      });

      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to create listing");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-2xl rounded-3xl border bg-white shadow-xl overflow-hidden">
        <div className="p-5 border-b">
          <div className="text-lg font-semibold">List for sale</div>
          <div className="text-sm text-gray-500 truncate">{itemName}</div>
        </div>

        <div className="p-5 space-y-4">
          {err ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
          ) : null}

          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Price (CAD)</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-600">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className="w-40 rounded-xl border px-3 py-2 text-sm bg-white"
                value={price}
                disabled={loading}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Included minifigs</div>
              <div className="text-xs text-gray-500">{selected.length} selected</div>
            </div>

            {loading ? (
              <div className="mt-2 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="mt-2 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
                No minifigs attached to this copy.
              </div>
            ) : (
              <div className="mt-2 rounded-3xl border bg-white overflow-hidden">
                {rows.map((r) => (
                  <div key={r.minifig_id} className="px-5 py-4 border-b last:border-b-0">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-2xl border bg-slate-50 overflow-hidden flex items-center justify-center">
                        {r.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{r.name}</div>
                            <div className="text-xs text-gray-500">{r.number ? `#${r.number}` : "No number"}</div>
                          </div>

                          <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={r.include}
                              disabled={loading}
                              onChange={(e) => {
                                const v = e.target.checked;
                                setRows((prev) => prev.map((x) => (x.minifig_id === r.minifig_id ? { ...x, include: v } : x)));
                              }}
                            />
                            Include
                          </label>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Qty</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            className="w-24 rounded-xl border px-3 py-1.5 text-sm disabled:bg-gray-50"
                            value={r.qty}
                            disabled={loading || !r.include}
                            onChange={(e) => {
                              const n = Math.max(1, clampQty(e.target.value));
                              setRows((prev) => prev.map((x) => (x.minifig_id === r.minifig_id ? { ...x, qty: n } : x)));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t bg-white flex items-center justify-between">
          <button
            type="button"
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60"
            onClick={submit}
            disabled={loading}
          >
            Create listing
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------
   PAGE
----------------------------- */
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

  // listing modal state
  const [listOpen, setListOpen] = useState(false);
  const [listCopy, setListCopy] = useState<CollectionItemRow | null>(null);

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

        const { data: catRow, error: catErr } = await supabase.from("catalog_items").select("*").eq("id", catalogItemId).maybeSingle();
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

  function openListForSale(copy: CollectionItemRow) {
    setListCopy(copy);
    setListOpen(true);
  }

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
              <button className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-gray-50" onClick={() => router.back()}>
                Back
              </button>
            </div>
            <div className="rounded-2xl border bg-white p-6">
              <div className="text-sm font-semibold text-gray-900">Can’t load item</div>
              <div className="mt-2 text-sm text-gray-700">{err}</div>
            </div>
          </div>
        ) : !catalog || !primary ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">Missing data to render this page.</div>
        ) : (
          <>
            {/* Listing modal */}
            <ListForSaleModal
              open={listOpen}
              onClose={() => {
                setListOpen(false);
                setListCopy(null);
              }}
              catalogItemId={catalog.id}
              userCollectionItemId={listCopy?.id ?? ""}
              itemName={title}
              defaultPriceCad={listCopy?.paid_price ?? 0}
            />

            {/* Header */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex gap-4">
                {/* IMAGE */}
                <div className="w-[120px] shrink-0">
                  <ItemImage catalogItemId={catalog.id} itemName={title} />
                </div>

                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold text-gray-900 truncate">{title}</h1>
                  <div className="mt-1 text-sm text-gray-600">
                    {kind ?? "unknown"}
                    {catalog.release_year ? ` • ${catalog.release_year}` : ""}
                    {catalog.set_number ? ` • Set ${catalog.set_number}` : ""}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href="/collection" className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-gray-50">
                      Back to collection
                    </Link>
                  </div>
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
                  <TabButton active={tab === "reviews"} onClick={() => setTab("reviews")}>
                    Reviews
                  </TabButton>
                </div>

                {tab === "overview" && <ItemDescription catalogItemId={catalog.id} isAdmin={false} />}

                {tab === "reviews" && <ReviewsTab catalogItemId={catalog.id} />}

                {tab === "copies" && (
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">Your copies</div>

                    <div className="mt-3 space-y-3">
                      {copies.map((c, idx) => {
                        const isPrimary = c.id === primary.id;
                        const score = c.graded_score ?? null;
                        const condition = typeof score === "number" ? `Graded: ${score}` : labelCondition(c.condition);

                        return (
                          <div key={c.id} className="rounded-2xl border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900">
                                  Copy {idx + 1}{" "}
                                  {isPrimary && <span className="text-xs text-gray-500">(primary)</span>}
                                </div>
                                <div className="mt-1 text-sm text-gray-700">{condition}</div>

                                {/* actions */}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openListForSale(c)}
                                    className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black"
                                  >
                                    List for sale
                                  </button>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm font-semibold text-gray-900">{money(c.paid_price)}</div>
                                <div className="text-xs text-gray-500">Paid</div>
                              </div>
                            </div>

                            {c.notes?.trim() && (
                              <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{c.notes}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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

                  {primary.notes?.trim() && (
                    <>
                      <div className="mt-4 text-sm font-semibold text-gray-900">Notes</div>
                      <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{primary.notes}</div>
                    </>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
