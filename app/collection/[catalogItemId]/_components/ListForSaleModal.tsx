"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createMarketplaceListing, saveListingMinifigs } from "../_lib/marketplace";

type MinifigRow = {
  minifig_id: string;
  included_qty: number;
  catalog_minifigs: { name: string | null; minifig_number: string | null; image_url: string | null } | null;
};

function clampQty(v: any) {
  const n = Math.floor(Number(v ?? 0));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function isAuthishError(e: any) {
  const s = String(e?.message ?? e ?? "").toLowerCase();
  return (
    s.includes("jwt") ||
    s.includes("not authenticated") ||
    s.includes("auth") ||
    s.includes("permission") ||
    s.includes("row level security") ||
    s.includes("rls")
  );
}

export default function ListForSaleModal(props: {
  open: boolean;
  onClose: () => void;
  catalogItemId: string;
  userCollectionItemId: string;
  itemName: string;
  defaultPriceCad: number;
  onRequireAuth?: () => void; // ✅ NEW
}) {
  const { open, onClose, catalogItemId, userCollectionItemId, itemName, defaultPriceCad, onRequireAuth } = props;

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

      setErr(null);
      setLoading(true);

      try {
        // Quick auth check so we can open the modal prompt cleanly
        const { data: auth } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!auth?.user) {
          onRequireAuth?.();
          throw new Error("Not authenticated");
        }

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
        if (cancelled) return;

        if (isAuthishError(e)) onRequireAuth?.();
        setErr(e?.message || "Failed to load minifigs");
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, userCollectionItemId, onRequireAuth]);

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
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        onRequireAuth?.();
        throw new Error("Not authenticated");
      }

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
      if (isAuthishError(e)) onRequireAuth?.();
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
                                setRows((prev) =>
                                  prev.map((x) => (x.minifig_id === r.minifig_id ? { ...x, include: v } : x))
                                );
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
                              setRows((prev) =>
                                prev.map((x) => (x.minifig_id === r.minifig_id ? { ...x, qty: n } : x))
                              );
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
