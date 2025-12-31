"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ConditionMeta, ConditionStatus } from "@/lib/pricingEngine";
import { statusLabel, flagLabel } from "@/lib/pricingEngine";
import ItemConditionBuildingBlocks from "@/components/catalog/ItemConditionBuildingBlocks";

type Minifig = { id: string; minifig_number: string; name: string | null; image_url: string | null };

function normalizeCert(input: any): string {
  const s = String(input ?? "").trim().replace(/\s+/g, " ");
  return s.slice(0, 64);
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
      <div className="text-sm text-[#0F172A] font-medium">{label}</div>
      <select
        className={`mt-2 w-full rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-sm ${disabled ? "opacity-70 cursor-not-allowed" : ""}`}
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
              active ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F8FAFC]"
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
    (typeof data?.status === "string" ? data.status : null) ||
    (!!data?.sealed ? "sealed" : null) ||
    (!!data?.for_parts ? "for_parts" : null) ||
    "complete";

  const flags: string[] = Array.isArray(meta?.flags)
    ? meta.flags
    : Array.isArray(data?.flags)
    ? data.flags
    : [];

  const grade = meta?.grade && typeof meta.grade === "object"
    ? meta.grade
    : (data?.is_graded
        ? {
            is_graded: true,
            company: typeof data?.grading_company === "string" ? data.grading_company : null,
            grade_value: data?.grade_value === "" || data?.grade_value == null ? null : Number(data.grade_value),
          }
        : undefined);

  const notes = typeof meta?.notes === "string" ? meta.notes : (typeof data?.notes === "string" ? data.notes : null);

  // Normalize: if status=for_parts, make sure for_parts flag exists.
  const normalizedFlags = status === "for_parts" ? toggleFlag(flags, "for_parts", true) : toggleFlag(flags, "for_parts", false);

  return {
    status,
    flags: normalizedFlags,
    grade,
    notes,
  };
}

export default function ItemConditionSelector({
  catalogItemId,
  categoryName,
  isBuildingBlocks,
  isGradableCategory, // we keep this prop but we do NOT gate grading anymore (anything can be graded)
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

  // ✅ LEGO path stays delegated (we’ll update that component next)
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

  const isGraded = !!meta.grade?.is_graded;

  const summary = useMemo(() => {
    const chips: string[] = [];

    // Show up to 3 flags
    const important = (meta.flags || []).filter((f) => f !== "for_parts").slice(0, 3);
    for (const f of important) chips.push(flagLabel(f));

    if (meta.grade?.is_graded) {
      const c = meta.grade.company ? String(meta.grade.company).toUpperCase() : "GRADED";
      const gv = meta.grade.grade_value;
      chips.push(gv != null && Number.isFinite(gv) ? `${c} ${gv}` : c);
    }

    return { title: statusLabel(meta.status), chips };
  }, [meta]);

  const emit = (nextMeta: ConditionMeta, nextDataPatch?: Record<string, any>) => {
    // keep your legacy "data" blob alive, but push in the new truth:
    const nextData: Record<string, any> = {
      ...(data ?? {}),
      ...(nextDataPatch ?? {}),
      status: nextMeta.status,
      flags: nextMeta.flags,
      // convenient legacy booleans:
      sealed: nextMeta.status === "sealed",
      for_parts: nextMeta.status === "for_parts",
      is_graded: !!nextMeta.grade?.is_graded,
      grading_company: nextMeta.grade?.company ?? null,
      grade_value: nextMeta.grade?.grade_value ?? null,
      notes: nextMeta.notes ?? null,
    };

    const nextJson = {
      v: 3,
      item_type: conditionValues?.item_type ?? "generic",
      category: categoryName ?? null,
      meta: nextMeta,
      data: nextData,
    };

    onChange(nextJson, nextMeta);
  };

  const setStatus = (s: ConditionStatus) => {
    // If sealed, it’s logically “not missing pieces” — but we won’t be aggressive.
    // We WILL ensure for_parts flag stays consistent.
    const nextMeta: ConditionMeta = {
      ...meta,
      status: s,
      flags: s === "for_parts" ? toggleFlag(meta.flags, "for_parts", true) : toggleFlag(meta.flags, "for_parts", false),
    };

    // If switching away from graded? no — grading is independent of status.
    emit(nextMeta);
  };

  const setFlag = (flag: string, on: boolean) => {
    // For parts is controlled by status, not a random flag checkbox
    if (flag === "for_parts") return;

    // If status is sealed, we still allow flags like yellowing/damaged etc.
    const nextFlags = toggleFlag(meta.flags, flag, on);
    emit({ ...meta, flags: nextFlags });
  };

  const setGraded = (on: boolean) => {
    if (!on) {
      const nextMeta: ConditionMeta = { ...meta, grade: { is_graded: false } as any };
      // store legacy fields
      emit({ ...meta, grade: { is_graded: false } as any }, { is_graded: false, grading_company: null, grade_value: null, certification_number: "" });
      return;
    }

    const company = typeof data?.grading_company === "string" && data.grading_company.trim().length ? data.grading_company : "PSA";
    const gradeValue =
      data?.grade_value === null || data?.grade_value === undefined || data?.grade_value === ""
        ? 9
        : Number(data.grade_value);

    const nextMeta: ConditionMeta = {
      ...meta,
      grade: { is_graded: true, company, grade_value: Number.isFinite(gradeValue) ? gradeValue : null },
    };

    emit(nextMeta, {
      is_graded: true,
      grading_company: company,
      grade_value: Number.isFinite(gradeValue) ? gradeValue : null,
      certification_number: String(data?.certification_number ?? ""),
    });
  };

  const setGradeCompany = (company: string) => {
    const nextMeta: ConditionMeta = {
      ...meta,
      grade: { ...(meta.grade ?? { is_graded: true }), is_graded: true, company },
    };
    emit(nextMeta, { grading_company: company });
  };

  const setGradeValue = (v: string) => {
    const n = v === "" ? null : Number(v);
    const gv = n != null && Number.isFinite(n) ? n : null;

    const nextMeta: ConditionMeta = {
      ...meta,
      grade: { ...(meta.grade ?? { is_graded: true }), is_graded: true, grade_value: gv },
    };
    emit(nextMeta, { grade_value: gv });
  };

  const setCert = (v: string) => {
    emit(meta, { certification_number: normalizeCert(v) });
  };

  // Pick a small, sane default flag set (not exhaustive)
  const flagOptions: { key: string; label: string; sub?: string }[] = [
    { key: "box_missing", label: "Box missing" },
    { key: "instructions_missing", label: "Instructions missing" },
    { key: "pieces_incomplete", label: "Missing pieces / incomplete" },
    { key: "yellowing", label: "Yellowing" },
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
        {/* Status */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-[#0F172A]">Overall status</div>
          <StatusPills value={meta.status} onPick={setStatus} />
          <div className="text-xs text-[#64748B]">
            This is the only “big” condition choice. Everything else is just extra details.
          </div>
        </div>

        {/* Flags */}
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

        {/* For Parts explanation */}
        {meta.status === "for_parts" ? (
          <div className="rounded-xl border border-[#F59E0B] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
            <span className="font-semibold">For Parts</span> means it’s broken / incomplete enough that it should be priced accordingly.
          </div>
        ) : null}

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <SelectRow
                label="Company"
                value={typeof meta.grade?.company === "string" ? meta.grade!.company! : ""}
                options={["PSA", "BGS", "CGC", "SGC", "CBCS", "WATA", "AFA", "UKG", "Other"]}
                onChange={setGradeCompany}
              />
              <NumberRow
                label="Grade value"
                value={
                  meta.grade?.grade_value === null || meta.grade?.grade_value === undefined
                    ? ""
                    : String(meta.grade.grade_value)
                }
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
          ) : null}
        </div>

        {/* Debug (optional) */}
        <div className="rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]">
          Stored meta:{" "}
          <span className="font-mono">
            {meta.status}
          </span>
          {" • flags="}
          <span className="font-mono">
            [{(meta.flags || []).join(", ")}]
          </span>
          {meta.grade?.is_graded ? (
            <span className="font-mono">{` • grade=${String(meta.grade.company ?? "GRADED")} ${meta.grade.grade_value ?? ""}`}</span>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
