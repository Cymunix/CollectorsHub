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

  // IMPORTANT: this is now condition_json (not random booleans)
  conditionValues: Record<string, any>;

  // IMPORTANT: this is now 0–100
  conditionScore: number;

  // IMPORTANT: nextScore is 0–100
  onChange: (nextValues: Record<string, any>, nextScore: number) => void;
};

function clampTier10(n: any, fallback = 8) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(10, x));
}

function clampScore100(n: any, fallback = 80) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, x));
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
  return String(r?.instance_key ?? r?.minifig_id ?? r?.id ?? "");
}

function getIncludedCount(
  rows: Array<{ instance_key?: string; minifig_id?: string; id?: string; included: boolean }>,
  expected: Minifig[]
) {
  const byId = new Map<string, boolean>();
  rows.forEach((r) => {
    const k = rowKey(r);
    if (k) byId.set(k, !!r.included);
  });

  return expected.reduce((acc, mf) => {
    const k = mfKey(mf);
    return acc + (k && byId.get(k) ? 1 : 0);
  }, 0);
}

function deriveTierFromScore100(score100: number) {
  return clampTier10(Math.round(score100 / 10), 8);
}

/**
 * LEGO score rules (0–100)
 * - sealed = 95 (not 100 by default)
 * - open_complete baseline = 85
 * - open_incomplete baseline = 65
 */
function computeLegoScore100(bb: any, expectedMinifigs: Minifig[]) {
  // --- Sealed ---
  if (!!bb.sealed) {
    return 95;
  }

  // Determine state baseline
  const piecesComplete = bb.piecesComplete !== false;
  let score = piecesComplete ? 85 : 65;

  // Pieces incomplete penalty (extra, beyond baseline)
  if (!piecesComplete) score -= 5;

  // Minifigs missing penalty (only if expected known)
  const rows: Array<{ instance_key?: string; minifig_id?: string; id?: string; included: boolean }> = Array.isArray(bb.minifigs)
    ? bb.minifigs
    : [];

  if (expectedMinifigs.length > 0) {
    const included = getIncludedCount(rows, expectedMinifigs);
    const missing = Math.max(0, expectedMinifigs.length - included);
    if (missing > 0) score -= Math.min(12, missing * 3);
  }

  // Box included + tier
  const boxIncluded = !!bb.box?.included;
  if (!boxIncluded) {
    score -= 5;
  } else {
    const boxTier = clampTier10(bb.box?.tier ?? bb.box?.score ?? 8, 8);
    if (boxTier <= 6) score -= 6;
    else if (boxTier <= 7) score -= 3;
  }

  // Instructions included + tier
  const instIncluded = !!bb.instructions?.included;
  if (!instIncluded) {
    score -= 4;
  } else {
    const instTier = clampTier10(bb.instructions?.tier ?? bb.instructions?.score ?? 8, 8);
    if (instTier <= 6) score -= 4;
    else if (instTier <= 7) score -= 2;
  }

  // Stickers
  const stickersApplied = !!bb.stickers?.applied ?? !!bb.stickersApplied;
  if (stickersApplied) {
    const stickerTier = clampTier10(bb.stickers?.tier ?? bb.stickerQuality ?? 8, 8);
    if (stickerTier <= 3) score -= 5;
    else if (stickerTier <= 5) score -= 2;
  }

  // Discoloration / yellowing tier
  const discolorTier = clampTier10(bb.discoloration_tier ?? bb.discoloration ?? 8, 8);
  if (discolorTier <= 3) score -= 7;
  else if (discolorTier <= 5) score -= 3;

  // Visible yellowing
  if (!!bb.yellowing) score -= 4;

  return clampScore100(Math.round(score), 80);
}

/**
 * Minifig score rules (0–100)
 * Start at 100 and subtract.
 */
function computeMinifigScore100(bb: any) {
  let score = 100;

  if (bb.cracks) score -= 40;
  if (bb.looseJoints) score -= 30;
  if (bb.biteMarks) score -= 30;

  if (bb.yellowing) score -= 20;
  if (bb.grime) score -= 10;

  if (bb.hasAccessories === false) score -= 10;

  return clampScore100(Math.round(score), 80);
}

function buildLegoConditionJson(mode: "set" | "minifig", bb: any) {
  // Determine state string
  const state = bb.sealed
    ? "sealed"
    : bb.piecesComplete !== false
      ? "open_complete"
      : "open_incomplete";

  return {
    v: 1,
    item_type: "lego",
    mode: "context",
    data: {
      type: mode === "set" ? "set" : "minifig",
      state,
      sealed: !!bb.sealed,
      pieces_complete: bb.piecesComplete !== false,

      box: {
        included: !!bb.box?.included,
        tier: clampTier10(bb.box?.tier ?? bb.box?.score ?? 8, 8),
      },
      instructions: {
        included: !!bb.instructions?.included,
        tier: clampTier10(bb.instructions?.tier ?? bb.instructions?.score ?? 8, 8),
      },
      stickers: {
        applied: !!(bb.stickers?.applied ?? bb.stickersApplied),
        tier: clampTier10(bb.stickers?.tier ?? bb.stickerQuality ?? 8, 8),
      },

      discoloration_tier: clampTier10(bb.discoloration_tier ?? bb.discoloration ?? 8, 8),
      yellowing: !!bb.yellowing,

      // Set-only
      minifigs: Array.isArray(bb.minifigs) ? bb.minifigs : [],

      // Minifig-only flags
      hasAccessories: bb.hasAccessories !== false,
      cracks: !!bb.cracks,
      looseJoints: !!bb.looseJoints,
      biteMarks: !!bb.biteMarks,
      grime: !!bb.grime,
    },
  };
}

export default function ItemConditionBuildingBlocks({
  mode,
  catalogItemId,
  expectedMinifigs = [],
  conditionValues,
  conditionScore,
  onChange,
}: Props) {
  // Normalize input (condition_json) into an internal "bb" state shape the UI expects.
  const root = useMemo(() => {
    const cv = conditionValues ?? {};
    const data = cv?.data ?? {};
    const bb = data ?? {};
    const type = bb.type ?? (mode === "set" ? "set" : "minifig");

    const normalizedBB: any = {
      type,

      sealed: !!bb.sealed,
      box: {
        included: !!bb.box?.included,
        tier: clampTier10(bb.box?.tier ?? 8, 8),
      },
      instructions: {
        included: !!bb.instructions?.included,
        tier: clampTier10(bb.instructions?.tier ?? 8, 8),
      },
      piecesComplete: bb.pieces_complete !== false,

      stickersApplied: !!bb.stickers?.applied,
      stickerQuality: clampTier10(bb.stickers?.tier ?? 8, 8),

      discoloration: clampTier10(bb.discoloration_tier ?? 8, 8),
      yellowing: !!bb.yellowing,

      minifigs: Array.isArray(bb.minifigs) ? bb.minifigs : [],

      // minifig-only flags
      hasAccessories: bb.hasAccessories !== false,
      cracks: !!bb.cracks,
      looseJoints: !!bb.looseJoints,
      biteMarks: !!bb.biteMarks,
      grime: !!bb.grime,
    };

    return { bb: normalizedBB };
  }, [conditionValues, conditionScore, mode]);

  const bb = root.bb;

  // Ensure 1 row per expected instance (set mode)
  useEffect(() => {
    if (mode !== "set") return;

    const current: Array<{ instance_key?: string; included: boolean }> = Array.isArray(bb.minifigs)
      ? bb.minifigs
      : [];

    const map = new Map<string, boolean>();
    for (const r of current) {
      const k = rowKey(r);
      if (k) map.set(k, !!r.included);
    }

    let changed = false;

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
          instance_key: k,
          included: !!map.get(k),
        };
      })
      .filter(Boolean) as Array<{ instance_key: string; included: boolean }>;

    const nextBB = { ...bb, type: "set", minifigs: nextMinifigs };
    const nextJson = buildLegoConditionJson("set", {
      ...nextBB,
      stickers: { applied: nextBB.stickersApplied, tier: nextBB.stickerQuality },
      discoloration_tier: nextBB.discoloration,
    });
    const nextScore100 = computeLegoScore100(nextBB, expectedMinifigs);

    onChange(nextJson, nextScore100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, catalogItemId, expectedMinifigs]);

  const minifigState = useMemo(() => {
    const rows: Array<{ instance_key?: string; included: boolean }> = Array.isArray(bb.minifigs)
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

  const score100 = useMemo(() => {
    if (mode === "set") return computeLegoScore100(bb, expectedMinifigs);
    return computeMinifigScore100(bb);
  }, [mode, bb, expectedMinifigs]);

  const tier10 = useMemo(() => deriveTierFromScore100(score100), [score100]);

  const push = (nextBB: any) => {
    const nextJson = buildLegoConditionJson(mode, {
      ...nextBB,
      stickers: { applied: nextBB.stickersApplied, tier: nextBB.stickerQuality },
      discoloration_tier: nextBB.discoloration,
    });

    const nextScore100 = mode === "set" ? computeLegoScore100(nextBB, expectedMinifigs) : computeMinifigScore100(nextBB);
    onChange(nextJson, nextScore100);
  };

  const setBB = (patch: Partial<typeof bb>) => {
    const nextBB: any = { ...bb, ...patch };
    push(nextBB);
  };

  const setBBNested = (path: "box" | "instructions", patch: any) => {
    const nextBB: any = { ...bb, [path]: { ...(bb as any)[path], ...patch } };
    push(nextBB);
  };

  const setMinifigIncluded = (instanceKey: string, included: boolean) => {
    const curr: Array<{ instance_key?: string; included: boolean }> = Array.isArray(bb.minifigs)
      ? bb.minifigs
      : [];

    const key = String(instanceKey);
    const next = curr.map((r) => (rowKey(r) === key ? { ...r, included } : r));

    const nextBB: any = { ...bb, minifigs: next };
    push(nextBB);
  };

  const setAllMinifigs = (included: boolean) => {
    const next = expectedMinifigs
      .map((mf) => {
        const k = mfKey(mf);
        if (!k) return null;
        return { instance_key: k, included };
      })
      .filter(Boolean) as Array<{ instance_key: string; included: boolean }>;

    const nextBB: any = { ...bb, minifigs: next };
    push(nextBB);
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
            {tier10}/10 • {score100}/100 — {getConditionLabel(tier10)}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    value={clampTier10(bb.box?.tier ?? 8, 8)}
                    onChange={(e) => setBBNested("box", { tier: clampTier10(e.target.value, 8) })}
                    disabled={!!bb.sealed || !bb.box?.included}
                  >
                    {scoreOptions().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-[#0F172A]">{getConditionLabel(clampTier10(bb.box?.tier ?? 8, 8))}</span>
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
                    value={clampTier10(bb.instructions?.tier ?? 8, 8)}
                    onChange={(e) => setBBNested("instructions", { tier: clampTier10(e.target.value, 8) })}
                    disabled={!!bb.sealed || !bb.instructions?.included}
                  >
                    {scoreOptions().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-[#0F172A]">{getConditionLabel(clampTier10(bb.instructions?.tier ?? 8, 8))}</span>
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
                    value={clampTier10(bb.stickerQuality ?? 8, 8)}
                    onChange={(e) => setBB({ stickerQuality: clampTier10(e.target.value, 8) })}
                    disabled={!!bb.sealed || !bb.stickersApplied}
                  >
                    {scoreOptions().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-[#0F172A]">{getConditionLabel(clampTier10(bb.stickerQuality ?? 8, 8))}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <div className="text-xs font-semibold text-[#0F172A]">Discoloration / Yellowing</div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    className="rounded-xl border border-[#E5E9F2] bg-white px-2 py-1 text-xs font-semibold"
                    value={clampTier10(bb.discoloration ?? 8, 8)}
                    onChange={(e) => setBB({ discoloration: clampTier10(e.target.value, 8) })}
                    disabled={!!bb.sealed}
                  >
                    {scoreOptions().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-[#0F172A]">{getConditionLabel(clampTier10(bb.discoloration ?? 8, 8))}</span>
                </div>

                <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[#0F172A]">
                  <input type="checkbox" checked={!!bb.yellowing} onChange={(e) => setBB({ yellowing: e.target.checked })} disabled={!!bb.sealed} />
                  Visible yellowing present
                </label>
              </div>
            </div>
          </div>
        ) : null}

        {mode === "minifig" ? (
          <div className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-3 space-y-3 md:col-span-2">
            <div className="text-xs font-semibold text-[#0F172A]">Minifigure Details</div>

            <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
              <span className="text-xs font-semibold text-[#0F172A]">Accessories included</span>
              <input type="checkbox" checked={bb.hasAccessories !== false} onChange={(e) => setBB({ hasAccessories: e.target.checked })} />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Cracks</span>
                <input type="checkbox" checked={!!bb.cracks} onChange={(e) => setBB({ cracks: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Loose joints</span>
                <input type="checkbox" checked={!!bb.looseJoints} onChange={(e) => setBB({ looseJoints: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Bite marks</span>
                <input type="checkbox" checked={!!bb.biteMarks} onChange={(e) => setBB({ biteMarks: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Yellowing</span>
                <input type="checkbox" checked={!!bb.yellowing} onChange={(e) => setBB({ yellowing: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Grime / dirt</span>
                <input type="checkbox" checked={!!bb.grime} onChange={(e) => setBB({ grime: e.target.checked })} />
              </label>
            </div>

            <div className="text-[11px] text-[#6B7280]">Score is calculated automatically from the selected issues.</div>
          </div>
        ) : null}
      </div>

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
                        {mf.instance_key?.includes("#") ? (
                          <span className="ml-1 text-[11px] font-semibold text-[#64748B]">
                            (#{mf.instance_key.split("#")[1]})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-[#6B7280] truncate">{safeText(mf.minifig_number)}</div>
                    </div>

                    <input type="checkbox" checked={included} onChange={(e) => setMinifigIncluded(k, e.target.checked)} disabled={!k} />
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
