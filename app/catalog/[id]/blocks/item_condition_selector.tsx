"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getConditionLabel } from "@/lib/pricingEngine";
import ItemConditionBuildingBlocks from "@/components/catalog/ItemConditionBuildingBlocks";

type Minifig = { id: string; minifig_number: string; name: string | null; image_url: string | null };

function clampTier10(n: any, fallback = 8) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(10, x));
}

function tierToScore100(tier10: number) {
  return Math.max(0, Math.min(100, Math.round(tier10 * 10)));
}

function score100ToTier10(score100: number) {
  return clampTier10(Math.round(Number(score100 || 0) / 10), 8);
}

function normalizeCert(input: any): string {
  const s = String(input ?? "").trim().replace(/\s+/g, " ");
  return s.slice(0, 64);
}

/**
 * Grade -> 0–100 mapping (stable)
 * You can tune later, but do NOT constantly change it.
 */
function gradeToScore100(company: string, gradeValue: any, isBlackLabel: boolean) {
  const c = String(company || "").toUpperCase();
  const g = Number(gradeValue);

  if (c === "BGS" && isBlackLabel) return 100;

  // Support halves (9.5 etc)
  const map: Record<string, number> = {
    "10": 100,
    "9.5": 97,
    "9": 94,
    "8.5": 90,
    "8": 86,
    "7.5": 82,
    "7": 78,
    "6.5": 74,
    "6": 70,
    "5": 60,
    "4": 50,
    "3": 40,
    "2": 30,
    "1": 20,
  };

  const key = Number.isFinite(g) ? String(g) : "";
  return map[key] ?? 80;
}

function deriveGradeLabel(gradingCompany: string, gradeValue: any, isBlackLabel: boolean) {
  const gv = Number(gradeValue);
  const gvText = Number.isFinite(gv) ? String(gv) : "—";
  if ((gradingCompany || "").toUpperCase() === "BGS" && isBlackLabel) return "BGS Black Label";
  if (gradingCompany) return `${gradingCompany} ${gvText}`;
  return `Graded ${gvText}`;
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

export default function ItemConditionSelector({
  catalogItemId,
  categoryName,
  isBuildingBlocks,
  isGradableCategory,
  conditionValues,
  conditionScore,
  onChange,
}: {
  catalogItemId: string;
  categoryName: string | null;
  isBuildingBlocks: boolean;
  isGradableCategory: boolean;

  // NOW: this is condition_json
  conditionValues: Record<string, any>;

  // NOW: this is score 0–100
  conditionScore: number;

  // NOW: nextScore is 0–100
  onChange: (nextValues: Record<string, any>, nextScore: number) => void;
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
    // Convert linkedMinifigs into expected list (no duplicates here — your other component handles duplicates with instance_key)
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
        conditionScore={conditionScore}
        onChange={onChange}
      />
    );
  }

  // --- NON-LEGO PATH (simple v1) ---
  // We store a generic condition JSON with a tier10 input.
  const tier10 = useMemo(() => score100ToTier10(conditionScore), [conditionScore]);

  // Graded card detection: stored inside JSON
  const isGraded = !!conditionValues?.data?.is_graded;

  // Derived display
  const summaryRight = useMemo(() => {
    // For parts override
    if (!!conditionValues?.data?.for_parts) return { scoreText: "For Parts", labelText: "" };

    const t = clampTier10(tier10, 8);
    return { scoreText: String(t), labelText: getConditionLabel(t) };
  }, [conditionValues, tier10]);

  // Keep derived grade score in sync (0–100)
  useEffect(() => {
    if (!isGradableCategory) return;
    if (!isGraded) return;

    const data = conditionValues?.data ?? {};
    const company = String(data?.grading_company || "").toUpperCase();
    const black = !!data?.is_black_label;

    const score100 = gradeToScore100(company, data?.grade_value, black);

    const nextJson = {
      v: 1,
      item_type: "card",
      mode: "graded",
      data: {
        ...data,
        grade_label: deriveGradeLabel(String(data?.grading_company || ""), data?.grade_value, black),
      },
    };

    onChange(nextJson, score100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGradableCategory, isGraded, conditionValues?.data?.grade_value, conditionValues?.data?.grading_company, conditionValues?.data?.is_black_label]);

  return (
    <SectionCard
      title="Condition"
      right={
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-[#0F172A]">{summaryRight.scoreText}</span>
          <span className="text-base font-bold text-[#0F172A]">{summaryRight.labelText ? `— ${summaryRight.labelText}` : ""}</span>
          {isGradableCategory && isGraded && conditionValues?.data?.grade_label ? (
            <span className="text-sm font-semibold text-[#64748B]">• {String(conditionValues.data.grade_label)}</span>
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
            const score100 = tierToScore100(t);

            const nextJson = {
              v: 1,
              item_type: "generic",
              mode: "tier10",
              data: {
                ...(conditionValues?.data ?? {}),
                tier10: t,
                for_parts: !!(conditionValues?.data ?? {})?.for_parts,
              },
            };

            onChange(nextJson, score100);
          }}
        />

        <CheckboxRow
          label="Broken / For Parts"
          checked={!!conditionValues?.data?.for_parts}
          onChange={(v) => {
            const currData = conditionValues?.data ?? {};
            const nextJson = {
              v: 1,
              item_type: conditionValues?.item_type ?? "generic",
              mode: conditionValues?.mode ?? "tier10",
              data: {
                ...currData,
                for_parts: v,
              },
            };

            // If for parts: hard score = 20 (tier shows 2/10)
            if (v) {
              onChange(nextJson, 20);
              return;
            }

            // Otherwise keep current tier score
            const t = clampTier10(currData?.tier10 ?? tier10, 8);
            onChange(nextJson, tierToScore100(t));
          }}
          emphasize
          subtext={<span className="text-[#B45309]">Use this if it’s damaged, incomplete, or only good for parts.</span>}
        />

        {isGradableCategory ? (
          <CheckboxRow
            label="Is graded?"
            checked={!!conditionValues?.data?.is_graded}
            onChange={(v) => {
              const currData = conditionValues?.data ?? {};

              if (!v) {
                const nextJson = {
                  v: 1,
                  item_type: "card",
                  mode: "raw",
                  data: {
                    is_graded: false,
                    tier10: clampTier10(currData?.tier10 ?? tier10, 8),
                    for_parts: !!currData?.for_parts,
                  },
                };
                onChange(nextJson, tierToScore100(nextJson.data.tier10));
                return;
              }

              const nextData: any = {
                ...currData,
                is_graded: true,
                grading_company: currData?.grading_company || "PSA",
                grade_value: currData?.grade_value ?? 8,
                is_black_label: !!currData?.is_black_label,
                certification_number: String(currData?.certification_number ?? ""),
              };

              const nextJson = {
                v: 1,
                item_type: "card",
                mode: "graded",
                data: {
                  ...nextData,
                  grade_label: deriveGradeLabel(String(nextData.grading_company || ""), nextData.grade_value, !!nextData.is_black_label),
                },
              };

              const score100 = gradeToScore100(String(nextData.grading_company || ""), nextData.grade_value, !!nextData.is_black_label);
              onChange(nextJson, score100);
            }}
            subtext={<span className="text-[#64748B]">Enable only if it has a professional grade.</span>}
          />
        ) : null}

        {isGradableCategory && isGraded ? (
          <div className="space-y-2">
            <SelectRow
              label="Grading Company"
              value={typeof conditionValues?.data?.grading_company === "string" ? conditionValues.data.grading_company : ""}
              options={["PSA", "BGS", "CGC", "SGC", "CBCS", "PGX", "Other"]}
              onChange={(v) => {
                const currData = conditionValues?.data ?? {};
                const isBgs = String(v || "").toUpperCase() === "BGS";
                const nextData: any = { ...currData, grading_company: v };
                if (!isBgs) nextData.is_black_label = false;

                // If BGS black label => force 10
                if (isBgs && !!nextData.is_black_label) nextData.grade_value = 10;

                const nextJson = {
                  v: 1,
                  item_type: "card",
                  mode: "graded",
                  data: {
                    ...nextData,
                    grade_label: deriveGradeLabel(String(v || ""), nextData.grade_value, !!nextData.is_black_label),
                  },
                };

                const score100 = gradeToScore100(String(nextData.grading_company || ""), nextData.grade_value, !!nextData.is_black_label);
                onChange(nextJson, score100);
              }}
            />

            <NumberRow
              label="Grade Value"
              value={
                String(conditionValues?.data?.grading_company || "").toUpperCase() === "BGS" && !!conditionValues?.data?.is_black_label
                  ? "10"
                  : conditionValues?.data?.grade_value === null || conditionValues?.data?.grade_value === undefined
                    ? ""
                    : String(conditionValues.data.grade_value)
              }
              min={0}
              max={10}
              step={0.5}
              disabled={String(conditionValues?.data?.grading_company || "").toUpperCase() === "BGS" && !!conditionValues?.data?.is_black_label}
              onChange={(v) => {
                const currData = conditionValues?.data ?? {};
                const company = String(currData?.grading_company || "").toUpperCase();
                const black = !!currData?.is_black_label;

                if (company === "BGS" && black) {
                  const nextJson = {
                    v: 1,
                    item_type: "card",
                    mode: "graded",
                    data: {
                      ...currData,
                      grade_value: 10,
                      grade_label: deriveGradeLabel(String(currData?.grading_company || ""), 10, true),
                    },
                  };
                  onChange(nextJson, 100);
                  return;
                }

                const gv = v === "" ? null : Number(v);
                const nextData: any = { ...currData, grade_value: gv };
                const nextJson = {
                  v: 1,
                  item_type: "card",
                  mode: "graded",
                  data: {
                    ...nextData,
                    grade_label: deriveGradeLabel(String(nextData?.grading_company || ""), gv, !!nextData?.is_black_label),
                  },
                };

                const score100 = gradeToScore100(String(nextData.grading_company || ""), gv, !!nextData.is_black_label);
                onChange(nextJson, score100);
              }}
            />

            {String(conditionValues?.data?.grading_company || "").toUpperCase() === "BGS" ? (
              <CheckboxRow
                label="Black Label"
                checked={!!conditionValues?.data?.is_black_label}
                onChange={(v) => {
                  const currData = conditionValues?.data ?? {};
                  const company = String(currData?.grading_company || "").toUpperCase();

                  if (company === "BGS" && v) {
                    const nextJson = {
                      v: 1,
                      item_type: "card",
                      mode: "graded",
                      data: {
                        ...currData,
                        is_black_label: true,
                        grade_value: 10,
                        grade_label: deriveGradeLabel(String(currData?.grading_company || ""), 10, true),
                      },
                    };
                    onChange(nextJson, 100);
                    return;
                  }

                  const nextData: any = { ...currData, is_black_label: v };
                  const nextJson = {
                    v: 1,
                    item_type: "card",
                    mode: "graded",
                    data: {
                      ...nextData,
                      grade_label: deriveGradeLabel(String(nextData?.grading_company || ""), nextData?.grade_value, !!v),
                    },
                  };

                  const score100 = gradeToScore100(String(nextData.grading_company || ""), nextData.grade_value, !!nextData.is_black_label);
                  onChange(nextJson, score100);
                }}
                subtext={<span className="text-[#64748B]">If checked, grade is locked to 10.</span>}
              />
            ) : null}

            <TextRow
              label="Certification Number"
              value={typeof conditionValues?.data?.certification_number === "string" ? conditionValues.data.certification_number : ""}
              placeholder="e.g. PSA 12345678"
              onChange={(v) => {
                const currData = conditionValues?.data ?? {};
                const nextJson = {
                  v: 1,
                  item_type: "card",
                  mode: "graded",
                  data: {
                    ...currData,
                    certification_number: normalizeCert(v),
                  },
                };

                // score unchanged
                onChange(nextJson, conditionScore);
              }}
              help={<span>Optional, but recommended for graded items.</span>}
            />

            <div className="rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]">
              Derived condition:{" "}
              <span className="font-semibold">{`${score100ToTier10(conditionScore)}/10`}</span> • {getConditionLabel(score100ToTier10(conditionScore))}
              {conditionValues?.data?.grade_label ? <span className="text-[#64748B]"> • {String(conditionValues.data.grade_label)}</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
