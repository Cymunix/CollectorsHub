"use client";

import React, { useEffect, useState } from "react";
import { fetchItemVariants, type VariantRow as QueryVariantRow } from "../_lib/queries";

type VariantRow = {
  id: string;
  label: string;
  url?: string | null;
  source?: string | null;
};

function toUiRow(r: QueryVariantRow): VariantRow {
  // Make sure the UI always has a string label
  const label =
    (r.label && String(r.label).trim()) ||
    (r.target_name && String(r.target_name).trim()) ||
    "Variant";

  // You don't currently return url/source from fetchItemVariants,
  // so we derive a reasonable "source" from link_type and leave url null.
  return {
    id: r.id,
    label,
    source: r.link_type ? String(r.link_type) : "Variant",
    url: null,
  };
}

export default function VariantsTab({ catalogItemId }: { catalogItemId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<VariantRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchItemVariants(catalogItemId);
        const ui = (data ?? []).map(toUiRow);
        if (!cancelled) setRows(ui);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load variants.");
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
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Variants</div>
          <div className="text-sm text-gray-500">Alternate versions, external references, or linked SKUs.</div>
        </div>
      </div>

      {err && <ErrorBox msg={err} />}

      {loading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyBox title="No variants yet" body="Once you link variants, they’ll show up here." />
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border">
          {rows.map((r, idx) => (
            <div
              key={r.id}
              className={[
                "flex items-center justify-between gap-3 px-4 py-3 bg-white",
                idx !== rows.length - 1 ? "border-b" : "",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{r.label}</div>
                <div className="text-xs text-gray-500 truncate">
                  {r.source ?? "Variant"} {r.url ? `• ${r.url}` : ""}
                </div>
              </div>

              {r.url ? (
                <a
                  className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open →
                </a>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div>;
}

function EmptyBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-2xl border bg-gray-50 p-4">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{body}</div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-4 space-y-2">
      <div className="h-14 rounded-2xl bg-gray-100" />
      <div className="h-14 rounded-2xl bg-gray-100" />
      <div className="h-14 rounded-2xl bg-gray-100" />
    </div>
  );
}
