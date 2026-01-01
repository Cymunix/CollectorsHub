"use client";

import React, { useEffect, useState } from "react";
import { fetchBundlesIncludingItem, type IncludedInBundleLite } from "../_lib/queries";

export default function IncludedInBundlesTab({ catalogItemId }: { catalogItemId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<IncludedInBundleLite[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchBundlesIncludingItem(catalogItemId);
        if (!cancelled) setRows(data ?? []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load bundles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  return (
    <div>
      <div>
        <div className="text-lg font-semibold">Included In</div>
        <div className="text-sm text-gray-500">Bundles that contain this item.</div>
      </div>

      {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-14 rounded-2xl bg-gray-100" />
          <div className="h-14 rounded-2xl bg-gray-100" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border bg-gray-50 p-4">
          <div className="font-semibold">Not included in any bundles</div>
          <div className="mt-1 text-sm text-gray-600">If you add this item to a bundle, it will show here.</div>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
          {rows.map((b, idx) => (
            <a
              key={b.id}
              href={`/collection/${b.id}`}
              className={[
                "flex items-center gap-3 px-4 py-3 hover:bg-gray-50",
                idx !== rows.length - 1 ? "border-b" : "",
              ].join(" ")}
            >
              <div className="h-12 w-12 overflow-hidden rounded-xl border bg-gray-50">
                {b.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image_url} alt={b.name} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{b.name}</div>
                <div className="text-xs text-gray-500 truncate">Bundle</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
