"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getConditionLabel } from "@/lib/pricingEngine";
import ItemConditionBuildingBlocks from "@/components/catalog/ItemConditionBuildingBlocks";

type Minifig = { id: string; minifig_number: string; name: string | null; image_url: string | null };

type ConditionState = "sealed" | "open_complete" | "open_incomplete" | "loose";
type ConditionGrade = "mint" | "excellent" | "good" | "fair" | "poor";
type ConditionMeta = { state: ConditionState; grade: ConditionGrade; flags: string[] };

function clampTier10(n: any, fallback = 8) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(10, x));
}

function normalizeCert(input: any): string {
  const s = String(input ?? "").trim().replace(/\s+/g, " ");
  return s.slice(0, 64);
}

function deriveGradeLabel(gradingCompany: string, gradeValue: any, isBlackLabel: boolean) {
  const gv = Number(gradeValue);
  const gvText = Number.isFinite(gv) ? String(gv) : "—";
  if ((gradingCompany || "").toUpperCase() === "BGS" && isBlackLabel) return "BGS Black Label";
  if (gradingCompany) return `${gradingCompany} ${gvText}`;
  return `Graded ${gvText}`;
}

function gradeFromTier10(tier10: number): ConditionGrade {
  const t = clampTier10(tier10, 8);
  if (t >= 9) return "mint";
  if (t >= 8) return "excellent";
  if (t >= 6) return "good";
  if (t >= 4) return "fair";
  return "poor";
}

function uniqFlags(flags: string[]) {
  return Array.from(new Set(flags.filter(Boolean)));
}

/**
 * Graded card value -> tier10 (1–10) for UI labels only
 * (No more numeric score as source of truth.)
 */
function gradedToTier10(company: string, gradeValue: any, isBlackLabel: boolean) {
  const c = String(company || "").toUpperCase();
  const g = Number(gradeValue);

  if (c === "BGS" && isBlackLabel) return 10;

  const map: Record<string, number> = {
    "10": 10,
    "9.5": 10,
    "9": 9,
    "8.5": 9,
    "8": 8,
    "7.5": 8,
    "7": 7,
    "6.5": 7,
    "6": 6,
    "5": 5,
    "4": 4,
    "3": 3,
    "2": 2,
    "1": 1,
  };

  const key = Number.isFinite(g) ? String(g) : "";
  return clampTier10(map[key] ?? 8, 8);
}

function SectionCard({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
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
    <div className={`rounded-xl border bg-white px-3 py-2 ${emphasize ? "border-[#F59E0B] bg-[#FFFBEB]" : "border-[#E5E9F2]"}`}>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
      <div className="text-sm text-[#0F172A] font-medium">{label}</div>
      <select
        className="mt-2 w-full rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
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
        className={`mt-2 w-full rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-sm ${disabled ? "opacity-70 cursor-not-allowed" : ""}`}
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
        className={`mt-2 w-full rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-sm ${disabled ? "opacity-70 cursor-not-allowed" : ""}`}
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

/** 1–10 pill UI */
function ScorePills({
  valueTier10,
  disabled,
  onPick,
}: {
  valueTier10: number;
  disabled?: boolean;
  onPick: (nextTier10: number) => void;
}) {
  const v = clampTier10(valueTier10, 8);

  return (
    <div className={`${disabled ? "opacity-70 pointer-events-none" : ""}`}>
      <div className="grid grid-cols-10 gap-3">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = n === v;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onPick(n)}
              className={`h-14 rounded-2xl text-lg font-bold border transition ${
                active ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F8FAFC]"
              }`}
              title={`${n} — ${getConditionLabel(n)}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function metaForGeneric(tier10: number, forParts: boolean): ConditionMeta {
  const t = clampTier10(tier10, 8);

  if (forParts) {
    return { state: "open_incomplete", grade: "poor", flags: ["for_parts"] };
  }

  return {
    state: "open_complete",
    grade: gradeFromTier10(t),
    flags: [],
  };
}

function metaForGradedCard(company: string, gradeValue: any, black: boolean, forParts: boolean): ConditionMeta {
  if (forParts) return { state: "open_incomplete", grade: "poor", flags: ["for_parts"] };

  const tier10 = gradedToTier10(company, gradeValue, black);
  const flags = ["graded", String(company || "").toUpperCase()].filter(Boolean);

  if (String(company || "").toUpperCase() === "BGS" && black) flags.push("black_label");

  return {
    state: "open_complete",
    grade: gradeFromTier10(tier10),
    flags: uniqFlags(flags),
  };
}

export default function ItemConditionSelector({
  catalogItemId,
  categoryName,
  isBuildingBlocks,
  isGradableCategory,
  conditionValues,
  conditionMeta,
  onChange,
}: {
  catalogItemId: string;
  categoryName: string | null;
  isBuildingBlocks: boolean;
  isGradableCategory: boolean;

  // NOW: this is condition_json
  conditionValues: Record<string, any>;

  // NEW: state/grade/flags
  conditionMeta?: ConditionMeta;

  // NEW: return json + meta (no score)
  onChange: (nextValues: Record<string, any>, nextMeta: ConditionMeta) => void;
}) {
  const [linkedMinifigs, setLinkedMinifigs] = useState<Minifig[]>([]);

  // If LEGO, we load minifigs for the checklist editor.
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

  // ✅ LEGO path: only render the building blocks editor.
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
        conditionMeta={conditionMeta}
        onChange={onChange}
      />
    );
  }

  // --- NON-LEGO PATH (simple v1) ---
  const data = conditionValues?.data ?? {};
  const forParts = !!data?.for_parts;

  const isGraded = !!data?.is_graded;

  const tier10 = useMemo(() => {
    if (forParts) return 2;

    if (isGradableCategory && isGraded) {
      const company = String(data?.grading_company || "").toUpperCase();
      const black = !!data?.is_black_label;
      return gradedToTier10(company, data?.grade_value, black);
    }

    return clampTier10(data?.tier10 ?? 8, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.tier10, data?.for_parts, isGradableCategory, isGraded, data?.grading_company, data?.grade_value, data?.is_black_label]);

  const summaryRight = useMemo(() => {
    if (forParts) return { scoreText: "For Parts", labelText: "" };
    const t = clampTier10(tier10, 8);
    return { scoreText: String(t), labelText: getConditionLabel(t) };
  }, [forParts, tier10]);

  // Keep derived graded label in sync (in JSON) and emit meta
  useEffect(() => {
    if (!isGradableCategory) return;
    if (!isGraded) return;

    const company = String(data?.grading_company || "").toUpperCase();
    const black = !!data?.is_black_label;

    const nextJson = {
      v: 1,
      item_type: "card",
      mode: "graded",
      data: {
        ...data,
        grade_label: deriveGradeLabel(String(data?.grading_company || ""), data?.grade_value, black),
      },
    };

    const nextMeta = metaForGradedCard(company, data?.grade_value, black, !!data?.for_parts);
    onChange(nextJson, nextMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGradableCategory, isGraded, data?.grade_value, data?.grading_company, data?.is_black_label]);

  return (
    <SectionCard
      title="Condition"
      right={
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-[#0F172A]">{summaryRight.scoreText}</span>
          <span className="text-base font-bold text-[#0F172A]">{summaryRight.labelText ? `— ${summaryRight.labelText}` : ""}</span>
          {isGradableCategory && isGraded && data?.grade_label ? (
            <span className="text-sm font-semibold text-[#64748B]">• {String(data.grade_label)}</span>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3">
        <ScorePills
          valueTier10={tier10}
          disabled={isGradableCategory && isGraded}
          onPick={(nextTier10) => {
            const t = clampTier10(nextTier10, 8);

            const nextJson = {
              v: 1,
              item_type: "generic",
              mode: "tier10",
              data: {
                ...(data ?? {}),
                tier10: t,
                for_parts: !!(data ?? {})?.for_parts,
              },
            };

            const nextMeta = metaForGeneric(t, !!(data ?? {})?.for_parts);
            onChange(nextJson, nextMeta);
          }}
        />

        <CheckboxRow
          label="Broken / For Parts"
          checked={!!data?.for_parts}
          onChange={(v) => {
            const nextJson = {
              v: 1,
              item_type: conditionValues?.item_type ?? "generic",
              mode: conditionValues?.mode ?? "tier10",
              data: {
                ...(data ?? {}),
                for_parts: v,
              },
            };

            if (isGradableCategory && !!data?.is_graded) {
              const company = String(data?.grading_company || "").toUpperCase();
              const black = !!data?.is_black_label;
              const nextMeta = metaForGradedCard(company, data?.grade_value, black, v);
              onChange(nextJson, nextMeta);
              return;
            }

            const t = clampTier10((data ?? {})?.tier10 ?? tier10, 8);
            const nextMeta = metaForGeneric(t, v);
            onChange(nextJson, nextMeta);
          }}
          emphasize
          subtext={<span className="text-[#B45309]">Use this if it’s damaged, incomplete, or only good for parts.</span>}
        />

        {isGradableCategory ? (
          <CheckboxRow
            label="Is graded?"
            checked={!!data?.is_graded}
            onChange={(v) => {
              if (!v) {
                const t = clampTier10(data?.tier10 ?? tier10, 8);
                const nextJson = {
                  v: 1,
                  item_type: "card",
                  mode: "raw",
                  data: {
                    is_graded: false,
                    tier10: t,
                    for_parts: !!data?.for_parts,
                  },
                };
                const nextMeta = metaForGeneric(t, !!data?.for_parts);
                onChange(nextJson, nextMeta);
                return;
              }

              const nextData: any = {
                ...data,
                is_graded: true,
                grading_company: data?.grading_company || "PSA",
                grade_value: data?.grade_value ?? 8,
                is_black_label: !!data?.is_black_label,
                certification_number: String(data?.certification_number ?? ""),
              };

              const company = String(nextData.grading_company || "").toUpperCase();
              const black = !!nextData.is_black_label;

              const nextJson = {
                v: 1,
                item_type: "card",
                mode: "graded",
                data: {
                  ...nextData,
                  grade_label: deriveGradeLabel(String(nextData.grading_company || ""), nextData.grade_value, black),
                },
              };

              const nextMeta = metaForGradedCard(company, nextData.grade_value, black, !!nextData.for_parts);
              onChange(nextJson, nextMeta);
            }}
            subtext={<span className="text-[#64748B]">Enable only if it has a professional grade.</span>}
          />
        ) : null}

        {isGradableCategory && isGraded ? (
          <div className="space-y-2">
            <SelectRow
              label="Grading Company"
              value={typeof data?.grading_company === "string" ? data.grading_company : ""}
              options={["PSA", "BGS", "CGC", "SGC", "CBCS", "PGX", "Other"]}
              onChange={(v) => {
                const isBgs = String(v || "").toUpperCase() === "BGS";
                const nextData: any = { ...(data ?? {}), grading_company: v };
                if (!isBgs) nextData.is_black_label = false;

                // If BGS black label => force 10
                if (isBgs && !!nextData.is_black_label) nextData.grade_value = 10;

                const company = String(nextData.grading_company || "").toUpperCase();
                const black = !!nextData.is_black_label;

                const nextJson = {
                  v: 1,
                  item_type: "card",
                  mode: "graded",
                  data: {
                    ...nextData,
                    grade_label: deriveGradeLabel(String(v || ""), nextData.grade_value, black),
                  },
                };

                const nextMeta = metaForGradedCard(company, nextData.grade_value, black, !!nextData.for_parts);
                onChange(nextJson, nextMeta);
              }}
            />

            <NumberRow
              label="Grade Value"
              value={
                String(data?.grading_company || "").toUpperCase() === "BGS" && !!data?.is_black_label
                  ? "10"
                  : data?.grade_value === null || data?.grade_value === undefined
                    ? ""
                    : String(data.grade_value)
              }
              min={0}
              max={10}
              step={0.5}
              disabled={String(data?.grading_company || "").toUpperCase() === "BGS" && !!data?.is_black_label}
              onChange={(v) => {
                const company = String(data?.grading_company || "").toUpperCase();
                const black = !!data?.is_black_label;

                if (company === "BGS" && black) {
                  const nextJson = {
                    v: 1,
                    item_type: "card",
                    mode: "graded",
                    data: {
                      ...(data ?? {}),
                      grade_value: 10,
                      grade_label: deriveGradeLabel(String(data?.grading_company || ""), 10, true),
                    },
                  };
                  const nextMeta = metaForGradedCard(company, 10, true, !!data?.for_parts);
                  onChange(nextJson, nextMeta);
                  return;
                }

                const gv = v === "" ? null : Number(v);
                const nextData: any = { ...(data ?? {}), grade_value: gv };

                const nextJson = {
                  v: 1,
                  item_type: "card",
                  mode: "graded",
                  data: {
                    ...nextData,
                    grade_label: deriveGradeLabel(String(nextData?.grading_company || ""), gv, !!nextData?.is_black_label),
                  },
                };

                const nextMeta = metaForGradedCard(company, gv, !!nextData?.is_black_label, !!nextData?.for_parts);
                onChange(nextJson, nextMeta);
              }}
            />

            {String(data?.grading_company || "").toUpperCase() === "BGS" ? (
              <CheckboxRow
                label="Black Label"
                checked={!!data?.is_black_label}
                onChange={(v) => {
                  const company = String(data?.grading_company || "").toUpperCase();

                  if (company === "BGS" && v) {
                    const nextJson = {
                      v: 1,
                      item_type: "card",
                      mode: "graded",
                      data: {
                        ...(data ?? {}),
                        is_black_label: true,
                        grade_value: 10,
                        grade_label: deriveGradeLabel(String(data?.grading_company || ""), 10, true),
                      },
                    };
                    const nextMeta = metaForGradedCard(company, 10, true, !!data?.for_parts);
                    onChange(nextJson, nextMeta);
                    return;
                  }

                  const nextData: any = { ...(data ?? {}), is_black_label: v };

                  const nextJson = {
                    v: 1,
                    item_type: "card",
                    mode: "graded",
                    data: {
                      ...nextData,
                      grade_label: deriveGradeLabel(String(nextData?.grading_company || ""), nextData?.grade_value, !!v),
                    },
                  };

                  const nextMeta = metaForGradedCard(company, nextData.grade_value, !!nextData.is_black_label, !!nextData.for_parts);
                  onChange(nextJson, nextMeta);
                }}
                subtext={<span className="text-[#64748B]">If checked, grade is locked to 10.</span>}
              />
            ) : null}

            <TextRow
              label="Certification Number"
              value={typeof data?.certification_number === "string" ? data.certification_number : ""}
              placeholder="e.g. PSA 12345678"
              onChange={(v) => {
                const nextJson = {
                  v: 1,
                  item_type: "card",
                  mode: "graded",
                  data: {
                    ...(data ?? {}),
                    certification_number: normalizeCert(v),
                    grade_label: deriveGradeLabel(String(data?.grading_company || ""), data?.grade_value, !!data?.is_black_label),
                  },
                };

                const company = String(data?.grading_company || "").toUpperCase();
                const nextMeta = metaForGradedCard(company, data?.grade_value, !!data?.is_black_label, !!data?.for_parts);
                onChange(nextJson, nextMeta);
              }}
              help={<span>Optional, but recommended for graded items.</span>}
            />

            <div className="rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]">
              Derived condition:{" "}
              <span className="font-semibold">{`${tier10}/10`}</span> • {getConditionLabel(tier10)}
              {data?.grade_label ? <span className="text-[#64748B]"> • {String(data.grade_label)}</span> : null}
              {conditionMeta?.state && conditionMeta?.grade ? (
                <span className="text-[#64748B]"> • {conditionMeta.state} / {conditionMeta.grade}</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
