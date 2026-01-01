// app/catalog/[id]/tabs/item_sales_history.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fetchItemSalesHistory } from "@/lib/catalog/queries";

type SaleRow = {
  id: string;

  // We normalize "sold_at" at runtime (fallback to created_at)
  sold_at: string;

  price_cad: number | null;

  // Optional metadata if your table has it
  source?: string | null;
  url?: string | null;
  condition_note?: string | null;

  // Legacy / older:
  condition_json?: Record<string, any> | null;

  // Some implementations return created_at instead of sold_at
  created_at?: string | null;
};

function formatMoneyCAD(n: number | null) {
  if (n === null || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(n));
}

/**
 * Stable-ish stringify so {a:1,b:2} and {b:2,a:1} match.
 * Handles nested objects/arrays.
 */
function stableStringify(value: any): string {
  const seen = new WeakSet();

  const normalize = (v: any): any => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "object") return v;

    if (seen.has(v)) return "[Circular]";
    seen.add(v);

    if (Array.isArray(v)) return v.map(normalize);

    const keys = Object.keys(v).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = normalize(v[k]);
    return out;
  };

  try {
    return JSON.stringify(normalize(value));
  } catch {
    return "null";
  }
}

function pickSoldAt(r: any): string {
  const s = String(r?.sold_at ?? "").trim();
  if (s) return s;

  const c = String(r?.created_at ?? "").trim();
  if (c) return c;

  return new Date(0).toISOString();
}

export default function SalesHistoryTab({
  catalogItemId,
  selectedConditionJson,
}: {
  catalogItemId: string;

  // ✅ matches what the item page passes today
  selectedConditionJson?: Record<string, any> | null;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const data = await fetchItemSalesHistory(catalogItemId);

        // Normalize shape so this component is resilient to whatever
        // the underlying query returns.
        const normalized = (data ?? []).map((r: any) => ({
          id: String(r?.id ?? "").trim(),
          sold_at: pickSoldAt(r),
          price_cad: typeof r?.price_cad === "number" ? r.price_cad : r?.price_cad ?? null,
          source: r?.source ?? null,
          url: r?.url ?? null,
          condition_note: r?.condition_note ?? r?.notes ?? null,
          condition_json: (r?.condition_json ?? null) as any,
          created_at: r?.created_at ?? null,
        })) as SaleRow[];

        if (!cancelled) setRows(normalized.filter((r) => !!r.id));
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load sales history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  // Filter rows by selectedConditionJson when present.
  // If you haven't stored condition_json on sales yet, show ALL.
  const filteredRows = useMemo(() => {
    const want = stableStringify(selectedConditionJson ?? null);
    if (want === "null") return rows;

    const anyHasConditionJson = rows.some((r) => r.condition_json && Object.keys(r.condition_json).length > 0);
    if (!anyHasConditionJson) return rows;

    return rows.filter((r) => stableStringify(r.condition_json ?? null) === want);
  }, [rows, selectedConditionJson]);

  const avg = useMemo(() => {
    const prices = filteredRows
      .map((r) => r.price_cad)
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (prices.length === 0) return null;
    const sum = prices.reduce((s, n) => s + n, 0);
    return sum / prices.length;
  }, [filteredRows]);

  const filterChip = useMemo(() => {
    const v = selectedConditionJson ?? null;
    if (!v) return null;

    // try to display something human-friendly if possible
    const state = String((v as any)?.state ?? "").replace(/_/g, " ").trim();
    const grade = String((v as any)?.grade ?? "").trim();
    const flags = Array.isArray((v as any)?.flags) ? (v as any).flags : [];
    const f = flags.length ? ` • ${flags.length} flags` : "";

    if (state || grade || flags.length) return `${state || "Condition"}${grade ? ` • ${grade}` : ""}${f}`;
    return "Condition filter";
  }, [selectedConditionJson]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Sales History</div>
          <div className="text-sm text-gray-500">
            {avg ? (
              <>
                Average: <span className="font-medium text-gray-800">{formatMoneyCAD(avg)}</span>
              </>
            ) : (
              "No sales yet."
            )}
          </div>
        </div>

        {filterChip ? (
          <div className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
            Filter: {filterChip}
          </div>
        ) : null}
      </div>

      {err ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-14 rounded-2xl bg-gray-100" />
          <div className="h-14 rounded-2xl bg-gray-100" />
          <div className="h-14 rounded-2xl bg-gray-100" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="mt-4 rounded-2xl border bg-gray-50 p-4 text-sm text-gray-600">
          No comps for this condition filter yet.
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border">
          <div className="grid grid-cols-[120px_120px_1fr_90px] gap-0 border-b bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
            <div>Date</div>
            <div>Price</div>
            <div>Source / Notes</div>
            <div className="text-right">Link</div>
          </div>

          {filteredRows.map((r, idx) => (
            <div
              key={r.id}
              className={[
                "grid grid-cols-[120px_120px_1fr_90px] gap-0 px-4 py-3 bg-white text-sm",
                idx !== filteredRows.length - 1 ? "border-b" : "",
              ].join(" ")}
            >
              <div className="text-gray-700">{new Date(r.sold_at).toLocaleDateString()}</div>
              <div className="font-semibold">{formatMoneyCAD(r.price_cad)}</div>
              <div className="min-w-0">
                <div className="truncate">{r.source ?? "—"}</div>
                {r.condition_note ? <div className="text-xs text-gray-500 truncate">{r.condition_note}</div> : null}
              </div>
              <div className="text-right">
                {r.url ? (
                  <a className="text-sm underline hover:no-underline" href={r.url} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
