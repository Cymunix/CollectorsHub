"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  fetchBundleComponents,
  replaceBundleComponents,
  searchCatalogItems,
  type BundleComponent,
  type BundleComponentInput,
  type CatalogSearchRow,
} from "../_lib/queries";

export default function ComponentsTab({
  catalogItemId,
  canEdit = true,
}: {
  catalogItemId: string;
  canEdit?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<BundleComponent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchBundleComponents(catalogItemId);
        if (!cancelled) setRows(data ?? []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load components.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const totalQty = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0), [rows]);

  async function saveDraft(draft: BundleComponentInput[]) {
    setSaving(true);
    setErr(null);
    try {
      await replaceBundleComponents(catalogItemId, draft);
      setOpen(false);
      const data = await fetchBundleComponents(catalogItemId);
      setRows(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save components.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Components</div>
          <div className="text-sm text-gray-500">What’s inside this bundle.</div>
        </div>

        {canEdit && (
          <button
            type="button"
            className="rounded-2xl bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111C33]"
            onClick={() => setOpen(true)}
            disabled={saving}
          >
            Add Components
          </button>
        )}
      </div>

      {err && <ErrorBox msg={err} />}

      {loading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyBox title="No components yet" body="Add items to define what’s inside this bundle." />
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm text-gray-600">
              {rows.length} line{rows.length === 1 ? "" : "s"} • {totalQty} total item{totalQty === 1 ? "" : "s"}
            </div>
          </div>

          {rows.map((r, idx) => {
            const it = r.component;
            return (
              <div
                key={`${r.component_item_id}-${idx}`}
                className={[
                  "flex items-center gap-3 px-4 py-3",
                  idx !== rows.length - 1 ? "border-b" : "",
                ].join(" ")}
              >
                <div className="h-12 w-12 overflow-hidden rounded-xl border bg-gray-50">
                  {it?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt={it.name ?? "Component"} className="h-full w-full object-cover" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it?.name ?? "Unknown Item"}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {it?.release_year ? `${it.release_year}` : "—"}
                    {it?.version ? ` • ${it.version}` : ""}
                    {r.role ? ` • ${r.role}` : ""}
                    {r.notes ? ` • ${r.notes}` : ""}
                  </div>
                </div>

                <span className="rounded-xl border bg-white px-3 py-2 text-sm">Qty: {r.qty}</span>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <AddComponentsModal
          bundleItemId={catalogItemId}
          initial={rows}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={saveDraft}
        />
      )}
    </div>
  );
}

function AddComponentsModal({
  bundleItemId,
  initial,
  saving,
  onClose,
  onSave,
}: {
  bundleItemId: string;
  initial: BundleComponent[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: BundleComponentInput[]) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CatalogSearchRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [draft, setDraft] = useState<Record<string, BundleComponentInput>>(() => {
    const m: Record<string, BundleComponentInput> = {};
    for (const row of initial ?? []) {
      m[row.component_item_id] = {
        component_item_id: row.component_item_id,
        qty: row.qty ?? 1,
        role: row.role ?? null,
        notes: row.notes ?? null,
      };
    }
    return m;
  });

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const query = q.trim();
      if (query.length < 2) {
        if (alive) setResults([]);
        return;
      }
      setSearching(true);
      setErr(null);
      try {
        const data = await searchCatalogItems(query, 25);
        // don’t allow selecting the bundle itself as a component
        const filtered = (data ?? []).filter((r) => r.id !== bundleItemId);
        if (alive) setResults(filtered);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Search failed.");
      } finally {
        if (alive) setSearching(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, bundleItemId]);

  const draftList = useMemo(() => Object.values(draft), [draft]);

  function upsert(item: CatalogSearchRow) {
    setDraft((d) => {
      const cur = d[item.id];
      return {
        ...d,
        [item.id]: {
          component_item_id: item.id,
          qty: cur?.qty ?? 1,
          role: cur?.role ?? null,
          notes: cur?.notes ?? null,
        },
      };
    });
  }

  function remove(id: string) {
    setDraft((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }

  function setQty(id: string, qty: number) {
    setDraft((d) => ({
      ...d,
      [id]: { ...(d[id] as any), qty: Math.max(1, Math.floor(Number(qty) || 1)) },
    }));
  }

  async function save() {
    await onSave(draftList);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="font-semibold">Add Components</div>
            <div className="text-xs text-gray-500">Search and add items to this bundle.</div>
          </div>
          <button className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items… (type at least 2 characters)"
            className="w-full rounded-2xl border px-4 py-3 text-sm"
          />

          {err && <ErrorBox msg={err} />}

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border">
              <div className="border-b px-4 py-2 text-sm font-semibold">Results</div>
              <div className="max-h-[420px] overflow-auto">
                {searching ? (
                  <div className="p-4 text-sm text-gray-500">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No results.</div>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="flex w-full items-center gap-3 border-b px-4 py-3 text-left hover:bg-gray-50"
                      onClick={() => upsert(r)}
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-xl border bg-gray-50">
                        {r.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.name}</div>
                        <div className="truncate text-xs text-gray-500">
                          {r.release_year ? r.release_year : "—"}
                          {r.version ? ` • ${r.version}` : ""}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">Add</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border">
              <div className="border-b px-4 py-2 text-sm font-semibold">Draft</div>
              <div className="max-h-[420px] overflow-auto">
                {draftList.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No components selected.</div>
                ) : (
                  draftList.map((d) => (
                    <div key={d.component_item_id} className="flex items-center gap-3 border-b px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{d.component_item_id}</div>
                        <div className="text-xs text-gray-500">Qty and save</div>
                      </div>

                      <input
                        type="number"
                        min={1}
                        value={Number(d.qty ?? 1)}
                        onChange={(e) => setQty(d.component_item_id, Number(e.target.value))}
                        className="w-20 rounded-xl border px-2 py-2 text-sm"
                      />

                      <button
                        type="button"
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => remove(d.component_item_id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50" onClick={onClose}>
              Cancel
            </button>
            <button
              className="rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111C33]"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Components"}
            </button>
          </div>
        </div>
      </div>
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
