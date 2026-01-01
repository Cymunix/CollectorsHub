"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ConditionMeta, ConditionStatus } from "@/lib/pricingEngine";
import { statusLabel, flagLabel, getConditionLabel } from "@/lib/pricingEngine";
import ItemConditionBuildingBlocks from "@/components/catalog/ItemConditionBuildingBlocks";

type Minifig = { id: string; minifig_number: string; name: string | null; image_url: string | null };

function normalizeCert(input: any): string {
  const s = String(input ?? "").trim().replace(/\s+/g, " ");
  return s.slice(0, 64);
}

/* ---------------- Cards helpers ---------------- */

function isCardCategoryName(categoryName: string | null | undefined) {
  const c = String(categoryName ?? "").toLowerCase();
  if (!c) return false;
  // treat "trading cards" + "sports cards" as the same path
  return (
    c.includes("trading") ||
    c.includes("sports card") ||
    c.includes("sports cards") ||
    c.includes("trading card") ||
    c.includes("cards") ||
    c.includes("tcg")
  );
}

function clampInt(n: any, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.round(x)));
}

/* ---------------- BGS helpers ---------------- */

type BgsSubgrades = {
  centering?: number | null;
  corners?: number | null;
  edges?: number | null;
  surface?: number | null;
};

function readBgsSubgrades(data: any): BgsSubgrades | null {
  const sg = data?.grading_subgrades;
  if (!sg || typeof sg !== "object") return null;
  return {
    centering: sg.centering ?? null,
    corners: sg.corners ?? null,
    edges: sg.edges ?? null,
    surface: sg.surface ?? null,
  };
}

function isBlackLabel10(data: any) {
  return String(data?.grading_company ?? "").toUpperCase() === "BGS" && data?.grading_label === "bgs_black_10";
}

function blackLabelMismatch(sub: BgsSubgrades | null) {
  if (!sub) return true;
  const vals = [sub.centering, sub.corners, sub.edges, sub.surface];
  if (vals.some((v) => v == null)) return true;
  return vals.some((v) => Number(v) !== 10);
}

/* ---------------- UI ---------------- */

function SectionCard({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3 gap-3">
        <h2 className="text-sm font-semibold text-[#0F172A]">{title}</h2>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  subtext,
  emphasize,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  subtext?: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white px-3 py-2 ${
        emphasize ? "border-[#F59E0B] bg-[#FFFBEB]" : "border-[#E5E9F2]"
      }`}
    >
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[#CBD5E1]"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-sm text-[#0F172A]">{label}</span>
      </label>
      {subtext ? <div className="mt-2 text-xs text-[#64748B]">{subtext}</div> : null}
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
  disabled,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  help?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
      <div className="text-sm text-[#0F172A] font-medium">{label}</div>
      <select
        className={`mt-2 w-full rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-sm ${
          disabled ? "opacity-70 cursor-not-allowed" : ""
        }`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!!disabled}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {help ? <div className="mt-2 text-xs text-[#64748B]">{help}</div> : null}
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
      <div className="text-sm text-[#0F172A] font-medium">{label}</div>
      <input
        className={`mt-2 w-full rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-sm ${
          disabled ? "opacity-70 cursor-not-allowed" : ""
        }`}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        disabled={!!disabled}
      />
    </div>
  );
}

function TextRow({
  label,
  value,
  onChange,
  placeholder,
  help,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  help?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
      <div className="text-sm text-[#0F172A] font-medium">{label}</div>
      <input
        className={`mt-2 w-full rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-sm ${
          disabled ? "opacity-70 cursor-not-allowed" : ""
        }`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={!!disabled}
        maxLength={64}
      />
      {help ? <div className="mt-2 text-xs text-[#64748B]">{help}</div> : null}
    </div>
  );
}

function StatusPills({
  value,
  onPick,
}: {
  value: ConditionStatus;
  onPick: (next: ConditionStatus) => void;
}) {
  const options: ConditionStatus[] = ["sealed", "complete", "incomplete", "for_parts"];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((s) => {
        const active = s === value;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className={`rounded-full px-4 py-2 text-[12px] font-semibold border transition ${
              active
                ? "bg-[#0F172A] text-white border-[#0F172A]"
                : "bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F8FAFC]"
            }`}
            title={statusLabel(s)}
          >
            {statusLabel(s)}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- logic helpers ---------------- */

function toggleFlag(flags: string[], flag: string, nextOn: boolean) {
  const set = new Set((flags || []).filter(Boolean));
  if (nextOn) set.add(flag);
  else set.delete(flag);
  return Array.from(set);
}

function resolveMetaFromInputs(conditionValues: Record<string, any>, conditionMeta?: ConditionMeta): ConditionMeta {
  const data = conditionValues?.data ?? {};
  const meta = conditionMeta ?? conditionValues?.meta ?? null;

  const status: ConditionStatus =
    (meta?.status as ConditionStatus) ||
    (typeof data?.status === "string" ? (data.status as ConditionStatus) : null) ||
    (!!data?.sealed ? "sealed" : null) ||
    (!!data?.for_parts ? "for_parts" : null) ||
    "complete";

  const flags: string[] = Array.isArray(meta?.flags) ? meta.flags : Array.isArray(data?.flags) ? data.flags : [];

  const normalizedFlags =
    status === "for_parts" ? toggleFlag(flags, "for_parts", true) : toggleFlag(flags, "for_parts", false);

  return {
    status,
    flags: normalizedFlags,
  };
}

/* ---------------- component ---------------- */

export default function ItemConditionSelector({
  catalogItemId,
  categoryName,
  isBuildingBlocks,
  isGradableCategory, // kept for callers, but not gating
  conditionValues,
  conditionMeta,
  onChange,
}: {
  catalogItemId: string;
  categoryName: string | null;
  isBuildingBlocks: boolean;
  isGradableCategory: boolean;
  conditionValues: Record<string, any>;
  conditionMeta?: ConditionMeta;
  onChange: (nextValues: Record<string, any>, nextMeta: ConditionMeta) => void;
}) {
  const [linkedMinifigs, setLinkedMinifigs] = useState<Minifig[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadMinifigsIfAny = async () => {
      if (!isBuildingBlocks) {
        setLinkedMinifigs([]);
        return;
      }

      const linkRes = await supabase
        .from("catalog_building_block_set_minifigs")
        .select("minifig_id")
        .eq("catalog_item_id", catalogItemId)
        .limit(200);

      const ids = (linkRes.data ?? []).map((r: any) => r.minifig_id).filter(Boolean);

      if (!ids.length) {
        setLinkedMinifigs([]);
        return;
      }

      const mfRes = await supabase
        .from("catalog_minifigs")
        .select("id,name,minifig_number,image_url")
        .in("id", ids)
        .order("minifig_number", { ascending: true });

      if (cancelled) return;
      setLinkedMinifigs((mfRes.data ?? []) as Minifig[]);
    };

    if (catalogItemId) loadMinifigsIfAny();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId, isBuildingBlocks]);

  // ✅ LEGO path stays delegated
  if (isBuildingBlocks) {
    const expected = linkedMinifigs.map((m) => ({
      id: m.id,
      minifig_number: m.minifig_number,
      name: m.name,
      image_url: m.image_url,
    })) as any;

    return (
      <ItemConditionBuildingBlocks
        mode="set"
        catalogItemId={catalogItemId}
        expectedMinifigs={expected}
        conditionValues={conditionValues}
        conditionMeta={conditionMeta as any}
        onChange={onChange as any}
      />
    );
  }

  const data = conditionValues?.data ?? {};
  const meta = useMemo(() => resolveMetaFromInputs(conditionValues ?? {}, conditionMeta), [conditionValues, conditionMeta]);

  const isCard = useMemo(() => isCardCategoryName(categoryName), [categoryName]);

  const isGraded = !!data?.is_graded;

  // Cards: raw 1–10 lives here
  const rawGrade10 = useMemo(() => {
    const v = data?.raw_grade_10 ?? data?.rawGrade10 ?? data?.tier10;
    return clampInt(v, 1, 10, 8);
  }, [data?.raw_grade_10, data?.rawGrade10, data?.tier10]);

  const gradeCompany = String(data?.grading_company ?? "").toUpperCase();
  const gradeValueNum = data?.grade_value == null ? null : Number(data.grade_value);
  const isBgs = isGraded && gradeCompany === "BGS";
  const isTen = isBgs && gradeValueNum != null && Number.isFinite(gradeValueNum) && gradeValueNum === 10;

  const bgsSub = readBgsSubgrades(data);
  const trackingSubgrades = !!bgsSub;
  const blackMismatch = isBlackLabel10(data) && blackLabelMismatch(bgsSub);

  const summary = useMemo(() => {
    const chips: string[] = [];

    // Cards: show raw grade label prominently when not graded
    if (isCard && !isGraded) {
      chips.push(`RAW ${rawGrade10} • ${getConditionLabel(rawGrade10)}`);
    }

    // Show up to 3 flags
    const important = (meta.flags || []).filter((f) => f !== "for_parts").slice(0, 3);
    for (const f of important) chips.push(flagLabel(f));

    if (isGraded) {
      const c = data?.grading_company ? String(data.grading_company).toUpperCase() : "GRADED";
      const gv = data?.grade_value;
      chips.push(gv != null && Number.isFinite(Number(gv)) ? `${c} ${Number(gv)}` : c);

      if (c === "BGS" && typeof data?.grading_label === "string" && data.grading_label) {
        chips.push(data.grading_label === "bgs_black_10" ? "BLACK LABEL" : "GOLD LABEL");
      }
    }

    // Title: if graded, treat as graded (even if meta.status is "complete")
    const title = isGraded ? "Graded" : statusLabel(meta.status);

    return { title, chips };
  }, [meta, data, isGraded, isCard, rawGrade10]);

  const emit = (nextMeta: ConditionMeta, nextDataPatch?: Record<string, any>) => {
    // ✅ If graded is on, meta.status should be "graded" for pricing/filtering consistency
    const patchedMeta: ConditionMeta =
      (nextDataPatch?.is_graded ?? data?.is_graded) ? { ...nextMeta, status: "graded" } : nextMeta;

    const nextData: Record<string, any> = {
      ...(data ?? {}),
      ...(nextDataPatch ?? {}),
      status: patchedMeta.status,
      flags: patchedMeta.flags,
      sealed: patchedMeta.status === "sealed",
      for_parts: patchedMeta.status === "for_parts",
    };

    const nextJson = {
      v: 3,
      item_type: conditionValues?.item_type ?? "generic",
      category: categoryName ?? null,
      meta: patchedMeta,
      data: nextData,
    };

    onChange(nextJson, patchedMeta);
  };

  const setStatus = (s: ConditionStatus) => {
    // Cards are almost never "sealed/incomplete" in the same sense.
    // But we won't block it; we just keep it simple.
    const nextMeta: ConditionMeta = {
      ...meta,
      status: s,
      flags:
        s === "for_parts" ? toggleFlag(meta.flags, "for_parts", true) : toggleFlag(meta.flags, "for_parts", false),
    };

    emit(nextMeta);
  };

  const setFlag = (flag: string, on: boolean) => {
    if (flag === "for_parts") return;
    const nextFlags = toggleFlag(meta.flags, flag, on);
    emit({ ...meta, flags: nextFlags });
  };

  const setRawGrade10 = (v: string) => {
    const n = v === "" ? null : Number(v);
    const tier = n != null && Number.isFinite(n) ? clampInt(n, 1, 10, 8) : 8;
    emit(meta, { raw_grade_10: tier });
  };

  const setGraded = (on: boolean) => {
    if (!on) {
      emit(
        {
          ...meta,
          status: meta.status === "graded" ? "complete" : meta.status,
        },
        {
          is_graded: false,
          grading_company: null,
          grade_value: null,
          certification_number: "",
          grading_label: null,
          grading_subgrades: null,
        }
      );
      return;
    }

    const company =
      typeof data?.grading_company === "string" && data.grading_company.trim().length ? data.grading_company : "PSA";

    const gradeValue =
      data?.grade_value === null || data?.grade_value === undefined || data?.grade_value === "" ? 9 : Number(data.grade_value);

    emit(
      {
        ...meta,
        status: "graded",
      },
      {
        is_graded: true,
        grading_company: company,
        grade_value: Number.isFinite(gradeValue) ? gradeValue : null,
        certification_number: String(data?.certification_number ?? ""),
        // Keep raw_grade_10 as-is so "Raw 10" and "Graded 10" share the same meaning words.
        raw_grade_10: clampInt(data?.raw_grade_10 ?? rawGrade10, 1, 10, 8),
      }
    );
  };

  const setGradeCompany = (company: string) => {
    const nextCompany = String(company || "").toUpperCase();
    if (nextCompany !== "BGS") {
      emit(
        { ...meta, status: "graded" },
        { is_graded: true, grading_company: company, grading_label: null, grading_subgrades: null }
      );
      return;
    }
    emit({ ...meta, status: "graded" }, { is_graded: true, grading_company: company });
  };

  const setGradeValue = (v: string) => {
    const n = v === "" ? null : Number(v);
    const gv = n != null && Number.isFinite(n) ? n : null;

    if (String(data?.grading_company ?? "").toUpperCase() === "BGS" && gv !== 10) {
      emit({ ...meta, status: "graded" }, { is_graded: true, grade_value: gv, grading_label: null });
      return;
    }

    emit({ ...meta, status: "graded" }, { is_graded: true, grade_value: gv });
  };

  const setCert = (v: string) => {
    emit({ ...meta, status: "graded" }, { certification_number: normalizeCert(v) });
  };

  const setGradingLabel = (label: string) => {
    emit({ ...meta, status: "graded" }, { is_graded: true, grading_label: label || null });
  };

  const setTrackSubgrades = (on: boolean) => {
    if (!on) {
      emit({ ...meta, status: "graded" }, { grading_subgrades: null });
      return;
    }

    const next: BgsSubgrades = isBlackLabel10(data)
      ? { centering: 10, corners: 10, edges: 10, surface: 10 }
      : { centering: null, corners: null, edges: null, surface: null };

    emit({ ...meta, status: "graded" }, { grading_subgrades: next });
  };

  const setOneSubgrade = (key: keyof BgsSubgrades, v: string) => {
    const n = v === "" ? null : Number(v);
    const val = n != null && Number.isFinite(n) ? n : null;

    const current = readBgsSubgrades(data) ?? {};
    const next = { ...current, [key]: val };

    emit({ ...meta, status: "graded" }, { grading_subgrades: next });
  };

  // Generic flags (keep for now; we can specialize later)
  const flagOptions: { key: string; label: string; sub?: string }[] = [
    { key: "damaged", label: "Damaged" },
    { key: "scratched", label: "Scratched / scuffed" },
    { key: "not_working", label: "Not working", sub: "Use for electronics/toys that fail testing." },
    { key: "untested", label: "Untested", sub: "If you couldn’t verify functionality." },
    { key: "accessories_missing", label: "Accessories missing" },
  ];

  return (
    <SectionCard
      title="Condition"
      right={
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-[#0F172A]">{summary.title}</span>
          {summary.chips.length ? (
            <span className="text-xs font-semibold text-[#64748B]">• {summary.chips.join(" • ")}</span>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Cards: RAW 1–10 condition (this is the missing piece you wanted) */}
        {isCard ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-[#0F172A]">Raw card condition (1–10)</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <SelectRow
                label="Raw grade (1–10)"
                value={String(rawGrade10)}
                options={Array.from({ length: 10 }).map((_, i) => String(i + 1))}
                onChange={setRawGrade10}
                disabled={false}
                help={
                  <span>
                    Words match graded meaning (e.g. raw 10 and graded 10 are both <span className="font-semibold">Gem Mint</span>).
                  </span>
                }
              />
              <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
                <div className="text-sm text-[#0F172A] font-medium">Label</div>
                <div className="mt-2 text-sm font-semibold text-[#0F172A]">{getConditionLabel(rawGrade10)}</div>
                <div className="mt-1 text-xs text-[#64748B]">
                  This is the “words” part. Grading companies add value; they don’t change what Mint means.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Status (non-cards) */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-[#0F172A]">Overall status</div>
              <StatusPills value={meta.status} onPick={setStatus} />
              <div className="text-xs text-[#64748B]">
                This is the only “big” condition choice. Everything else is just extra details.
              </div>
            </div>

            {/* Flags (non-cards) */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-[#0F172A]">Details</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {flagOptions.map((f) => (
                  <CheckboxRow
                    key={f.key}
                    label={f.label}
                    checked={(meta.flags || []).includes(f.key)}
                    onChange={(v) => setFlag(f.key, v)}
                    subtext={f.sub ? <span>{f.sub}</span> : undefined}
                  />
                ))}
              </div>
            </div>

            {meta.status === "for_parts" ? (
              <div className="rounded-xl border border-[#F59E0B] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
                <span className="font-semibold">For Parts</span> means it’s broken / incomplete enough that it should be priced accordingly.
              </div>
            ) : null}
          </>
        )}

        {/* Grading (anything can be graded) */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-[#0F172A]">Grading</div>

          <CheckboxRow
            label="This item is graded"
            checked={isGraded}
            onChange={setGraded}
            subtext={<span className="text-[#64748B]">Turn this on only if it has an official grade slab/case.</span>}
          />

          {isGraded ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <SelectRow
                  label="Company"
                  value={typeof data?.grading_company === "string" ? data.grading_company : ""}
                  options={["PSA", "BGS", "CGC", "SGC", "CBCS", "WATA", "AFA", "UKG", "Other"]}
                  onChange={setGradeCompany}
                />
                <NumberRow
                  label="Grade value"
                  value={data?.grade_value === null || data?.grade_value === undefined ? "" : String(data.grade_value)}
                  min={0}
                  max={10}
                  step={0.5}
                  onChange={setGradeValue}
                />
                <TextRow
                  label="Certification #"
                  value={typeof data?.certification_number === "string" ? data.certification_number : ""}
                  placeholder="Optional"
                  onChange={setCert}
                  help={<span>Optional, but recommended.</span>}
                />
              </div>

              {/* ✅ BGS extras */}
              {isBgs ? (
                <div className="mt-2 space-y-2">
                  {isTen ? (
                    <SelectRow
                      label="BGS label"
                      value={typeof data?.grading_label === "string" ? data.grading_label : ""}
                      options={["bgs_gold_10", "bgs_black_10"]}
                      onChange={setGradingLabel}
                      help={<span>Black Label 10 should only be used if all four subgrades are 10.</span>}
                    />
                  ) : null}

                  <CheckboxRow
                    label="Track BGS subgrades (Centering / Corners / Edges / Surface)"
                    checked={trackingSubgrades}
                    onChange={setTrackSubgrades}
                    subtext={<span className="text-[#64748B]">Optional, but enables Black Label verification.</span>}
                    emphasize={blackMismatch}
                  />

                  {trackingSubgrades ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <NumberRow
                        label="Centering"
                        value={bgsSub?.centering == null ? "" : String(bgsSub.centering)}
                        min={0}
                        max={10}
                        step={0.5}
                        onChange={(v) => setOneSubgrade("centering", v)}
                      />
                      <NumberRow
                        label="Corners"
                        value={bgsSub?.corners == null ? "" : String(bgsSub.corners)}
                        min={0}
                        max={10}
                        step={0.5}
                        onChange={(v) => setOneSubgrade("corners", v)}
                      />
                      <NumberRow
                        label="Edges"
                        value={bgsSub?.edges == null ? "" : String(bgsSub.edges)}
                        min={0}
                        max={10}
                        step={0.5}
                        onChange={(v) => setOneSubgrade("edges", v)}
                      />
                      <NumberRow
                        label="Surface"
                        value={bgsSub?.surface == null ? "" : String(bgsSub.surface)}
                        min={0}
                        max={10}
                        step={0.5}
                        onChange={(v) => setOneSubgrade("surface", v)}
                      />
                    </div>
                  ) : null}

                  {blackMismatch ? (
                    <div className="rounded-xl border border-[#F59E0B] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
                      <span className="font-semibold">Black Label check:</span> Black Label 10 requires all four subgrades to be 10.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Debug (optional) */}
        <div className="rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]">
          Stored meta: <span className="font-mono">{(isGraded ? "graded" : meta.status) as any}</span>
          {" • flags="}
          <span className="font-mono">[{(meta.flags || []).join(", ")}]</span>
          {isCard ? <span className="font-mono">{` • raw=${String(rawGrade10)}`}</span> : null}
          {data?.is_graded ? (
            <span className="font-mono">{` • grade=${String(data?.grading_company ?? "GRADED")} ${data?.grade_value ?? ""}`}</span>
          ) : null}
          {data?.grading_label ? <span className="font-mono">{` • label=${String(data.grading_label)}`}</span> : null}
          {data?.grading_subgrades ? <span className="font-mono">{` • subgrades=✓`}</span> : null}
        </div>
      </div>
    </SectionCard>
  );
}
