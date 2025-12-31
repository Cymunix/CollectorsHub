"use client";

import React, { useEffect, useMemo } from "react";
import { getConditionLabel, metaToTier10, type ConditionMeta, type ConditionGrade, type ConditionState } from "@/lib/pricingEngine";

type Minifig = {
  minifig_id?: string;
  id?: string;
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
  conditionMeta?: ConditionMeta;
  onChange: (nextValues: Record<string, any>, nextMeta: ConditionMeta) => void;
};

function clampTier10(n: any, fallback = 8) {
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

function mfKey(mf: Minifig): string {
  return String(mf.instance_key ?? mf.minifig_id ?? mf.id ?? "");
}

function rowKey(r: any): string {
  return String(r?.instance_key ?? r?.minifig_id ?? r?.id ?? "");
}

function uniq(flags: string[]) {
  return Array.from(new Set((flags || []).filter(Boolean)));
}

function gradeFromTier10(t: number): ConditionGrade {
  const n = clampTier10(t, 8);
  if (n >= 9) return "mint";
  if (n >= 8) return "excellent";
  if (n >= 6) return "good";
  if (n >= 4) return "fair";
  return "poor";
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

function computeLegoMeta(mode: "set" | "minifig", bb: any, expectedMinifigs: Minifig[]): ConditionMeta {
  const flags: string[] = [];
  let state: ConditionState = "open_complete";

  if (mode === "minifig") {
    state = "loose";

    if (bb.hasAccessories === false) flags.push("accessories_missing");
    if (!!bb.cracks) flags.push("cracks");
    if (!!bb.looseJoints) flags.push("loose_joints");
    if (!!bb.biteMarks) flags.push("bite_marks");
    if (!!bb.yellowing) flags.push("yellowing");
    if (!!bb.grime) flags.push("grime");

    // grade heuristic
    let tier = 8;
    if (bb.cracks || bb.looseJoints || bb.biteMarks) tier = 4;
    if (bb.yellowing || bb.grime) tier = Math.min(tier, 6);
    if (bb.hasAccessories === false) tier = Math.min(tier, 6);

    return { state, grade: gradeFromTier10(tier), flags: uniq(flags) };
  }

  // --- SET MODE ---
  const sealed = !!bb.sealed;
  const partialSeal = !!bb.partialSeal;

  const piecesComplete = bb.piecesComplete !== false;

  const rows: Array<{ instance_key?: string; minifig_id?: string; id?: string; included: boolean }> = Array.isArray(bb.minifigs)
    ? bb.minifigs
    : [];

  const expected = expectedMinifigs ?? [];
  const included = expected.length > 0 ? getIncludedCount(rows, expected) : 0;
  const missing = expected.length > 0 ? Math.max(0, expected.length - included) : 0;

  const boxIncluded = !!bb.box?.included;
  const instIncluded = !!bb.instructions?.included;

  // sealed/partial sealed are packaging-driven (your requirement)
  if (sealed || partialSeal) {
    state = "sealed";
    flags.push("sealed");
    if (partialSeal) flags.push("partial_seal");

    // combo code: sealed variants
    const combo = `sealed_${boxIncluded ? "box" : "nobox"}_${instIncluded ? "inst" : "noinst"}`;
    flags.push(`combo:${combo}`);

    // grade is mostly box condition when sealed
    let tier = clampTier10(bb.box?.tier ?? 8, 8);

    // partial seal should not nuke value below open items:
    // allow a floor of 7 (excellent-ish) unless box is truly bad
    if (partialSeal) tier = Math.max(7, tier);

    // if box missing while "sealed", that’s weird but allow it
    if (!boxIncluded) flags.push("box_missing");
    if (!instIncluded) flags.push("instructions_missing");

    return { state, grade: gradeFromTier10(tier), flags: uniq(flags) };
  }

  // Open states
  state = piecesComplete && missing === 0 ? "open_complete" : "open_incomplete";
  if (!piecesComplete) flags.push("pieces_incomplete");
  if (missing > 0) flags.push(`minifigs_missing:${missing}`);

  if (!boxIncluded) flags.push("box_missing");
  if (!instIncluded) flags.push("instructions_missing");

  if (!!bb.stickersApplied) flags.push("stickers_applied");
  if (!!bb.yellowing) flags.push("yellowing");

  const discolorTier = clampTier10(bb.discoloration ?? 8, 8);
  if (discolorTier <= 5) flags.push("discoloration");

  // combo codes for packaging (your “box only = 1, box+inst = 2” idea, but human-readable)
  const combo = `open_${boxIncluded ? "box" : "nobox"}_${instIncluded ? "inst" : "noinst"}_${piecesComplete ? "pieces" : "nopieces"}`;
  flags.push(`combo:${combo}`);

  // grade heuristic (not user-entered)
  let tier = 8;
  if (state === "open_incomplete") tier = 6;
  if (!boxIncluded) tier = Math.min(tier, 7);
  if (!instIncluded) tier = Math.min(tier, 7);
  if (!!bb.yellowing) tier = Math.min(tier, 6);
  if (discolorTier <= 5) tier = Math.min(tier, 6);

  return { state, grade: gradeFromTier10(tier), flags: uniq(flags) };
}

function buildLegoConditionJson(mode: "set" | "minifig", bb: any, meta: ConditionMeta) {
  // state for storage (always derived)
  const state =
    meta.state === "sealed"
      ? "sealed"
      : mode === "minifig"
        ? "loose"
        : bb.piecesComplete !== false
          ? "open_complete"
          : "open_incomplete";

  return {
    v: 2,
    item_type: "lego",
    mode: "context",
    meta, // ✅ Path 2: store meta inside condition_json
    data: {
      type: mode === "set" ? "set" : "minifig",
      state,
      sealed: !!bb.sealed,
      partial_seal: !!bb.partialSeal,
      pieces_complete: bb.piecesComplete !== false,

      box: {
        included: !!bb.box?.included,
        tier: clampTier10(bb.box?.tier ?? 8, 8),
      },
      instructions: {
        included: !!bb.instructions?.included,
        tier: clampTier10(bb.instructions?.tier ?? 8, 8),
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
  conditionMeta,
  onChange,
}: Props) {
  const root = useMemo(() => {
    const cv = conditionValues ?? {};
    const data = cv?.data ?? {};
    const bb = data ?? {};
    const type = bb.type ?? (mode === "set" ? "set" : "minifig");

    const normalizedBB: any = {
      type,

      sealed: !!bb.sealed,
      partialSeal: !!bb.partial_seal,
      box: {
        included: bb?.box?.included !== false, // default true if unset
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
  }, [conditionValues, mode]);

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
        return { instance_key: k, included: !!map.get(k) };
      })
      .filter(Boolean) as Array<{ instance_key: string; included: boolean }>;

    const nextBB = { ...bb, type: "set", minifigs: nextMinifigs };
    const nextMeta = computeLegoMeta("set", nextBB, expectedMinifigs);
    const nextJson = buildLegoConditionJson("set", nextBB, nextMeta);

    onChange(nextJson, nextMeta);
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

    return { byId, total, includedCount };
  }, [bb.minifigs, expectedMinifigs]);

  const meta = useMemo(() => computeLegoMeta(mode, bb, expectedMinifigs), [mode, bb, expectedMinifigs]);
  const tier10 = useMemo(() => metaToTier10(meta), [meta]);

  const push = (nextBB: any) => {
    const nextMeta = computeLegoMeta(mode, nextBB, expectedMinifigs);
    const nextJson = buildLegoConditionJson(mode, nextBB, nextMeta);
    onChange(nextJson, nextMeta);
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
    push({ ...bb, minifigs: next });
  };

  const setAllMinifigs = (included: boolean) => {
    const next = expectedMinifigs
      .map((mf) => {
        const k = mfKey(mf);
        if (!k) return null;
        return { instance_key: k, included };
      })
      .filter(Boolean) as Array<{ instance_key: string; included: boolean }>;
    push({ ...bb, minifigs: next });
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
            {tier10}/10 • {getConditionLabel(tier10)} • {meta.state} / {meta.grade}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {mode === "set" ? (
          <div className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-3 space-y-3 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-[#0F172A]">Packaging & Contents</div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                  <input
                    type="checkbox"
                    checked={!!bb.sealed}
                    onChange={(e) => {
                      const sealed = e.target.checked;
                      setBB({ sealed, partialSeal: sealed ? false : bb.partialSeal });
                    }}
                  />
                  Sealed / New
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                  <input
                    type="checkbox"
                    checked={!!bb.partialSeal}
                    onChange={(e) => {
                      const partialSeal = e.target.checked;
                      setBB({ partialSeal, sealed: partialSeal ? false : bb.sealed });
                    }}
                  />
                  Partial seal
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#0F172A]">Box included</span>
                  <input
                    type="checkbox"
                    checked={!!bb.box?.included}
                    onChange={(e) => setBBNested("box", { included: e.target.checked })}
                  />
                </label>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#6B7280]">Box condition</span>
                  <select
                    className="rounded-xl border border-[#E5E9F2] bg-white px-2 py-1 text-xs font-semibold"
                    value={clampTier10(bb.box?.tier ?? 8, 8)}
                    onChange={(e) => setBBNested("box", { tier: clampTier10(e.target.value, 8) })}
                    disabled={!bb.box?.included}
                  >
                    {scoreOptions().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-[#0F172A]">{getConditionLabel(clampTier10(bb.box?.tier ?? 8, 8))}</span>
                </div>

                {(!!bb.sealed || !!bb.partialSeal) ? (
                  <div className="mt-2 text-[11px] text-[#64748B]">
                    Sealed/partial sealed: **box condition drives grade** (contents not evaluated).
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#0F172A]">Instructions included</span>
                  <input
                    type="checkbox"
                    checked={!!bb.instructions?.included}
                    onChange={(e) => setBBNested("instructions", { included: e.target.checked })}
                  />
                </label>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#6B7280]">Instruction condition</span>
                  <select
                    className="rounded-xl border border-[#E5E9F2] bg-white px-2 py-1 text-xs font-semibold"
                    value={clampTier10(bb.instructions?.tier ?? 8, 8)}
                    onChange={(e) => setBBNested("instructions", { tier: clampTier10(e.target.value, 8) })}
                    disabled={!bb.instructions?.included}
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
                  disabled={!!bb.sealed || !!bb.partialSeal}
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Stickers applied</span>
                <input
                  type="checkbox"
                  checked={!!bb.stickersApplied}
                  onChange={(e) => setBB({ stickersApplied: e.target.checked })}
                  disabled={!!bb.sealed || !!bb.partialSeal}
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
                    disabled={!!bb.sealed || !!bb.partialSeal || !bb.stickersApplied}
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
                    disabled={!!bb.sealed || !!bb.partialSeal}
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
                  <input
                    type="checkbox"
                    checked={!!bb.yellowing}
                    onChange={(e) => setBB({ yellowing: e.target.checked })}
                    disabled={!!bb.sealed || !!bb.partialSeal}
                  />
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

            <div className="text-[11px] text-[#6B7280]">Meta (state/grade/flags) is derived automatically from the selected issues.</div>
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
                disabled={expectedMinifigs.length === 0 || !!bb.sealed || !!bb.partialSeal}
                title={!!bb.sealed || !!bb.partialSeal ? "Sealed items don’t evaluate contents." : ""}
              >
                All
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                onClick={() => setAllMinifigs(false)}
                disabled={expectedMinifigs.length === 0 || !!bb.sealed || !!bb.partialSeal}
                title={!!bb.sealed || !!bb.partialSeal ? "Sealed items don’t evaluate contents." : ""}
              >
                None
              </button>
            </div>
          </div>

          {(!!bb.sealed || !!bb.partialSeal) ? (
            <div className="mt-3 rounded-xl border border-dashed border-[#CBD5E1] bg-white p-4 text-xs text-[#64748B]">
              Sealed / partial sealed: minifigure and piece completeness are not evaluated.
            </div>
          ) : expectedMinifigs.length === 0 ? (
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
