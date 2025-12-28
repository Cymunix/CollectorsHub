"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fetchItemSalesHistory } from "../_lib/queries";

type SaleRow = {
  id: string;
  sold_at: string;
  price_cad: number | null;
  source: string | null;
  url: string | null;
  condition_note: string | null;
};

function formatMoneyCAD(n: number | null) {
  if (n === null || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(n));
}

export default function SalesHistoryTab({ catalogItemId }: { catalogItemId: string }) {
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
        if (!cancelled) setRows(data);
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

  const avg = useMemo(() => {
    const prices = rows.map((r) => r.price_cad).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (prices.length === 0) return null;
    const sum = prices.reduce((s, n) => s + n, 0);
    return sum / prices.length;
  }, [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Sales History</div>
          <div className="text-sm text-gray-500">
            {avg ? <>Average: <span className="font-medium text-gray-800">{formatMoneyCAD(avg)}</span></> : "No sales yet."}
          </div>
        </div>
      </div>

      {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-14 rounded-2xl bg-gray-100" />
          <div className="h-14 rounded-2xl bg-gray-100" />
          <div className="h-14 rounded-2xl bg-gray-100" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border bg-gray-50 p-4 text-sm text-gray-600">
          Nothing recorded yet. When you start importing / scraping sold comps, they’ll show here.
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border">
          <div className="grid grid-cols-[120px_120px_1fr_90px] gap-0 border-b bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
            <div>Date</div>
            <div>Price</div>
            <div>Source / Notes</div>
            <div className="text-right">Link</div>
          </div>

          {rows.map((r, idx) => (
            <div
              key={r.id}
              className={[
                "grid grid-cols-[120px_120px_1fr_90px] gap-0 px-4 py-3 bg-white text-sm",
                idx !== rows.length - 1 ? "border-b" : "",
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
