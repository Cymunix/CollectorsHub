"use client";

import React, { useEffect, useMemo } from "react";
import { getConditionLabel } from "@/lib/pricingEngine";

type Minifig = {
  // ✅ support both while you migrate
  minifig_id?: string;
  id?: string;

  // ✅ NEW: unique per duplicate instance (ex: "<minifig_uuid>#1", "#2")
  instance_key?: string;

  minifig_number: string;
  name: string | null;
  image_url: string | null;
};

type Props = {
  mode: "set" | "minifig";
  catalogItemId: string;
  expectedMinifigs?: Minifig[];
  conditionValues: Record<string, any>;
  conditionScore: number;
  onChange: (nextValues: Record<string, any>, nextScore: number) => void;
};

function clampScore(n: any, fallback = 8) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(10, x));
}

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function scoreOptions() {
  return Array.from({ length: 10 }, (_, i) => i + 1);
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#E5E9F2] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-semibold text-[#0F172A]">
      {children}
    </span>
  );
}

// ✅ KEY CHANGE: prefer instance_key so duplicates are independent
function mfKey(mf: Minifig): string {
  return String(mf.instance_key ?? mf.minifig_id ?? mf.id ?? "");
}

function rowKey(r: any): string {
  // rows stored inside conditionValues.building_blocks.minifigs
  // will use minifig_id as the *instance key* going forward
  return String(r?.minifig_id ?? r?.id ?? "");
}

function getIncludedCount(
  bbMinifigs: Array<{ minifig_id?: string; id?: string; included: boolean }>,
  expected: Minifig[]
) {
  const byId = new Map<string, boolean>();
  bbMinifigs.forEach((r) => {
    const k = rowKey(r);
    if (k) byId.set(k, !!r.included);
  });

  return expected.reduce((acc, mf) => {
    const k = mfKey(mf);
    return acc + (k && byId.get(k) ? 1 : 0);
  }, 0);
}

/**
 * ✅ Score algorithm
 * - SET mode: score is derived from checklist + sub-scores
 * - MINIFIG mode: score is derived ONLY from minifig details (no overall baseline selector)
 */
function computeScore(mode: "set" | "minifig", bb: any, expectedMinifigs: Minifig[]) {
  // -------- SET MODE --------
  if (mode === "set") {
    if (!!bb.sealed) return 10;

    // start from 9 for used sets; subtract penalties
    let score = 9;

    const piecesComplete = bb.piecesComplete !== false;
    if (!piecesComplete) score -= 2;

    // Minifigs included penalty
    const rows: Array<{ minifig_id?: string; id?: string; included: boolean }> = Array.isArray(bb.minifigs)
      ? bb.minifigs
      : [];
    if (expectedMinifigs.length > 0) {
      const included = getIncludedCount(rows, expectedMinifigs);
      const missing = expectedMinifigs.length - included;

      if (missing > 0) {
        // -1 per 2 missing, cap -3
        score -= Math.min(3, Math.ceil(missing / 2));
      }
    }

    // Box included + condition
    const boxIncluded = !!bb.box?.included;
    if (!boxIncluded) {
      score -= 1;
    } else {
      const boxScore = clampScore(bb.box?.score ?? 8, 8);
      if (boxScore <= 6) score -= 2;
      else if (boxScore <= 7) score -= 1;
    }

    // Instructions included + condition
    const instIncluded = !!bb.instructions?.included;
    if (!instIncluded) {
      score -= 1;
    } else {
      const instScore = clampScore(bb.instructions?.score ?? 8, 8);
      if (instScore <= 6) score -= 2;
      else if (instScore <= 7) score -= 1;
    }

    // Stickers
    const stickersApplied = !!bb.stickersApplied;
    if (stickersApplied) {
      const stickerQ = clampScore(bb.stickerQuality ?? 8, 8);
      if (stickerQ <= 3) score -= 2;
      else if (stickerQ <= 5) score -= 1;
    }

    // Discoloration / yellowing
    const discolor = clampScore(bb.discoloration ?? 8, 8);
    if (discolor <= 3) score -= 2;
    else if (discolor <= 5) score -= 1;

    if (!!bb.yellowing) score -= 1;

    return clampScore(Math.round(score), 8);
  }

  // -------- MINIFIG MODE (NO OVERALL BASELINE) --------
  // Start perfect and subtract based on actuals.
  let score = 10;

  // Big issues
  if (bb.cracks) score -= 4;
  if (bb.looseJoints) score -= 3;
  if (bb.biteMarks) score -= 3;

  // Medium issues
  if (bb.yellowing) score -= 2;
  if (bb.grime) score -= 1;

  // Missing accessories is smaller penalty
  if (bb.hasAccessories === false) score -= 1;

  return clampScore(Math.round(score), 8);
}

export default function ItemConditionBuildingBlocks({
  mode,
  catalogItemId,
  expectedMinifigs = [],
  conditionValues,
  conditionScore,
  onChange,
}: Props) {
  const root = useMemo(() => {
    const cv = conditionValues ?? {};
    const bb = cv.building_blocks ?? {};
    const type = bb.type ?? (mode === "set" ? "set" : "minifig");

    const normalized = {
      ...cv,
      building_blocks: {
        ...bb,
        type,

        sealed: !!bb.sealed,
        box: {
          included: !!bb.box?.included,
          score: clampScore(bb.box?.score ?? 8, 8),
        },
        instructions: {
          included: !!bb.instructions?.included,
          score: clampScore(bb.instructions?.score ?? 8, 8),
        },
        piecesComplete: bb.piecesComplete !== false,
        stickersApplied: !!bb.stickersApplied,
        stickerQuality: clampScore(bb.stickerQuality ?? 8, 8),
        discoloration: clampScore(bb.discoloration ?? 8, 8),
        minifigs: Array.isArray(bb.minifigs) ? bb.minifigs : [],

        // minifig-only flags
        hasAccessories: bb.hasAccessories !== false,
        cracks: !!bb.cracks,
        looseJoints: !!bb.looseJoints,
        biteMarks: !!bb.biteMarks,
        yellowing: !!bb.yellowing,
        grime: !!bb.grime,
      },
    };

    return normalized;
  }, [conditionValues, conditionScore, mode]);

  const bb = root.building_blocks;

  // ✅ FIX: ensure we have ONE ROW PER EXPECTED INSTANCE (not per minifig_id)
  useEffect(() => {
    if (mode !== "set") return;

    const current: Array<{ minifig_id?: string; id?: string; included: boolean }> = Array.isArray(bb.minifigs)
      ? bb.minifigs
      : [];

    const map = new Map<string, boolean>();
    for (const r of current) {
      const k = rowKey(r);
      if (k) map.set(k, !!r.included);
    }

    let changed = false;

    // IMPORTANT: expectedMinifigs may contain duplicates with different instance_key.
    // We must ensure each instance exists in map.
    for (const mf of expectedMinifigs) {
      const k = mfKey(mf);
      if (!k) continue;
      if (!map.has(k)) {
        map.set(k, false);
        changed = true;
      }
    }

    if (!changed) return;

    const nextMinifigs = expectedMinifigs
      .map((mf) => {
        const k = mfKey(mf);
        if (!k) return null;
        return {
          // ✅ store "instance key" here so duplicates are independent
          minifig_id: k,
          included: !!map.get(k),
        };
      })
      .filter(Boolean) as Array<{ minifig_id: string; included: boolean }>;

    const nextValues = {
      ...root,
      building_blocks: {
        ...bb,
        type: "set",
        minifigs: nextMinifigs,
      },
    };

    const nextBB = nextValues.building_blocks;
    const nextScore = computeScore("set", nextBB, expectedMinifigs);

    onChange(nextValues, nextScore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, catalogItemId, expectedMinifigs]);

  const minifigState = useMemo(() => {
    const rows: Array<{ minifig_id?: string; id?: string; included: boolean }> = Array.isArray(bb.minifigs)
      ? bb.minifigs
      : [];
    const byId = new Map<string, boolean>();
    rows.forEach((r) => {
      const k = rowKey(r);
      if (k) byId.set(k, !!r.included);
    });

    const total = expectedMinifigs.length;
    const includedCount = expectedMinifigs.reduce((acc, mf) => {
      const k = mfKey(mf);
      return acc + (k && byId.get(k) ? 1 : 0);
    }, 0);

    const all = total > 0 && includedCount === total;
    const none = includedCount === 0;

    return { byId, total, includedCount, all, none };
  }, [bb.minifigs, expectedMinifigs]);

  const computedScore = useMemo(() => computeScore(mode, bb, expectedMinifigs), [mode, bb, expectedMinifigs]);

  const setBB = (patch: Partial<typeof bb>) => {
    const nextBB = { ...bb, ...patch };
    const nextValues = { ...root, building_blocks: nextBB };
    const nextScore = computeScore(mode, nextBB, expectedMinifigs);
    onChange(nextValues, nextScore);
  };

  const setBBNested = (path: "box" | "instructions", patch: any) => {
    const nextBB = { ...bb, [path]: { ...(bb as any)[path], ...patch } };
    const nextValues = { ...root, building_blocks: nextBB };
    const nextScore = computeScore(mode, nextBB, expectedMinifigs);
    onChange(nextValues, nextScore);
  };

  // ✅ FIX: id here is the INSTANCE KEY now
  const setMinifigIncluded = (instanceKey: string, included: boolean) => {
    const curr: Array<{ minifig_id?: string; id?: string; included: boolean }> = Array.isArray(bb.minifigs)
      ? bb.minifigs
      : [];

    const key = String(instanceKey);

    const next = curr.map((r) => (rowKey(r) === key ? { ...r, included } : r));
    const nextBB = { ...bb, minifigs: next };
    const nextValues = { ...root, building_blocks: nextBB };
    const nextScore = computeScore(mode, nextBB, expectedMinifigs);
    onChange(nextValues, nextScore);
  };

  const setAllMinifigs = (included: boolean) => {
    const next = expectedMinifigs
      .map((mf) => {
        const k = mfKey(mf);
        if (!k) return null;
        return { minifig_id: k, included };
      })
      .filter(Boolean) as Array<{ minifig_id: string; included: boolean }>;

    const nextBB = { ...bb, minifigs: next };
    const nextValues = { ...root, building_blocks: nextBB };
    const nextScore = computeScore(mode, nextBB, expectedMinifigs);
    onChange(nextValues, nextScore);
  };

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#0F172A]">Condition</div>
          <div className="mt-1 text-xs text-[#6B7280]">{mode === "set" ? "Building Blocks Set" : "Minifigure"}</div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge>
            Score: {computedScore} — {getConditionLabel(computedScore)}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Set-only: sealed/box/instructions */}
        {mode === "set" ? (
          <div className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-3 space-y-3 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-[#0F172A]">Packaging & Contents</div>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                <input type="checkbox" checked={!!bb.sealed} onChange={(e) => setBB({ sealed: e.target.checked })} />
                Sealed / New
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#0F172A]">Box included</span>
                  <input
                    type="checkbox"
                    checked={!!bb.box?.included}
                    onChange={(e) => setBBNested("box", { included: e.target.checked })}
                    disabled={!!bb.sealed}
                  />
                </label>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#6B7280]">Box condition</span>
                  <select
                    className="rounded-xl border border-[#E5E9F2] bg-white px-2 py-1 text-xs font-semibold"
                    value={clampScore(bb.box?.score ?? 8, 8)}
                    onChange={(e) => setBBNested("box", { score: clampScore(e.target.value, 8) })}
                    disabled={!!bb.sealed || !bb.box?.included}
                  >
                    {scoreOptions().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-[#0F172A]">
                    {getConditionLabel(clampScore(bb.box?.score ?? 8, 8))}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#0F172A]">Instructions included</span>
                  <input
                    type="checkbox"
                    checked={!!bb.instructions?.included}
                    onChange={(e) => setBBNested("instructions", { included: e.target.checked })}
                    disabled={!!bb.sealed}
                  />
                </label>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#6B7280]">Instruction condition</span>
                  <select
                    className="rounded-xl border border-[#E5E9F2] bg-white px-2 py-1 text-xs font-semibold"
                    value={clampScore(bb.instructions?.score ?? 8, 8)}
                    onChange={(e) => setBBNested("instructions", { score: clampScore(e.target.value, 8) })}
                    disabled={!!bb.sealed || !bb.instructions?.included}
                  >
                    {scoreOptions().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-[#0F172A]">
                    {getConditionLabel(clampScore(bb.instructions?.score ?? 8, 8))}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Pieces complete</span>
                <input
                  type="checkbox"
                  checked={bb.piecesComplete !== false}
                  onChange={(e) => setBB({ piecesComplete: e.target.checked })}
                  disabled={!!bb.sealed}
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Stickers applied</span>
                <input
                  type="checkbox"
                  checked={!!bb.stickersApplied}
                  onChange={(e) => setBB({ stickersApplied: e.target.checked })}
                  disabled={!!bb.sealed}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <div className="text-xs font-semibold text-[#0F172A]">Sticker quality</div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    className="rounded-xl border border-[#E5E9F2] bg-white px-2 py-1 text-xs font-semibold"
                    value={clampScore(bb.stickerQuality ?? 8, 8)}
                    onChange={(e) => setBB({ stickerQuality: clampScore(e.target.value, 8) })}
                    disabled={!!bb.sealed || !bb.stickersApplied}
                  >
                    {scoreOptions().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-[#0F172A]">
                    {getConditionLabel(clampScore(bb.stickerQuality ?? 8, 8))}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <div className="text-xs font-semibold text-[#0F172A]">Discoloration / Yellowing</div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    className="rounded-xl border border-[#E5E9F2] bg-white px-2 py-1 text-xs font-semibold"
                    value={clampScore(bb.discoloration ?? 8, 8)}
                    onChange={(e) => setBB({ discoloration: clampScore(e.target.value, 8) })}
                    disabled={!!bb.sealed}
                  >
                    {scoreOptions().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-[#0F172A]">
                    {getConditionLabel(clampScore(bb.discoloration ?? 8, 8))}
                  </span>
                </div>

                <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[#0F172A]">
                  <input
                    type="checkbox"
                    checked={!!bb.yellowing}
                    onChange={(e) => setBB({ yellowing: e.target.checked })}
                    disabled={!!bb.sealed}
                  />
                  Visible yellowing present
                </label>
              </div>
            </div>
          </div>
        ) : null}

        {/* Minifig-only */}
        {mode === "minifig" ? (
          <div className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-3 space-y-3 md:col-span-2">
            <div className="text-xs font-semibold text-[#0F172A]">Minifigure Details</div>

            <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
              <span className="text-xs font-semibold text-[#0F172A]">Accessories included</span>
              <input
                type="checkbox"
                checked={bb.hasAccessories !== false}
                onChange={(e) => setBB({ hasAccessories: e.target.checked })}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Cracks</span>
                <input type="checkbox" checked={!!bb.cracks} onChange={(e) => setBB({ cracks: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Loose joints</span>
                <input
                  type="checkbox"
                  checked={!!bb.looseJoints}
                  onChange={(e) => setBB({ looseJoints: e.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Bite marks</span>
                <input
                  type="checkbox"
                  checked={!!bb.biteMarks}
                  onChange={(e) => setBB({ biteMarks: e.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Yellowing</span>
                <input
                  type="checkbox"
                  checked={!!bb.yellowing}
                  onChange={(e) => setBB({ yellowing: e.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Grime / dirt</span>
                <input type="checkbox" checked={!!bb.grime} onChange={(e) => setBB({ grime: e.target.checked })} />
              </label>
            </div>

            <div className="text-[11px] text-[#6B7280]">
              Score is calculated automatically from the selected issues (no manual overall rating).
            </div>
          </div>
        ) : null}
      </div>

      {/* Set-only: Minifig checklist */}
      {mode === "set" ? (
        <div className="mt-4 rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#0F172A]">Minifigures Included</div>
              <div className="mt-1 text-[11px] text-[#6B7280]">
                Check each minifig independently — {minifigState.includedCount}/{minifigState.total} included
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                onClick={() => setAllMinifigs(true)}
                disabled={expectedMinifigs.length === 0}
              >
                All
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                onClick={() => setAllMinifigs(false)}
                disabled={expectedMinifigs.length === 0}
              >
                None
              </button>
            </div>
          </div>

          {expectedMinifigs.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-[#CBD5E1] bg-white p-5 text-center text-xs text-[#6B7280]">
              No minifigs linked to this set yet.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {expectedMinifigs.map((mf, idx) => {
                const k = mfKey(mf);
                const included = !!minifigState.byId.get(k);

                return (
                  <label
                    key={k || `${mf.minifig_number}-${idx}`}
                    className="flex items-center gap-3 rounded-2xl border border-[#E5E9F2] bg-white p-3 cursor-pointer hover:bg-[#F8FAFC]"
                  >
                    <div className="h-12 w-12 rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] overflow-hidden flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {mf.image_url ? (
                        <img src={mf.image_url} alt={safeText(mf.name)} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-[#9CA3AF]">No image</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#0F172A] truncate">
                        {safeText(mf.name)}
                        {/* show copy marker when duplicated */}
                        {mf.instance_key?.includes("#") ? (
                          <span className="ml-1 text-[11px] font-semibold text-[#64748B]">
                            (#{mf.instance_key.split("#")[1]})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-[#6B7280] truncate">{safeText(mf.minifig_number)}</div>
                    </div>

                    <input
                      type="checkbox"
                      checked={included}
                      onChange={(e) => setMinifigIncluded(k, e.target.checked)}
                      disabled={!k}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
