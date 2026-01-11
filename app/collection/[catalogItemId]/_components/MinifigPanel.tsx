"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CatalogMinifig = {
  id: string;
  name: string | null;
  minifig_number: string | null;
  image_url: string | null;
};

type Row = {
  id: string;
  user_collection_item_id: string;
  minifig_id: string;
  included: boolean;
  included_qty: number;
  notes: string | null;
  created_at: string;

  // Supabase join can be object OR array depending on relationship metadata
  catalog_minifigs: CatalogMinifig | CatalogMinifig[] | null;
};

function asMinifig(m: Row["catalog_minifigs"]): CatalogMinifig | null {
  if (!m) return null;
  if (Array.isArray(m)) return (m[0] as any) ?? null;
  return m as any;
}

function clampQty(v: any) {
  const n = Math.floor(Number(v ?? 0));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normalizeStorageUrl(
  raw: string | null,
  bucketEnvKey: string,
  fallbackBucket: string
): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  const bucket =
    (process.env[bucketEnvKey] as string | undefined) ?? fallbackBucket;
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(s);
    return data?.publicUrl ?? null;
  } catch {
    return s;
  }
}

export default function MinifigPanel({
  userCollectionItemId,
  readOnly = false,
  hideIfEmpty = true,
  title = "Minifigs",
}: {
  userCollectionItemId: string;
  readOnly?: boolean;

  /**
   * If true (default), renders NOTHING when there are zero minifig rows.
   * This prevents non-LEGO items from showing "Minifigs" / "No minifigs…" noise.
   */
  hideIfEmpty?: boolean;

  /**
   * Optional title (default: "Minifigs"). If you pass "" it hides the title bar.
   */
  title?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const inflight = useRef<Record<string, number>>({}); // per-row request versioning

  const setSaving = (id: string, v: boolean) =>
    setSavingIds((p) => ({ ...p, [id]: v }));

  const load = useCallback(async () => {
    if (!userCollectionItemId) return;

    setLoading(true);
    setErr(null);

    const res = await supabase
      .from("user_collection_item_minifigs")
      .select(
        `
        id,
        user_collection_item_id,
        minifig_id,
        included,
        included_qty,
        notes,
        created_at,
        catalog_minifigs (
          id,
          name,
          minifig_number,
          image_url
        )
      `
      )
      .eq("user_collection_item_id", userCollectionItemId)
      .order("created_at", { ascending: true });

    if (res.error) {
      setErr(res.error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((res.data ?? []) as any);
    setLoading(false);
  }, [userCollectionItemId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateRow(
    rowId: string,
    patch: Partial<Pick<Row, "included" | "included_qty" | "notes">>
  ) {
    // version token to ignore stale responses
    const v = (inflight.current[rowId] ?? 0) + 1;
    inflight.current[rowId] = v;

    setSaving(rowId, true);
    setErr(null);

    // optimistic update
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
    );

    const res = await supabase
      .from("user_collection_item_minifigs")
      .update(patch)
      .eq("id", rowId)
      .select("id")
      .single();

    // ignore if a newer update already started
    if (inflight.current[rowId] !== v) return;

    if (res.error) {
      setErr(res.error.message);
      await load(); // recover
    }

    setSaving(rowId, false);
  }

  const shouldHideCompletely =
    hideIfEmpty && !loading && !err && rows.length === 0;

  const body = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-xl bg-gray-50 border px-4 py-3 text-sm text-gray-500">
          Loading minifigs…
        </div>
      );
    }

    if (err) {
      return (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      );
    }

    if (rows.length === 0) {
      // If hideIfEmpty is true, we won't render this at all.
      return (
        <div className="rounded-xl bg-gray-50 border px-4 py-3 text-sm text-gray-500">
          No minifigs recorded for this copy.
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-gray-50 border overflow-hidden">
        {rows.map((r) => {
          const m = asMinifig(r.catalog_minifigs);
          const label = m?.name?.trim() || "Unknown minifig";
          const number = m?.minifig_number?.trim();
          const img = normalizeStorageUrl(
            m?.image_url ?? null,
            "NEXT_PUBLIC_CATALOG_MINIFIG_PHOTO_BUCKET",
            "catalog"
          );

          const busy = !!savingIds[r.id];
          const qty = clampQty(r.included_qty);

          return (
            <div key={r.id} className="px-4 py-3 border-b last:border-b-0 bg-white">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg border bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={label} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {label}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {number ? `#${number}` : "No number"}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!r.included}
                        disabled={readOnly || busy}
                        onChange={(e) => {
                          const included = e.target.checked;
                          updateRow(r.id, {
                            included,
                            included_qty: included ? qty : 0,
                          });
                        }}
                      />
                      Included
                    </label>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Qty</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-20 rounded-lg border px-2 py-1 text-sm disabled:bg-gray-50"
                        value={qty}
                        disabled={readOnly || busy || !r.included}
                        onChange={(e) => {
                          const n = clampQty(e.target.value);
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id ? { ...x, included_qty: n } : x
                            )
                          );
                        }}
                        onBlur={(e) => {
                          const n = clampQty(e.target.value);
                          if (n !== qty) updateRow(r.id, { included_qty: n });
                        }}
                      />
                    </div>

                    <input
                      type="text"
                      className="flex-1 min-w-[220px] rounded-lg border px-2 py-1 text-sm disabled:bg-gray-50"
                      placeholder="Notes…"
                      value={r.notes ?? ""}
                      disabled={readOnly || busy}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, notes: v } : x))
                        );
                      }}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const next = v.length ? v : null;
                        if ((next ?? null) !== (r.notes ?? null))
                          updateRow(r.id, { notes: next });
                      }}
                    />

                    {busy && <span className="text-xs text-gray-400">Saving…</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [err, loading, rows, readOnly, savingIds, load]);

  // ✅ If empty and hideIfEmpty, render nothing at all
  if (shouldHideCompletely) return null;

  const showTitleBar = title.trim().length > 0;

  return (
    <div className={showTitleBar ? "mt-4" : ""}>
      {showTitleBar ? (
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          {!readOnly ? (
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-4"
              onClick={load}
            >
              Refresh
            </button>
          ) : null}
        </div>
      ) : null}

      {body}
    </div>
  );
}
