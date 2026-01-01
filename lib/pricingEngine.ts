// lib/pricingEngine.ts
// Single source of truth for pricing + condition helpers.
// ✅ New direction: no user-facing numeric score for most items.
// ✅ Keep backwards-compatible exports so the app compiles while you migrate.

export type ConditionStatus = "sealed" | "complete" | "incomplete" | "for_parts" | "graded";

export type ConditionMeta = {
  // ✅ THIS is what you store in DB for filtering/searching/sorting
  status: ConditionStatus;
  flags: string[];
};

/**
 * Back-compat types (older UI used state/grade).
 * Keep them exported so old imports don't explode while we remove usage.
 */
export type ConditionState = "sealed" | "open_complete" | "open_incomplete" | "loose";
export type ConditionGrade = "mint" | "excellent" | "good" | "fair" | "poor";

/**
 * ✅ Back-compat: map a tier10 (1–10) to a label.
 * This should be used ONLY where we still show a label for a numeric scale
 * (primarily cards, and some internal heuristics).
 */
export function getConditionLabel(tier10: number): string {
  const t = clampInt(tier10, 1, 10, 8);
  if (t >= 10) return "Gem Mint";
  if (t >= 9) return "Mint";
  if (t >= 8) return "Excellent";
  if (t >= 6) return "Good";
  if (t >= 4) return "Fair";
  return "Poor";
}

/**
 * ✅ Back-compat: tier10 -> "grade" enum (old system)
 */
export function tier10ToGrade(tier10: number): ConditionGrade {
  const t = clampInt(tier10, 1, 10, 8);
  if (t >= 9) return "mint";
  if (t >= 8) return "excellent";
  if (t >= 6) return "good";
  if (t >= 4) return "fair";
  return "poor";
}

/**
 * ✅ Back-compat: "grade" -> approximate tier10 (old system)
 */
export function metaToTier10(meta: any): number {
  // support both { grade } and { meta: { grade } } shapes
  const grade: any = meta?.grade ?? meta?.meta?.grade ?? null;
  if (grade === "mint") return 9;
  if (grade === "excellent") return 8;
  if (grade === "good") return 6;
  if (grade === "fair") return 4;
  if (grade === "poor") return 2;
  return 8;
}

/* =========================================================
   NEW: derive ConditionMeta from condition_json (v1/v2/v3)
   ========================================================= */

function normalizeCompany(raw: any): string {
  const s = String(raw ?? "").trim().toUpperCase();
  return s;
}

function normalizeLabel(raw: any): string {
  const s = String(raw ?? "").trim().toLowerCase();
  return s;
}

function getSubgrades(data: any): Record<string, number> | null {
  const sg = data?.grading_subgrades;
  if (!sg || typeof sg !== "object") return null;

  const keys = ["centering", "corners", "edges", "surface"] as const;
  const out: any = {};
  let any = false;

  for (const k of keys) {
    const v = sg[k];
    const n = v === null || v === undefined || v === "" ? NaN : Number(v);
    if (Number.isFinite(n)) {
      out[k] = n;
      any = true;
    }
  }

  return any ? (out as Record<string, number>) : null;
}

function isAllBgsSubgradesTen(sub: Record<string, number> | null): boolean {
  if (!sub) return false;
  return (
    Number(sub.centering) === 10 &&
    Number(sub.corners) === 10 &&
    Number(sub.edges) === 10 &&
    Number(sub.surface) === 10
  );
}

/**
 * Derive a clean ConditionMeta from whatever condition_json shape we have.
 * This is the ONLY meta we should store going forward.
 */
export function deriveConditionMeta(conditionJson: any): ConditionMeta {
  const flags: string[] = [];

  const cj = conditionJson ?? {};
  const data = cj?.data ?? {};
  const itemType = String(cj?.item_type ?? data?.item_type ?? "")
    .toLowerCase()
    .trim();
  const mode = String(cj?.mode ?? "").toLowerCase().trim();

  // universal: explicit "for parts" in any legacy blob
  const forParts =
    !!data?.for_parts ||
    !!data?.forParts ||
    !!cj?.for_parts ||
    !!cj?.forParts ||
    (Array.isArray(cj?.meta?.flags) && cj.meta.flags.includes("for_parts"));

  if (forParts) {
    flags.push("for_parts");
    return { status: "for_parts", flags: uniq(flags) };
  }

  // graded (you said "anything can be graded")
  const isGraded =
    !!data?.is_graded ||
    !!data?.graded ||
    mode === "graded" ||
    (Array.isArray(cj?.meta?.flags) && cj.meta.flags.includes("graded"));

  if (isGraded) {
    const company = normalizeCompany(data?.grading_company ?? data?.gradingCompany ?? "");
    const gradeValue = data?.grade_value != null && data?.grade_value !== "" ? Number(data.grade_value) : NaN;
    const label = normalizeLabel(data?.grading_label ?? data?.grade_label ?? "");
    const sub = getSubgrades(data);

    if (company) flags.push(`graded:${company}`);
    if (Number.isFinite(gradeValue)) flags.push(`grade:${gradeValue}`);
    if (label) flags.push(`label:${label}`);

    // Legacy compatibility
    if (!!data?.is_black_label) flags.push("black_label");

    // Strong signal: BGS Black Label (true black label requires 10 subgrades)
    if (company === "BGS" && label === "bgs_black_10") {
      flags.push("bgs:black_label");
      if (isAllBgsSubgradesTen(sub)) flags.push("bgs:black_label_verified");
      else flags.push("bgs:black_label_unverified");
    }

    return { status: "graded", flags: uniq(flags) };
  }

  // LEGO / building blocks context
  if (itemType === "lego" || itemType === "building_blocks") {
    const state =
      String(data?.state ?? "").toLowerCase().trim() ||
      (data?.sealed ? "sealed" : data?.pieces_complete === false ? "open_incomplete" : "open_complete");

    if (state === "sealed") {
      flags.push("sealed");
      if (data?.partial_seal) flags.push("partial_seal");
      // packaging flags
      if (data?.box?.included === false) flags.push("box_missing");
      if (data?.instructions?.included === false) flags.push("instructions_missing");
      return { status: "sealed", flags: uniq(flags) };
    }

    // open items
    const piecesComplete = data?.pieces_complete !== false;
    if (!piecesComplete) flags.push("pieces_incomplete");

    const minifigsRows: any[] = Array.isArray(data?.minifigs) ? data.minifigs : [];
    const anyMissingMinifigs = minifigsRows.some((r) => r && r.included === false);
    if (anyMissingMinifigs) flags.push("minifigs_missing");

    if (data?.box?.included === false) flags.push("box_missing");
    if (data?.instructions?.included === false) flags.push("instructions_missing");
    if (!!data?.stickers?.applied) flags.push("stickers_applied");
    if (!!data?.yellowing) flags.push("yellowing");
    if (typeof data?.discoloration_tier === "number" && data.discoloration_tier <= 5) flags.push("discoloration");

    const status: ConditionStatus = piecesComplete && !anyMissingMinifigs ? "complete" : "incomplete";
    return { status, flags: uniq(flags) };
  }

  // generic: if the selector didn't give us anything meaningful, default to complete
  return { status: "complete", flags: uniq(flags) };
}

/* =========================================================
   Pricing helpers (Fair value + Deal badge)
   ========================================================= */

export type DealBadge = {
  label: string;
  color: "green" | "blue" | "red";
};

export function getDealBadge(args: { listingPrice: number; fairValue: number }): DealBadge {
  const { listingPrice, fairValue } = args;
  if (!Number.isFinite(listingPrice) || !Number.isFinite(fairValue) || fairValue <= 0) {
    return { label: "Unknown", color: "blue" };
  }

  const ratio = listingPrice / fairValue;

  // <= 0.85 = good deal
  if (ratio <= 0.85) return { label: "Great deal", color: "green" };

  // 0.85–1.15 = fair
  if (ratio <= 1.15) return { label: "Fair price", color: "blue" };

  // > 1.15 = overpriced
  return { label: "Overpriced", color: "red" };
}

function gradedMultiplier(args: {
  gradingCompany?: string | null;
  gradeValue?: number | null;
  gradeLabel?: string | null;
  conditionJson?: any;
}): number {
  const company = normalizeCompany(args.gradingCompany ?? args.conditionJson?.data?.grading_company);
  const gv =
    args.gradeValue != null
      ? Number(args.gradeValue)
      : args.conditionJson?.data?.grade_value != null
      ? Number(args.conditionJson.data.grade_value)
      : NaN;

  const label = normalizeLabel(args.gradeLabel ?? args.conditionJson?.data?.grading_label);
  const sub = getSubgrades(args.conditionJson?.data ?? {});

  // baseline premium for "graded"
  let m = 1.25;

  // company-level nudges (tweak later)
  if (company === "PSA") m *= 1.05;
  else if (company === "BGS") m *= 1.08;
  else if (company === "CGC") m *= 1.03;
  else if (company === "SGC") m *= 1.02;

  // grade value nudges
  if (Number.isFinite(gv)) {
    if (gv >= 9.5) m *= 1.15;
    else if (gv >= 9) m *= 1.08;
    else if (gv >= 8) m *= 1.02;
    else if (gv <= 6) m *= 0.9;
  }

  // ✅ Beckett label ladder (this is what you asked for)
  // BGS Black Label 10 should be above BGS 10 and PSA 10.
  if (company === "BGS") {
    if (label === "bgs_black_10") {
      // if verified by subgrades all 10, bigger premium
      m *= isAllBgsSubgradesTen(sub) ? 2.5 : 2.0;
    } else if (label === "bgs_gold_10") {
      m *= 1.6;
    } else if (Number.isFinite(gv) && gv === 10) {
      // plain "BGS 10" without label
      m *= 1.35;
    }
  }

  // PSA 10 slight bump (but still under BGS Black)
  if (company === "PSA" && Number.isFinite(gv) && gv === 10) {
    m *= 1.3;
  }

  return m;
}

/**
 * Fair value: keep it simple and deterministic.
 * - baseMarketPrice is the anchor (sales-derived)
 * - conditionMeta/status can push it around
 * - graded can be handled by a multiplier
 */
export function getFairValue(args: {
  baseMarketPrice: number;
  category: string; // keep for future per-category weighting
  conditionMeta?: ConditionMeta;
  // Back-compat params some callers still send:
  conditionScore?: number;
  gradingCompany?: string | null;
  gradeValue?: number | null;
  gradeLabel?: string | null;
  // Optional: pass condition json if caller has it (v3 has label/subgrades)
  conditionJson?: any;
}): number {
  const base = Number(args.baseMarketPrice);
  if (!Number.isFinite(base) || base <= 0) return base;

  // Prefer new meta
  const meta: ConditionMeta =
    args.conditionMeta && args.conditionMeta.status
      ? {
          status: args.conditionMeta.status,
          flags: Array.isArray(args.conditionMeta.flags) ? args.conditionMeta.flags : [],
        }
      : // fallback: infer "graded" if old callers pass gradingCompany/gradeValue
      args.gradingCompany || args.gradeValue != null
      ? { status: "graded", flags: uniq([`graded:${normalizeCompany(args.gradingCompany)}`]) }
      : { status: "complete", flags: [] };

  let multiplier = 1;

  switch (meta.status) {
    case "sealed":
      multiplier *= 1.15;
      break;
    case "complete":
      multiplier *= 1.0;
      break;
    case "incomplete":
      multiplier *= 0.75;
      break;
    case "for_parts":
      multiplier *= 0.35;
      break;
    case "graded": {
      multiplier *= gradedMultiplier({
        gradingCompany: args.gradingCompany,
        gradeValue: args.gradeValue,
        gradeLabel: args.gradeLabel,
        conditionJson: args.conditionJson,
      });
      break;
    }
  }

  return round2(base * multiplier);
}

/* =========================================================
   Back-compat label helpers (for old UI imports)
   ========================================================= */

export function statusLabel(s: ConditionStatus | null | undefined): string {
  switch (s) {
    case "sealed":
      return "Sealed";
    case "complete":
      return "Complete";
    case "incomplete":
      return "Incomplete";
    case "for_parts":
      return "For parts";
    case "graded":
      return "Graded";
    default:
      return "Unknown";
  }
}

export function flagLabel(flag: string | null | undefined): string {
  const f = String(flag ?? "").trim();
  if (!f) return "";
  return f
    .replace(/^graded:/i, "Graded: ")
    .replace(/^grade:/i, "Grade: ")
    .replace(/^label:/i, "Label: ")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* =========================================================
   Small utilities
   ========================================================= */

function clampInt(n: any, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function uniq(flags: string[]) {
  return Array.from(new Set((flags || []).filter(Boolean)));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
