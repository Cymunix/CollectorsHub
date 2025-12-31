"use client";

import React, { useEffect, useMemo, useState } from "react";

type ExpectedMinifig = {
  id: string;
  minifig_number?: string;
  name?: string | null;
  image_url?: string | null;
};

type Props = {
  mode?: "set" | "loose" | string;
  catalogItemId: string;
  expectedMinifigs?: ExpectedMinifig[];
  conditionValues: Record<string, any>;
  conditionScore: number; // 0–100 in your newer model
  onChange: (nextValues: Record<string, any>, nextScore: number) => void;
};

/**
 * This is a COMPILING implementation that:
 * - stores minifig checklist selections into conditionValues.building_blocks.minifigs
 * - keeps conditionScore as-is (you can evolve scoring later)
 *
 * It’s intentionally simple + safe so you don’t brick the build.
 */
export default function ItemConditionBuildingBlocks({
  mode,
  catalogItemId,
  expectedMinifigs,
  conditionValues,
  conditionScore,
  onChange,
}: Props) {
  const list = useMemo(() => Array.isArray(expectedMinifigs) ? expectedMinifigs : [], [expectedMinifigs]);

  const [local, setLocal] = useState<Record<string, { included: boolean; qty: number; notes: string }>>({});

  // Initialize local state from conditionValues (if present)
  useEffect(() => {
    const fromJson = (conditionValues as any)?.building_blocks?.minifigs;
    const next: Record<string, { included: boolean; qty: number; notes: string }> = {};

    if (Array.isArray(fromJson)) {
      for (const row of fromJson) {
        const id = String(row?.minifig_id ?? row?.id ?? "").trim();
        if (!id) continue;
        next[id] = {
          included: !!(row?.included ?? row?.checked ?? row?.selected),
          qty: Number.isFinite(Number(row?.included_qty ?? row?.qty)) ? Math.max(0, Number(row?.included_qty ?? row?.qty)) : 0,
          notes: String(row?.notes ?? "").slice(0, 200),
        };
      }
    }

    setLocal(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId]);

  const pushUp = (nextLocal: typeof local) => {
    // Convert local -> your expected json shape
    const rows = Object.entries(nextLocal).map(([minifig_id, v]) => ({
      minifig_id,
      included: !!v.included,
      included_qty: Math.max(0, Number(v.qty) || 0),
      notes: String(v.notes || ""),
    }));

    const nextValues = {
      ...(conditionValues ?? {}),
      building_blocks: {
        ...((conditionValues as any)?.building_blocks ?? {}),
        type: (conditionValues as any)?.building_blocks?.type ?? (mode === "set" ? "set" : "building_blocks"),
        minifigs: rows,
      },
    };

    // Keep the score unchanged for now (you can evolve to compute score later)
    onChange(nextValues, conditionScore);
  };

  if (!list.length) {
    return (
      <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#0F172A]">Minifigs</div>
        <div className="mt-1 text-xs text-[#64748B]">
          No minifigs are linked to this set yet.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[#0F172A]">
            Minifigs ({list.length})
          </div>
          <div className="text-[11px] text-[#64748B]">
            Check what you have. Qty can be 0+ for duplicates.
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {list.map((m) => {
          const id = m.id;
          const row = local[id] ?? { included: false, qty: 0, notes: "" };

          return (
            <div key={id} className="rounded-2xl border border-[#E5E9F2] bg-white p-3">
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#E5E9F2] bg-[#F8FAFC]">
                  {m.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image_url} alt={m.name ?? "Minifig"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-[#94A3B8]">
                      No image
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#0F172A] truncate">
                        {m.name ?? "Minifig"}
                      </div>
                      <div className="text-xs text-[#64748B] truncate">
                        {m.minifig_number ? `#${m.minifig_number}` : id}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#CBD5E1]"
                        checked={!!row.included}
                        onChange={(e) => {
                          const nextLocal = {
                            ...local,
                            [id]: { ...row, included: e.target.checked },
                          };
                          setLocal(nextLocal);
                          pushUp(nextLocal);
                        }}
                      />
                      Included
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-1">
                      <div className="text-[11px] font-semibold text-[#64748B]">Qty</div>
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
                        value={String(row.qty ?? 0)}
                        onChange={(e) => {
                          const qty = Math.max(0, Number(e.target.value) || 0);
                          const nextLocal = {
                            ...local,
                            [id]: { ...row, qty },
                          };
                          setLocal(nextLocal);
                          pushUp(nextLocal);
                        }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-[11px] font-semibold text-[#64748B]">Notes (optional)</div>
                      <input
                        type="text"
                        maxLength={200}
                        className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
                        placeholder="e.g. missing cape / wrong head"
                        value={row.notes ?? ""}
                        onChange={(e) => {
                          const notes = e.target.value;
                          const nextLocal = {
                            ...local,
                            [id]: { ...row, notes },
                          };
                          setLocal(nextLocal);
                          pushUp(nextLocal);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="text-[11px] text-[#64748B]">
          Saved into <span className="font-semibold">conditionValues.building_blocks.minifigs</span>.
        </div>
      </div>
    </div>
  );
}
