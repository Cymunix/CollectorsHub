// lib/pricingEngine.ts

export type ConditionStatus = "sealed" | "complete" | "incomplete" | "for_parts";

export type GradeInfo = {
  is_graded: boolean;
  company?: string | null;
  grade_value?: number | null; // allow 9.8, 9.5, etc.
};

export type ConditionMeta = {
  status: ConditionStatus;
  flags: string[]; // e.g. box_missing, instructions_missing, yellowing, pieces_incomplete, not_working
  grade?: GradeInfo; // optional
  notes?: string | null;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function uniq(flags: string[]) {
  return Array.from(new Set((flags || []).filter(Boolean)));
}

function truthy(v: any) {
  return v === true || v === 1 || v === "1" || v === "true" || v === "yes";
}

export function statusLabel(s: ConditionStatus) {
  switch (s) {
    case "sealed":
      return "New & Sealed";
    case "complete":
      return "Complete";
    case "incomplete":
      return "Incomplete";
    case "for_parts":
      return "For Parts";
  }
}

export function flagLabel(flag: string) {
  const map: Record<string, string> = {
    box_missing: "Box missing",
    instructions_missing: "Instructions missing",
    pieces_incomplete: "Missing pieces",
    yellowing: "Yellowing",
    stickers_applied: "Stickers applied",
    not_working: "Not working",
    untested: "Untested",
    accessories_missing: "Accessories missing",
    damaged: "Damaged",
    scratched: "Scratched",
  };
  return map[flag] ?? flag.replaceAll("_", " ");
}

/**
 * Back-compat: accept old shapes and normalize into:
 * { status, flags, grade }
 *
 * Supported inputs:
 * - condition_json.meta: { status, flags, grade? }
 * - condition_json.data.* legacy lego fields: sealed, pieces_complete, instructions.included, box.included, yellowing
 * - condition_json.for_parts / data.for_parts
 * - old score fields conditionScore / tier10 -> ONLY for fallback mapping (not shown in UI)
 */
export function deriveConditionMeta(conditionJson: any): ConditionMeta {
  const cj = conditionJson ?? {};
  const data = cj?.data ?? {};

  // 1) New meta shape (preferred)
  const meta = cj?.meta;
  if (meta && typeof meta === "object") {
    const rawStatus = String(meta.status || "").trim().toLowerCase();
    const ok: ConditionStatus[] = ["sealed", "complete", "incomplete", "for_parts"];
    const status: ConditionStatus = (ok.includes(rawStatus as any) ? rawStatus : "complete") as ConditionStatus;

    const flags = uniq(Array.isArray(meta.flags) ? meta.flags : []);
    const grade = meta.grade && typeof meta.grade === "object"
      ? {
          is_graded: !!meta.grade.is_graded,
          company: typeof meta.grade.company === "string" ? meta.grade.company : null,
          grade_value:
            meta.grade.grade_value === null || meta.grade.grade_value === undefined
              ? null
              : Number(meta.grade.grade_value),
        }
      : undefined;

    const notes = typeof meta.notes === "string" ? meta.notes : null;

    return { status, flags, grade, notes };
  }

  // 2) Hard for parts flags
  if (truthy(cj?.for_parts) || truthy(data?.for_parts)) {
    return { status: "for_parts", flags: ["for_parts"], notes: null };
  }

  // 3) Graded legacy fields (anything can be graded)
  const isGraded = truthy(data?.is_graded) || truthy(cj?.is_graded) || truthy(cj?.graded);
  const gradeCompany =
    (typeof data?.grading_company === "string" ? data.grading_company : null) ??
    (typeof cj?.gradingCompany === "string" ? cj.gradingCompany : null) ??
    (typeof cj?.grading_company === "string" ? cj.grading_company : null);

  const gradeValueRaw = data?.grade_value ?? cj?.gradeValue ?? cj?.grade_value;
  const gradeValue =
    gradeValueRaw === null || gradeValueRaw === undefined || gradeValueRaw === ""
      ? null
      : Number(gradeValueRaw);

  const grade: GradeInfo | undefined = isGraded
    ? { is_graded: true, company: gradeCompany, grade_value: Number.isFinite(gradeValue as any) ? gradeValue : null }
    : undefined;

  // 4) LEGO-ish inference (but still general)
  const flags: string[] = [];

  // sealed detection
  const sealed =
    truthy(data?.sealed) ||
    String(data?.state || "").toLowerCase() === "sealed" ||
    String(cj?.status || "").toLowerCase() === "sealed";

  // pieces complete
  const piecesComplete = data?.pieces_complete !== false && !truthy(data?.pieces_incomplete);
  if (!piecesComplete) flags.push("pieces_incomplete");

  // instructions/box
  const instructionsIncluded =
    data?.instructions?.included !== false && !truthy(data?.instructions_missing) && !truthy(cj?.instructions_missing);
  if (!instructionsIncluded) flags.push("instructions_missing");

  const boxIncluded = data?.box?.included !== false && !truthy(data?.box_missing) && !truthy(cj?.box_missing);
  if (!boxIncluded) flags.push("box_missing");

  // yellowing
  if (truthy(data?.yellowing) || truthy(cj?.yellowing)) flags.push("yellowing");

  // working/tested (for electronics — optional)
  if (truthy(data?.not_working) || truthy(cj?.not_working)) flags.push("not_working");
  if (truthy(data?.untested) || truthy(cj?.untested)) flags.push("untested");

  // 5) Derive status from best-available facts
  let status: ConditionStatus = "complete";

  if (sealed) status = "sealed";
  else {
    // if any "hard incomplete" flags -> incomplete
    const hardIncomplete = new Set(["pieces_incomplete"]);
    if (flags.some((f) => hardIncomplete.has(f))) status = "incomplete";
    // if it explicitly says incomplete / missing pieces somewhere
    if (truthy(data?.incomplete) || truthy(cj?.incomplete)) status = "incomplete";
  }

  // 6) Explicit status override (if present)
  const explicit = String(cj?.status || data?.status || "").toLowerCase().trim();
  if (explicit === "sealed" || explicit === "complete" || explicit === "incomplete" || explicit === "for_parts") {
    status = explicit as ConditionStatus;
  }

  // 7) Last-resort: old numeric score mapping (NOT SHOWN IN UI)
  const legacyScore = cj?.conditionScore ?? cj?.condition_score ?? data?.tier10 ?? cj?.tier10;
  if ((status === "complete" || status === "incomplete") && legacyScore !== undefined && legacyScore !== null && legacyScore !== "") {
    const t = clamp(Math.round(Number(legacyScore) || 0), 1, 10);
    if (t <= 2) status = "for_parts";
    else if (t <= 5) status = "incomplete";
    else status = "complete";
  }

  return { status, flags: uniq(flags), grade, notes: null };
}

/**
 * Multiplier logic:
 * base * statusMultiplier * flagMultipliers * gradedPremium
 * You DO NOT show this to users; it is only for "fair value" and badges.
 */
export function getConditionMultiplier(meta: ConditionMeta) {
  const flags = new Set(meta.flags || []);
  let m = 1.0;

  // status
  switch (meta.status) {
    case "sealed":
      m *= 1.25;
      break;
    case "complete":
      m *= 1.0;
      break;
    case "incomplete":
      m *= 0.75;
      break;
    case "for_parts":
      m *= 0.35;
      break;
  }

  // flags
  if (flags.has("yellowing")) m *= 0.9;
  if (flags.has("pieces_incomplete")) m *= 0.9;
  if (flags.has("box_missing")) m *= 0.93;
  if (flags.has("instructions_missing")) m *= 0.96;
  if (flags.has("not_working")) m *= 0.6;
  if (flags.has("untested")) m *= 0.92;

  // graded premium (generic; tune later per category)
  if (meta.grade?.is_graded) m *= 1.05;

  return clamp(m, 0.2, 2.0);
}

export function formatCondition(meta: ConditionMeta): { title: string; chips: string[] } {
  const title = statusLabel(meta.status);
  const chips: string[] = [];

  // show important flags (don’t spam)
  const importantOrder = [
    "pieces_incomplete",
    "instructions_missing",
    "box_missing",
    "yellowing",
    "not_working",
    "untested",
  ];

  for (const f of importantOrder) {
    if ((meta.flags || []).includes(f)) chips.push(flagLabel(f));
  }

  // graded chip
  if (meta.grade?.is_graded) {
    const comp = meta.grade.company ? String(meta.grade.company).toUpperCase() : "GRADED";
    const gv = meta.grade.grade_value;
    chips.push(gv != null && Number.isFinite(gv) ? `${comp} ${gv}` : `${comp}`);
  }

  return { title, chips };
}

// -------------------------
// FAIR VALUE + DEAL BADGE (UI COMPAT)
// -------------------------

export type DealBadgeKey = "great" | "good" | "fair" | "overpriced" | "unknown";
export type DealBadge = { key: DealBadgeKey; label: string; color: "green" | "blue" | "red" | "gray" };

export function getFairValue(input: any): number | null {
  if (!input) return null;

  const baseCandidates = [
    input.baseMarketPrice,
    input.baseValueCad,
    input.base_value_cad,
    input.baseValue,
    input.base_value,
  ];

  let base: number | null = null;
  for (const v of baseCandidates) {
    if (typeof v === "number" && Number.isFinite(v)) {
      base = v;
      break;
    }
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) {
        base = n;
        break;
      }
    }
  }
  if (base == null) return null;

  // accept condition_meta directly or derive from condition_json
  const meta: ConditionMeta | null =
    (input.conditionMeta as ConditionMeta) ??
    (input.condition_meta as ConditionMeta) ??
    (input.meta as ConditionMeta) ??
    (input.condition_json ? deriveConditionMeta(input.condition_json) : null);

  const mult = meta ? getConditionMultiplier(meta) : 1.0;
  const fair = base * mult;
  return Number.isFinite(fair) ? Math.max(0, fair) : null;
}

/**
 * Supports:
 * - getDealBadge({ listingPrice, fairValue })
 * - getDealBadge(price, fair)
 */
export function getDealBadge(
  a: number | null | undefined | { listingPrice?: number | null; fairValue?: number | null },
  b?: number | null | undefined
): DealBadge {
  const listingPrice =
    typeof a === "object" && a
      ? a.listingPrice == null
        ? null
        : Number(a.listingPrice)
      : a == null
      ? null
      : Number(a);

  const fairValue =
    typeof a === "object" && a
      ? a.fairValue == null
        ? null
        : Number(a.fairValue)
      : b == null
      ? null
      : Number(b);

  const p = typeof listingPrice === "number" && Number.isFinite(listingPrice) ? listingPrice : null;
  const fv = typeof fairValue === "number" && Number.isFinite(fairValue) ? fairValue : null;

  if (!p || !fv || p <= 0 || fv <= 0) return { key: "unknown", label: "Unknown", color: "gray" };

  const r = p / fv;
  if (r <= 0.8) return { key: "great", label: "Great deal", color: "green" };
  if (r <= 0.95) return { key: "good", label: "Good deal", color: "green" };
  if (r <= 1.05) return { key: "fair", label: "Fair", color: "blue" };
  return { key: "overpriced", label: "Overpriced", color: "red" };
}
