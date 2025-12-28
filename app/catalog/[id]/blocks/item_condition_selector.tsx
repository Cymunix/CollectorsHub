"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getConditionLabel } from "@/lib/pricingEngine";

type Minifig = { id: string; minifig_number: string; name: string | null; image_url: string | null };

type ConditionField =
  | { key: string; label: string; type: "checkbox" }
  | { key: string; label: string; type: "select"; options: string[] }
  | { key: string; label: string; type: "number"; min?: number; max?: number; step?: number };

type ConditionSection = { title: string; fields: ConditionField[] };

function clampScore(n: any, fallback = 8) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(10, x));
}

function gradeToConditionScore(gradeValue: any, fallback = 8) {
  const g = Number(gradeValue);
  if (!Number.isFinite(g)) return fallback;
  return Math.max(1, Math.min(10, g));
}

function deriveGradeLabel(gradingCompany: string, gradeValue: any, isBlackLabel: boolean) {
  const gv = Number(gradeValue);
  const gvText = Number.isFinite(gv) ? String(gv) : "—";
  if ((gradingCompany || "").toUpperCase() === "BGS" && isBlackLabel) return "BGS Black Label";
  if (gradingCompany) return `${gradingCompany} ${gvText}`;
  return `Graded ${gvText}`;
}

function normalizeCert(input: any): string {
  // Keep it simple: trim + collapse spaces + limit length.
  // (No hard validation because cert formats vary by company.)
  const s = String(input ?? "").trim().replace(/\s+/g, " ");
  return s.slice(0, 64);
}

function getConditionSections(categoryName: string | null): ConditionSection[] {
  const c = (categoryName ?? "").toLowerCase();

  if (c.includes("building") || c.includes("block") || c.includes("lego")) {
    return [
      {
        title: "What's Included",
        fields: [
          { key: "for_parts", label: "Broken / For Parts", type: "checkbox" },
          { key: "sealed", label: "Sealed (New in Box)", type: "checkbox" },
          { key: "box", label: "Original Box", type: "checkbox" },
          { key: "manual", label: "Instructions / Manual", type: "checkbox" },
          { key: "complete", label: "All Pieces Complete", type: "checkbox" },
          { key: "minifigs_included", label: "All included minifigs are present", type: "checkbox" },
        ],
      },
      {
        title: "Optional Details",
        fields: [
          { key: "stickers_applied", label: "Stickers Applied", type: "checkbox" },
          { key: "smoke_free", label: "Smoke-Free Home", type: "checkbox" },
          { key: "sun_fade", label: "Sunlight Discoloration / Yellowing", type: "checkbox" },
        ],
      },
    ];
  }

  return [
    {
      title: "Condition",
      fields: [
        { key: "for_parts", label: "Broken / For Parts", type: "checkbox" },
        { key: "like_new", label: "Like New", type: "checkbox" },
        { key: "good", label: "Good", type: "checkbox" },
        { key: "fair", label: "Fair", type: "checkbox" },
      ],
    },
  ];
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
        <input type="checkbox" className="h-4 w-4 rounded border-[#CBD5E1]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="text-sm text-[#0F172A]">{label}</span>
      </label>
      {subtext ? <div className="mt-2 text-xs text-[#64748B]">{subtext}</div> : null}
    </div>
  );
}

function SelectRow({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
      <div className="text-sm text-[#0F172A] font-medium">{label}</div>
      <select className="mt-2 w-full rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
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

/** Big, intentional 1–10 buttons (non-LEGO only) */
function ScorePills({
  value,
  disabled,
  onPick,
}: {
  value: number;
  disabled?: boolean;
  onPick: (next: number) => void;
}) {
  const v = clampScore(value, 8);

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
  conditionValues: Record<string, any>;
  conditionScore: number;
  onChange: (nextValues: Record<string, any>, nextScore: number) => void;
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

  const sections = useMemo(() => getConditionSections(categoryName), [categoryName]);

  const isGraded = !!conditionValues?.isGraded;

  // keep derived grade->score in sync
  useEffect(() => {
    if (!isGradableCategory) return;
    if (!isGraded) return;

    const company = String(conditionValues?.gradingCompany || "").toUpperCase();
    const black = !!conditionValues?.isBlackLabel;

    if (company === "BGS" && black) {
      const nextValues = {
        ...conditionValues,
        gradeValue: 10,
        conditionScore: 10,
        gradeLabel: deriveGradeLabel(String(conditionValues?.gradingCompany || ""), 10, true),
      };
      onChange(nextValues, 10);
      return;
    }

    const nextScore = gradeToConditionScore(conditionValues?.gradeValue, conditionScore);
    const nextValues = {
      ...conditionValues,
      conditionScore: nextScore,
      gradeLabel: deriveGradeLabel(String(conditionValues?.gradingCompany || ""), conditionValues?.gradeValue, !!conditionValues?.isBlackLabel),
    };
    onChange(nextValues, nextScore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGradableCategory, isGraded, conditionValues?.gradeValue, conditionValues?.gradingCompany, conditionValues?.isBlackLabel]);

  /**
   * Compact right-side summary:
   * - Shows only once (no duplication)
   * - Bigger + bolder like you asked
   */
  const summaryRight = useMemo(() => {
    if (!!conditionValues["for_parts"]) return { scoreText: "For Parts", labelText: "" };

    if (!isBuildingBlocks) {
      const s = clampScore(conditionScore, 8);
      return { scoreText: String(s), labelText: getConditionLabel(s) };
    }

    // For LEGO we keep it minimal (checkbox-based)
    const all = sections.flatMap((s) => s.fields);
    const checked = all.filter((f) => f.type === "checkbox" && !!conditionValues[f.key]).length;
    if (checked === 0) return { scoreText: "", labelText: "Select what's included" };
    return { scoreText: "", labelText: `${checked} selected` };
  }, [conditionValues, isBuildingBlocks, conditionScore, sections]);

  return (
    <SectionCard
      title="Condition"
      right={
        !isBuildingBlocks ? (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#0F172A]">{summaryRight.scoreText}</span>
            <span className="text-base font-bold text-[#0F172A]">
              {summaryRight.labelText ? `— ${summaryRight.labelText}` : ""}
            </span>
            {isGradableCategory && isGraded && conditionValues?.gradeLabel ? (
              <span className="text-sm font-semibold text-[#64748B]">• {String(conditionValues.gradeLabel)}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-[11px] text-[#64748B]">{summaryRight.labelText}</span>
        )
      }
    >
      {/* NON-LEGO: Big 1–10 selector (grading still supported) */}
      {!isBuildingBlocks ? (
        <div className="space-y-3">
          <ScorePills
            value={conditionScore}
            disabled={isGradableCategory && isGraded}
            onPick={(next) => {
              const nextScore = clampScore(next, 8);
              const nextValues = { ...conditionValues, conditionScore: nextScore };
              onChange(nextValues, nextScore);
            }}
          />

          {isGradableCategory ? (
            <CheckboxRow
              label="Is graded?"
              checked={!!conditionValues?.isGraded}
              onChange={(v) => {
                const next: any = { ...conditionValues, isGraded: v };

                if (!v) {
                  next.gradingCompany = null;
                  next.gradeValue = null;
                  next.gradeLabel = null;
                  next.isBlackLabel = null;
                  next.certificationNumber = null; // ✅ clear cert when switching back to raw
                  onChange(next, clampScore(conditionScore, 8));
                  return;
                }

                if (!next.gradingCompany) next.gradingCompany = "PSA";
                if (next.gradeValue === null || next.gradeValue === undefined || next.gradeValue === "") next.gradeValue = 8;
                if (next.certificationNumber === undefined) next.certificationNumber = ""; // ✅ default

                const derived = gradeToConditionScore(next.gradeValue, 8);
                next.conditionScore = derived;
                next.gradeLabel = deriveGradeLabel(String(next.gradingCompany || ""), next.gradeValue, !!next.isBlackLabel);

                onChange(next, derived);
              }}
              subtext={<span className="text-[#64748B]">Enable only if it has a professional grade.</span>}
            />
          ) : null}

          {isGradableCategory && isGraded ? (
            <div className="space-y-2">
              <SelectRow
                label="Grading Company"
                value={typeof conditionValues?.gradingCompany === "string" ? conditionValues.gradingCompany : ""}
                options={["PSA", "BGS", "CGC", "SGC", "CBCS", "PGX", "Other"]}
                onChange={(v) => {
                  const next: any = { ...conditionValues, gradingCompany: v };
                  const isBgs = String(v || "").toUpperCase() === "BGS";
                  if (!isBgs) next.isBlackLabel = false;

                  if (isBgs && !!next.isBlackLabel) {
                    next.gradeValue = 10;
                    next.conditionScore = 10;
                  }

                  next.gradeLabel = deriveGradeLabel(String(v || ""), next.gradeValue, !!next.isBlackLabel);
                  onChange(next, clampScore(next.conditionScore ?? conditionScore, 8));
                }}
              />

              <NumberRow
                label="Grade Value"
                value={
                  String(conditionValues?.gradingCompany || "").toUpperCase() === "BGS" && !!conditionValues?.isBlackLabel
                    ? "10"
                    : conditionValues?.gradeValue === null || conditionValues?.gradeValue === undefined
                    ? ""
                    : String(conditionValues.gradeValue)
                }
                min={0}
                max={10}
                step={0.5}
                disabled={String(conditionValues?.gradingCompany || "").toUpperCase() === "BGS" && !!conditionValues?.isBlackLabel}
                onChange={(v) => {
                  const company = String(conditionValues?.gradingCompany || "").toUpperCase();
                  const black = !!conditionValues?.isBlackLabel;

                  if (company === "BGS" && black) {
                    const next = {
                      ...conditionValues,
                      gradeValue: 10,
                      conditionScore: 10,
                      gradeLabel: deriveGradeLabel(String(conditionValues?.gradingCompany || ""), 10, true),
                    };
                    onChange(next, 10);
                    return;
                  }

                  const next: any = { ...conditionValues, gradeValue: v === "" ? null : Number(v) };
                  const derived = gradeToConditionScore(next.gradeValue, 8);
                  next.conditionScore = derived;
                  next.gradeLabel = deriveGradeLabel(String(next.gradingCompany || ""), next.gradeValue, !!next.isBlackLabel);
                  onChange(next, derived);
                }}
              />

              {String(conditionValues?.gradingCompany || "").toUpperCase() === "BGS" ? (
                <CheckboxRow
                  label="Black Label"
                  checked={!!conditionValues?.isBlackLabel}
                  onChange={(v) => {
                    const company = String(conditionValues?.gradingCompany || "").toUpperCase();
                    if (company === "BGS" && v) {
                      const next = {
                        ...conditionValues,
                        isBlackLabel: true,
                        gradeValue: 10,
                        conditionScore: 10,
                        gradeLabel: deriveGradeLabel(String(conditionValues?.gradingCompany || ""), 10, true),
                      };
                      onChange(next, 10);
                      return;
                    }

                    const next = {
                      ...conditionValues,
                      isBlackLabel: v,
                      gradeLabel: deriveGradeLabel(String(conditionValues?.gradingCompany || ""), conditionValues?.gradeValue, !!v),
                    };
                    onChange(next, clampScore(next.conditionScore ?? conditionScore, 8));
                  }}
                  subtext={<span className="text-[#64748B]">If checked, grade is locked to 10.</span>}
                />
              ) : null}

              {/* ✅ NEW: Certification Number */}
              <TextRow
                label="Certification Number"
                value={typeof conditionValues?.certificationNumber === "string" ? conditionValues.certificationNumber : ""}
                placeholder="e.g. PSA 12345678 (exactly as shown on the slab)"
                onChange={(v) => {
                  const next = { ...conditionValues, certificationNumber: normalizeCert(v) };
                  onChange(next, clampScore(next.conditionScore ?? conditionScore, 8));
                }}
                help={<span>Optional, but recommended for graded items (use the slab’s cert/serial).</span>}
              />

              <div className="rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]">
                Derived condition: <span className="font-semibold">{`${clampScore(conditionScore, 8)}/10`}</span> •{" "}
                {getConditionLabel(clampScore(conditionScore, 8))}
                {conditionValues?.gradeLabel ? <span className="text-[#64748B]"> • {String(conditionValues.gradeLabel)}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        // LEGO / Building Blocks: keep your original checkbox-based system
        <div className="space-y-4">
          {sections.map((sec) => (
            <div key={sec.title}>
              <div className="text-xs font-semibold text-[#0F172A] mb-2">{sec.title}</div>
              <div className="space-y-2">
                {sec.fields.map((f) => {
                  const val = conditionValues[f.key];
                  const isForParts = f.key === "for_parts";

                  if (f.type === "checkbox" && f.key === "minifigs_included") {
                    if (!linkedMinifigs.length) return null;

                    return (
                      <CheckboxRow
                        key={f.key}
                        label={`${f.label} (${linkedMinifigs.length})`}
                        checked={!!val}
                        onChange={(v) => onChange({ ...conditionValues, [f.key]: v }, conditionScore)}
                        subtext={
                          <div className="space-y-1">
                            <div>Includes:</div>
                            <ul className="list-disc pl-5">
                              {linkedMinifigs.map((m) => (
                                <li key={m.id}>
                                  <span className="font-semibold">{m.minifig_number}</span>
                                  {m.name ? ` — ${m.name}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        }
                      />
                    );
                  }

                  if (f.type === "checkbox") {
                    return (
                      <CheckboxRow
                        key={f.key}
                        label={f.label}
                        checked={!!val}
                        onChange={(v) => onChange({ ...conditionValues, [f.key]: v }, conditionScore)}
                        emphasize={isForParts}
                        subtext={
                          isForParts ? <span className="text-[#B45309]">Mark this if the item is damaged, incomplete, or only good for spare parts.</span> : undefined
                        }
                      />
                    );
                  }

                  if (f.type === "select") {
                    return (
                      <SelectRow
                        key={f.key}
                        label={f.label}
                        value={typeof val === "string" ? val : ""}
                        options={f.options}
                        onChange={(v) => onChange({ ...conditionValues, [f.key]: v }, conditionScore)}
                      />
                    );
                  }

                  return (
                    <NumberRow
                      key={f.key}
                      label={f.label}
                      value={val === null || val === undefined ? "" : String(val)}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      onChange={(v) => onChange({ ...conditionValues, [f.key]: v }, conditionScore)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
