// components/catalog/add-item/sections/BundleSection.tsx
"use client";

import React, { useCallback, useMemo, useState } from "react";

type CatalogSearchRow = {
  id: string;
  name: string;
  image_url: string | null;
  release_year: number | null;
  version: string | null;
};

export type BundleDraftRow = {
  component_item_id: string;
  name: string;
  qty: number;
};

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function clampQty(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

export default function BundleSection(p: {
  supabase: any;

  saving: boolean;

  isBundle: boolean;
  setIsBundle: (v: boolean) => void;

  bundleRows: BundleDraftRow[];
  setBundleRows: React.Dispatch<React.SetStateAction<BundleDraftRow[]>>;
}) {
  const [bundleQuery, setBundleQuery] = useState("");
  const [bundleSearching, setBundleSearching] = useState(false);
  const [bundleResults, setBundleResults] = useState<CatalogSearchRow[]>([]);
  const [bundleUiErr, setBundleUiErr] = useState<string | null>(null);

  const bundleIds = useMemo(() => new Set(p.bundleRows.map((r) => r.component_item_id)), [p.bundleRows]);

  const searchBundleComponents = useCallback(async () => {
    const q = String(bundleQuery ?? "").trim();
    if (q.length < 2) {
      setBundleResults([]);
      return;
    }

    setBundleSearching(true);
    setBundleUiErr(null);

    try {
      const { data, error } = await p.supabase
        .from("catalog_items")
        .select("id,name,image_url,release_year,version")
        .ilike("name", `%${q}%`)
        .limit(20);

      if (error) throw error;

      const rows = ((data ?? []) as any[]).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? "Item"),
        image_url: r.image_url ?? null,
        release_year: typeof r.release_year === "number" ? r.release_year : null,
        version: r.version ?? null,
      })) as CatalogSearchRow[];

      setBundleResults(rows);
    } catch (e: any) {
      setBundleUiErr(e?.message ?? "Failed to search catalog items.");
    } finally {
      setBundleSearching(false);
    }
  }, [bundleQuery, p.supabase]);

  const addBundleComponent = useCallback(
    (r: CatalogSearchRow) => {
      if (!r?.id) return;
      if (bundleIds.has(r.id)) return;
      p.setBundleRows((prev) => [...prev, { component_item_id: r.id, name: r.name, qty: 1 }]);
    },
    [bundleIds, p.setBundleRows]
  );

  const removeBundleComponent = useCallback(
    (id: string) => {
      p.setBundleRows((prev) => prev.filter((r) => r.component_item_id !== id));
    },
    [p.setBundleRows]
  );

  const setBundleQty = useCallback(
    (id: string, qty: any) => {
      const v = clampQty(qty);
      p.setBundleRows((prev) => prev.map((r) => (r.component_item_id === id ? { ...r, qty: v } : r)));
    },
    [p.setBundleRows]
  );

  return (
    <div className="mt-4 rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#0F172A]">Bundle</div>
          <div className="text-xs text-[#64748B]">Mark this item as a bundle and define what it includes.</div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
          <input
            type="checkbox"
            checked={p.isBundle}
            onChange={(e) => p.setIsBundle(!!e.target.checked)}
            disabled={p.saving}
            className="h-4 w-4"
          />
          This item is a bundle
        </label>
      </div>

      {p.isBundle ? (
        <div className="mt-4">
          {bundleUiErr ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {bundleUiErr}
            </div>
          ) : null}

          <div className="text-xs font-semibold text-[#0F172A]">Included items</div>

          <div className="mt-2 space-y-2">
            {p.bundleRows.length === 0 ? (
              <div className="rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">
                No components added yet.
              </div>
            ) : (
              p.bundleRows.map((r) => (
                <div
                  key={r.component_item_id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E9F2] bg-white p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#0F172A]">{safeText(r.name)}</div>
                    <div className="text-[11px] text-[#64748B]">{r.component_item_id}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={r.qty}
                      onChange={(e) => setBundleQty(r.component_item_id, e.target.value)}
                      disabled={p.saving}
                      className="w-20 rounded-lg border border-[#E5E9F2] px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeBundleComponent(r.component_item_id)}
                      disabled={p.saving}
                      className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                        p.saving ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "hover:bg-[#F8FAFC]"
                      }`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 border-t border-[#E5E9F2] pt-4">
            <div className="text-xs font-semibold text-[#0F172A]">Add components</div>

            <div className="mt-2 flex items-center gap-2">
              <input
                value={bundleQuery}
                onChange={(e) => setBundleQuery(e.target.value)}
                placeholder="Search catalog items..."
                className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                disabled={p.saving}
              />
              <button
                type="button"
                onClick={searchBundleComponents}
                disabled={p.saving || bundleSearching || String(bundleQuery).trim().length < 2}
                className={`rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition ${
                  p.saving || bundleSearching || String(bundleQuery).trim().length < 2
                    ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                    : "bg-[#0F172A] text-white"
                }`}
              >
                {bundleSearching ? "Searching..." : "Search"}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {bundleResults.map((r) => {
                const already = bundleIds.has(r.id);
                const subtitle = `${r.release_year ?? "—"}${r.version ? ` • ${r.version}` : ""}`;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E9F2] bg-white p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#0F172A]">{safeText(r.name)}</div>
                      <div className="text-[11px] text-[#64748B] truncate">{subtitle}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => addBundleComponent(r)}
                      disabled={p.saving || already}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                        p.saving || already ? "bg-gray-200 text-gray-600 cursor-not-allowed" : "border hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {already ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-[11px] text-[#64748B]">Components are saved after the item is created.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
