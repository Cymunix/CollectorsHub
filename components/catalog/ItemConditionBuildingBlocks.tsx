"use client";

import React, { useEffect, useMemo } from "react";
import type { ConditionMeta } from "@/lib/pricingEngine";

type Minifig = {
  minifig_id?: string;
  id?: string;
  instance_key?: string;
  minifig_number: string;
  name: string | null;
  image_url: string | null;
};

type ConditionStatus = "sealed" | "complete" | "incomplete" | "for_parts";

type MetaV3 = {
  status: ConditionStatus;
  flags: string[];
  notes?: string | null;
};

type Props = {
  mode: "set" | "minifig";
  catalogItemId: string;
  expectedMinifigs?: Minifig[];
  conditionValues: Record<string, any>;
  conditionMeta?: ConditionMeta;
  onChange: (nextValues: Record<string, any>, nextMeta: ConditionMeta) => void;
};

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function uniq(flags: string[]) {
  return Array.from(new Set((flags || []).filter(Boolean)));
}

function statusLabel(s: ConditionStatus) {
  if (s === "sealed") return "New & Sealed";
  if (s === "complete") return "Complete";
  if (s === "incomplete") return "Incomplete";
  return "For Parts";
}

function flagLabel(flag: string) {
  const map: Record<string, string> = {
    partial_seal: "Partial seal",
    box_missing: "Box missing",
    instructions_missing: "Instructions missing",
    pieces_incomplete: "Pieces incomplete",
    stickers_applied: "Stickers applied",
    yellowing: "Yellowing",
    discoloration: "Discoloration",
    accessories_missing: "Accessories missing",
    cracks: "Cracks",
    loose_joints: "Loose joints",
    bite_marks: "Bite marks",
    grime: "Grime / dirt",
    minifigs_missing: "Minifigs missing",
  };

  if (map[flag]) return map[flag];

  // flags like "minifigs_missing:2"
  if (flag.startsWith("minifigs_missing:")) {
    const n = flag.split(":")[1];
    return `Minifigs missing (${n})`;
  }

  return flag.replaceAll("_", " ");
}

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

function computeLegoMeta(mode: "set" | "minifig", bb: any, expectedMinifigs: Minifig[]): MetaV3 {
  const flags: string[] = [];

  // Explicit For Parts always wins.
  if (!!bb.forParts) {
    return { status: "for_parts", flags: uniq(["for_parts", ...flags]) };
  }

  if (mode === "minifig") {
    // Minifig is basically "complete unless issues" (no fake grading).
    if (bb.hasAccessories === false) flags.push("accessories_missing");
    if (!!bb.cracks) flags.push("cracks");
    if (!!bb.looseJoints) flags.push("loose_joints");
    if (!!bb.biteMarks) flags.push("bite_marks");
    if (!!bb.yellowing) flags.push("yellowing");
    if (!!bb.grime) flags.push("grime");

    // If it has serious issues, treat as incomplete (still not "for parts")
    const serious = !!bb.cracks || !!bb.biteMarks;
    const status: ConditionStatus = serious ? "incomplete" : "complete";

    return { status, flags: uniq(flags) };
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

  if (!boxIncluded) flags.push("box_missing");
  if (!instIncluded) flags.push("instructions_missing");
  if (!piecesComplete) flags.push("pieces_incomplete");
  if (!!bb.stickersApplied) flags.push("stickers_applied");
  if (!!bb.yellowing) flags.push("yellowing");
  if (!!bb.discoloration) flags.push("discoloration");

  if (partialSeal) flags.push("partial_seal");

  if (missing > 0) flags.push(`minifigs_missing:${missing}`);

  // Status rules:
  // - sealed -> sealed (even if user marks missing things, it's still sealed status)
  // - otherwise complete/incomplete based on completeness
  let status: ConditionStatus;
  if (sealed || partialSeal) status = "sealed";
  else status = piecesComplete && missing === 0 ? "complete" : "incomplete";

  return { status, flags: uniq(flags) };
}

function buildLegoConditionJson(mode: "set" | "minifig", bb: any, meta: MetaV3) {
  return {
    v: 3,
    item_type: "lego",
    mode: "context",
    meta,
    data: {
      type: mode === "set" ? "set" : "minifig",

      // status mirrors meta (helps old call-sites)
      status: meta.status,

      // Common
      for_parts: !!bb.forParts,

      // Set-only
      sealed: !!bb.sealed,
      partial_seal: !!bb.partialSeal,
      pieces_complete: bb.piecesComplete !== false,

      box: {
        included: !!bb.box?.included,
      },
      instructions: {
        included: !!bb.instructions?.included,
      },

      stickers_applied: !!bb.stickersApplied,
      discoloration: !!bb.discoloration,
      yellowing: !!bb.yellowing,

      minifigs: Array.isArray(bb.minifigs) ? bb.minifigs : [],

      // Minifig-only
      hasAccessories: bb.hasAccessories !== false,
      cracks: !!bb.cracks,
      looseJoints: !!bb.looseJoints,
      biteMarks: !!bb.biteMarks,
      grime: !!bb.grime,
    },
  };
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#E5E9F2] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-semibold text-[#0F172A]">
      {children}
    </span>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition ${
        active
          ? "bg-[#0F172A] text-white border-[#0F172A]"
          : "bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F8FAFC]"
      }`}
    >
      {children}
    </button>
  );
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

    const normalizedBB: any = {
      // shared
      forParts: !!bb.for_parts,

      // set
      sealed: !!bb.sealed,
      partialSeal: !!bb.partial_seal,
      box: {
        included: bb?.box?.included !== false, // default true
      },
      instructions: {
        included: bb?.instructions?.included !== false, // default true
      },
      piecesComplete: bb?.pieces_complete !== false,

      stickersApplied: !!(bb.stickers_applied ?? bb.stickersApplied),
      discoloration: !!bb.discoloration,
      yellowing: !!bb.yellowing,

      minifigs: Array.isArray(bb.minifigs) ? bb.minifigs : [],

      // minifig
      hasAccessories: bb.hasAccessories !== false,
      cracks: !!bb.cracks,
      looseJoints: !!bb.looseJoints,
      biteMarks: !!bb.biteMarks,
      grime: !!bb.grime,
    };

    return { bb: normalizedBB };
  }, [conditionValues]);

  const bb = root.bb;

  // Ensure 1 row per expected instance (set mode)
  useEffect(() => {
    if (mode !== "set") return;

    const current: Array<{ instance_key?: string; included: boolean }> = Array.isArray(bb.minifigs) ? bb.minifigs : [];

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

    const nextBB = { ...bb, minifigs: nextMinifigs };
    const nextMeta = computeLegoMeta("set", nextBB, expectedMinifigs);
    const nextJson = buildLegoConditionJson("set", nextBB, nextMeta);

    onChange(nextJson, nextMeta as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, catalogItemId, expectedMinifigs]);

  const minifigState = useMemo(() => {
    const rows: Array<{ instance_key?: string; included: boolean }> = Array.isArray(bb.minifigs) ? bb.minifigs : [];
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

  const push = (nextBB: any) => {
    const nextMeta = computeLegoMeta(mode, nextBB, expectedMinifigs);
    const nextJson = buildLegoConditionJson(mode, nextBB, nextMeta);
    onChange(nextJson, nextMeta as any);
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
    const curr: Array<{ instance_key?: string; included: boolean }> = Array.isArray(bb.minifigs) ? bb.minifigs : [];
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
            {statusLabel(meta.status)} {meta.flags.length ? `• ${meta.flags.slice(0, 3).map(flagLabel).join(" • ")}${meta.flags.length > 3 ? "…" : ""}` : ""}
          </Badge>
        </div>
      </div>

      {/* Status pills */}
      <div className="mt-4">
        <div className="text-xs font-semibold text-[#0F172A] mb-2">Overall status</div>
        <div className="flex flex-wrap gap-2">
          <Pill active={meta.status === "sealed"} onClick={() => setBB({ sealed: true, partialSeal: false, forParts: false })}>
            New & Sealed
          </Pill>
          <Pill active={meta.status === "complete"} onClick={() => setBB({ sealed: false, partialSeal: false, forParts: false })}>
            Complete
          </Pill>
          <Pill active={meta.status === "incomplete"} onClick={() => setBB({ sealed: false, partialSeal: false, forParts: false, piecesComplete: false })}>
            Incomplete
          </Pill>
          <Pill active={meta.status === "for_parts"} onClick={() => setBB({ forParts: true, sealed: false, partialSeal: false })}>
            For Parts
          </Pill>
        </div>

        {mode === "set" ? (
          <div className="mt-3 flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
              <input
                type="checkbox"
                checked={!!bb.partialSeal}
                onChange={(e) => setBB({ partialSeal: e.target.checked, sealed: e.target.checked ? false : bb.sealed })}
              />
              Partial seal
            </label>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {mode === "set" ? (
          <div className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-3 space-y-3 md:col-span-2">
            <div className="text-xs font-semibold text-[#0F172A]">Packaging & Contents</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Box included</span>
                <input type="checkbox" checked={!!bb.box?.included} onChange={(e) => setBBNested("box", { included: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Instructions included</span>
                <input
                  type="checkbox"
                  checked={!!bb.instructions?.included}
                  onChange={(e) => setBBNested("instructions", { included: e.target.checked })}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Pieces complete</span>
                <input type="checkbox" checked={bb.piecesComplete !== false} onChange={(e) => setBB({ piecesComplete: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Stickers applied</span>
                <input type="checkbox" checked={!!bb.stickersApplied} onChange={(e) => setBB({ stickersApplied: e.target.checked })} />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Discoloration</span>
                <input type="checkbox" checked={!!bb.discoloration} onChange={(e) => setBB({ discoloration: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-[#E5E9F2] bg-white p-3">
                <span className="text-xs font-semibold text-[#0F172A]">Yellowing</span>
                <input type="checkbox" checked={!!bb.yellowing} onChange={(e) => setBB({ yellowing: e.target.checked })} />
              </label>
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
          </div>
        ) : null}
      </div>

      {/* Minifigs */}
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
