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

function resolveMetaFromInputs(
  conditionValues: Record<string, any>,
  conditionMeta?: ConditionMeta
): ConditionMeta {
  const data = conditionValues?.data ?? {};
  const meta = conditionMeta ?? conditionValues?.meta ?? null;

  const status: ConditionStatus =
    (meta?.status as ConditionStatus) ||
    (typeof data?.status === "string" ? (data.status as ConditionStatus) : null) ||
    (!!data?.sealed ? "sealed" : null) ||
    (!!data?.for_parts ? "for_parts" : null) ||
    "complete";

  const flags: string[] = Array.isArray(meta?.flags)
    ? meta.flags
    : Array.isArray(data?.flags)
    ? data.flags
    : [];

  const normalizedFlags =
    status === "for_parts"
      ? toggleFlag(flags, "for_parts", true)
      : toggleFlag(flags, "for_parts", false);

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

      const ids = (linkRes.data ?? [])
        .map((r: any) => r.minifig_id)
        .filter(Boolean);

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
  const meta = useMemo(
    () => resolveMetaFromInputs(conditionValues ?? {}, conditionMeta),
    [conditionValues, conditionMeta]
  );

  const isGraded = !!data?.is_graded;

  const gradeCompany = String(data?.grading_company ?? "").toUpperCase();
  const gradeValueNum = data?.grade_value == null ? null : Number(data.grade_value);
  const isBgs = isGraded && gradeCompany === "BGS";
  const isTen =
    isBgs && gradeValueNum != null && Number.isFinite(gradeValueNum) && gradeValueNum === 10;

  const bgsSub = readBgsSubgrades(data);
  const trackingSubgrades = !!bgsSub;
  const blackMismatch = isBlackLabel10(data) && blackLabelMismatch(bgsSub);

  const summary = useMemo(() => {
    const chips: string[] = [];

    // Show up to 3 flags
    const important = (meta.flags || []).filter((f) => f !== "for_parts").slice(0, 3);
    for (const f of important) chips.push(flagLabel(f));

    if (data?.is_graded) {
      const c = data?.grading_company ? String(data.grading_company).toUpperCase() : "GRADED";
      const gv = data?.grade_value;
      chips.push(gv != null && Number.isFinite(Number(gv)) ? `${c} ${Number(gv)}` : c);

      // If we have a BGS label, show it as a chip too
      if (c === "BGS" && typeof data?.grading_label === "string" && data.grading_label) {
        chips.push(data.grading_label === "bgs_black_10" ? "BLACK LABEL" : "GOLD LABEL");
      }
    }

    return { title: statusLabel(meta.status), chips };
  }, [meta, data]);

  const emit = (nextMeta: ConditionMeta, nextDataPatch?: Record<string, any>) => {
    const nextData: Record<string, any> = {
      ...(data ?? {}),
      ...(nextDataPatch ?? {}),
      status: nextMeta.status,
      flags: nextMeta.flags,
      sealed: nextMeta.status === "sealed",
      for_parts: nextMeta.status === "for_parts",
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
    const nextMeta: ConditionMeta = {
      ...meta,
      status: s,
      flags:
        s === "for_parts"
          ? toggleFlag(meta.flags, "for_parts", true)
          : toggleFlag(meta.flags, "for_parts", false),
    };

    emit(nextMeta);
  };

  const setFlag = (flag: string, on: boolean) => {
    if (flag === "for_parts") return;
    const nextFlags = toggleFlag(meta.flags, flag, on);
    emit({ ...meta, flags: nextFlags });
  };

  const setGraded = (on: boolean) => {
    if (!on) {
      emit(meta, {
        is_graded: false,
        grading_company: null,
        grade_value: null,
        certification_number: "",
        grading_label: null,
        grading_subgrades: null,
      });
      return;
    }

    const company =
      typeof data?.grading_company === "string" && data.grading_company.trim().length
        ? data.grading_company
        : "PSA";

    const gradeValue =
      data?.grade_value === null || data?.grade_value === undefined || data?.grade_value === ""
        ? 9
        : Number(data.grade_value);

    emit(meta, {
      is_graded: true,
      grading_company: company,
      grade_value: Number.isFinite(gradeValue) ? gradeValue : null,
      certification_number: String(data?.certification_number ?? ""),
    });
  };

  const setGradeCompany = (company: string) => {
    // If switching away from BGS, wipe BGS-specific fields to avoid stale data
    const nextCompany = String(company || "").toUpperCase();
    if (nextCompany !== "BGS") {
      emit(meta, { is_graded: true, grading_company: company, grading_label: null, grading_subgrades: null });
      return;
    }
    emit(meta, { is_graded: true, grading_company: company });
  };

  const setGradeValue = (v: string) => {
    const n = v === "" ? null : Number(v);
    const gv = n != null && Number.isFinite(n) ? n : null;

    // If BGS and grade is not 10 anymore, drop the 10-label (black/gold)
    if (String(data?.grading_company ?? "").toUpperCase() === "BGS" && gv !== 10) {
      emit(meta, { is_graded: true, grade_value: gv, grading_label: null });
      return;
    }

    emit(meta, { is_graded: true, grade_value: gv });
  };

  const setCert = (v: string) => {
    emit(meta, { certification_number: normalizeCert(v) });
  };

  const setGradingLabel = (label: string) => {
    emit(meta, { is_graded: true, grading_label: label || null });
  };

  const setTrackSubgrades = (on: boolean) => {
    if (!on) {
      emit(meta, { grading_subgrades: null });
      return;
    }

    const next: BgsSubgrades = isBlackLabel10(data)
      ? { centering: 10, corners: 10, edges: 10, surface: 10 }
      : { centering: null, corners: null, edges: null, surface: null };

    emit(meta, { grading_subgrades: next });
  };

  const setOneSubgrade = (key: keyof BgsSubgrades, v: string) => {
    const n = v === "" ? null : Number(v);
    const val = n != null && Number.isFinite(n) ? n : null;

    const current = readBgsSubgrades(data) ?? {};
    const next = { ...current, [key]: val };
    emit(meta, { grading_subgrades: next });
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
            <span className="font-semibold">For Parts</span> means it’s broken / incomplete enough
            that it should be priced accordingly.
          </div>
        ) : null}

        {/* Grading (anything can be graded) */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-[#0F172A]">Grading</div>

          <CheckboxRow
            label="This item is graded"
            checked={isGraded}
            onChange={setGraded}
            subtext={
              <span className="text-[#64748B]">
                Turn this on only if it has an official grade slab/case.
              </span>
            }
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
                    />
                  ) : null}

                  <CheckboxRow
                    label="Track BGS subgrades (Centering / Corners / Edges / Surface)"
                    checked={trackingSubgrades}
                    onChange={setTrackSubgrades}
                    subtext={
                      <span className="text-[#64748B]">
                        Optional, but adds credibility and enables Black Label verification.
                      </span>
                    }
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
                      <span className="font-semibold">Black Label check:</span> Black Label 10 requires all four
                      subgrades to be 10.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Debug (optional) */}
        <div className="rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]">
          Stored meta: <span className="font-mono">{meta.status}</span>
          {" • flags="}
          <span className="font-mono">[{(meta.flags || []).join(", ")}]</span>
          {data?.is_graded ? (
            <span className="font-mono">{` • grade=${String(data?.grading_company ?? "GRADED")} ${
              data?.grade_value ?? ""
            }`}</span>
          ) : null}
          {data?.grading_label ? <span className="font-mono">{` • label=${String(data.grading_label)}`}</span> : null}
          {data?.grading_subgrades ? <span className="font-mono">{` • subgrades=✓`}</span> : null}
        </div>
      </div>
    </SectionCard>
  );
}
