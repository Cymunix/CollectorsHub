// lib/pricingEngine.ts

export type ConditionState = "sealed" | "open_complete" | "open_incomplete" | "loose";
export type ConditionGrade = "mint" | "excellent" | "good" | "fair" | "poor";
export type ConditionMeta = { state: ConditionState; grade: ConditionGrade; flags: string[] };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function uniq(flags: string[]) {
  return Array.from(new Set((flags || []).filter(Boolean)));
}

/** UI label helper for 1–10 (keep your existing labels) */
export function getConditionLabel(tier10: number) {
  const t = clamp(Math.round(Number(tier10) || 0), 1, 10);
  if (t >= 10) return "Gem Mint";
  if (t >= 9) return "Mint";
  if (t >= 8) return "Near Mint";
  if (t >= 7) return "Excellent";
  if (t >= 6) return "Very Good";
  if (t >= 5) return "Good";
  if (t >= 4) return "Fair";
  if (t >= 3) return "Poor";
  return "For Parts";
}

export function gradeToTier10(grade: ConditionGrade) {
  switch (grade) {
    case "mint":
      return 9;
    case "excellent":
      return 8;
    case "good":
      return 6;
    case "fair":
      return 4;
    case "poor":
      return 2;
    default:
      return 8;
  }
}

export function tier10ToGrade(tier10: number): ConditionGrade {
  const t = clamp(Math.round(Number(tier10) || 0), 1, 10);
  if (t >= 9) return "mint";
  if (t >= 8) return "excellent";
  if (t >= 6) return "good";
  if (t >= 4) return "fair";
  return "poor";
}

/** Score → meta (compat layer). */
export function scoreToMeta(score10: number): ConditionMeta {
  const t = clamp(Math.round(Number(score10) || 0), 1, 10);
  if (t <= 2) return { state: "open_incomplete", grade: "poor", flags: ["for_parts"] };
  if (t <= 3) return { state: "open_incomplete", grade: "poor", flags: [] };
  if (t <= 4) return { state: "open_complete", grade: "fair", flags: [] };
  if (t <= 6) return { state: "open_complete", grade: "good", flags: [] };
  if (t <= 8) return { state: "open_complete", grade: "excellent", flags: [] };
  return { state: "open_complete", grade: "mint", flags: [] };
}

/**
 * Back-compat + normalization:
 * - If condition_json.meta exists, use it.
 * - Else infer from known legacy shapes.
 */
export function deriveConditionMeta(conditionJson: any): ConditionMeta {
  const cj = conditionJson ?? {};
  const meta = cj?.meta;

  if (meta && typeof meta === "object") {
    const state = String(meta.state || "").trim() as ConditionState;
    const grade = String(meta.grade || "").trim() as ConditionGrade;
    const flags = uniq(Array.isArray(meta.flags) ? meta.flags : []);
    const okState: ConditionState[] = ["sealed", "open_complete", "open_incomplete", "loose"];
    const okGrade: ConditionGrade[] = ["mint", "excellent", "good", "fair", "poor"];
    return {
      state: (okState.includes(state) ? state : "open_complete") as ConditionState,
      grade: (okGrade.includes(grade) ? grade : "excellent") as ConditionGrade,
      flags,
    };
  }

  const data = cj?.data ?? {};

  if (!!data?.for_parts || !!cj?.for_parts) {
    return { state: "open_incomplete", grade: "poor", flags: ["for_parts"] };
  }

  // LEGO (Building Blocks)
  if (String(cj?.item_type || "").toLowerCase() === "lego") {
    const s = String(data?.state || "").toLowerCase();
    const sealed = !!data?.sealed || s === "sealed";
    const piecesComplete = data?.pieces_complete !== false;

    let state: ConditionState = sealed ? "sealed" : piecesComplete ? "open_complete" : "open_incomplete";

    // crude grade inference
    let tier10 = 8;
    if (sealed) tier10 = 9;
    if (!piecesComplete) tier10 = 6;
    const grade = tier10ToGrade(tier10);

    const flags: string[] = [];
    if (sealed) flags.push("sealed");
    if (!piecesComplete) flags.push("pieces_incomplete");
    if (data?.box?.included === false) flags.push("box_missing");
    if (data?.instructions?.included === false) flags.push("instructions_missing");
    if (!!data?.yellowing) flags.push("yellowing");

    // IMPORTANT: if UI has instruction/box “condition sliders”, treat very low tiers as missing/for-parts
    const instrTier = Number(
      data?.instructions?.condition_tier10 ??
        data?.instructions?.tier10 ??
        data?.instructions?.condition ??
        NaN
    );
    if (Number.isFinite(instrTier) && instrTier <= 2) {
      flags.push("instructions_missing");
      state = state === "sealed" ? "sealed" : "open_incomplete";
    }

    const boxTier = Number(data?.box?.condition_tier10 ?? data?.box?.tier10 ?? data?.box?.condition ?? NaN);
    if (Number.isFinite(boxTier) && boxTier <= 2) {
      flags.push("box_missing");
    }

    return { state, grade, flags: uniq(flags) };
  }

  // Graded cards
  if (!!data?.is_graded || !!cj?.graded) {
    const gv = Number(data?.grade_value ?? cj?.gradeValue);
    let tier10 = 8;
    if (Number.isFinite(gv)) {
      if (gv >= 9.5) tier10 = 10;
      else if (gv >= 9) tier10 = 9;
      else if (gv >= 8) tier10 = 8;
      else if (gv >= 7) tier10 = 7;
      else if (gv >= 6) tier10 = 6;
      else if (gv >= 5) tier10 = 5;
      else if (gv >= 4) tier10 = 4;
      else if (gv >= 3) tier10 = 3;
      else tier10 = 2;
    }
    const grade = tier10ToGrade(tier10);
    const flags = uniq(["graded", String(data?.grading_company || cj?.gradingCompany || "").toUpperCase()].filter(Boolean));
    return { state: "open_complete", grade, flags };
  }

  // Generic tier10 / conditionScore
  const t = Number(data?.tier10 ?? cj?.tier10 ?? cj?.conditionScore ?? cj?.condition_score);
  if (Number.isFinite(t)) {
    return { state: "open_complete", grade: tier10ToGrade(clamp(t, 1, 10)), flags: [] };
  }

  return { state: "open_complete", grade: "excellent", flags: [] };
}

/**
 * Pricing: multipliers ONLY.
 */
export function getConditionMultiplier(meta: ConditionMeta) {
  const flags = new Set(meta.flags || []);

  if (flags.has("for_parts")) return 0.35;

  let m = 1.0;

  if (meta.state === "sealed") m *= 1.25;
  else if (meta.state === "open_incomplete") m *= 0.75;
  else if (meta.state === "loose") m *= 0.9;

  switch (meta.grade) {
    case "mint":
      m *= 1.15;
      break;
    case "excellent":
      m *= 1.05;
      break;
    case "good":
      m *= 1.0;
      break;
    case "fair":
      m *= 0.85;
      break;
    case "poor":
      m *= 0.7;
      break;
  }

  if (flags.has("yellowing")) m *= 0.9;
  if (flags.has("pieces_incomplete")) m *= 0.9;
  if (flags.has("box_missing")) m *= 0.93;
  if (flags.has("instructions_missing")) m *= 0.96;

  if (flags.has("graded")) m *= 1.05;

  return clamp(m, 0.25, 1.8);
}

/** UI helper (optional): show a tier10 derived from meta */
export function metaToTier10(meta: ConditionMeta) {
  let t = gradeToTier10(meta.grade);
  if (meta.state === "sealed") t = Math.max(t, 9);
  if ((meta.flags || []).includes("for_parts")) t = 2;
  return clamp(t, 1, 10);
}

// -------------------------
// HUMAN DISPLAY CONDITION
// -------------------------

export type DisplayCondition = "Sealed" | "Excellent" | "Good" | "Fair" | "Poor" | "For Parts";

type Cap = "Excellent" | "Good" | "Fair" | "Poor" | "For Parts";
function worse(a: Cap, b: Cap): Cap {
  const order: Cap[] = ["Excellent", "Good", "Fair", "Poor", "For Parts"];
  return order.indexOf(a) > order.indexOf(b) ? a : b;
}
function gradeToCap(g: ConditionGrade): Cap {
  switch (g) {
    case "mint":
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
  }
}

export function deriveDisplayCondition(meta: ConditionMeta): { label: DisplayCondition; reasons: string[] } {
  const flags = new Set(meta.flags || []);
  const reasons: string[] = [];

  if (flags.has("for_parts")) return { label: "For Parts", reasons: ["For parts / broken"] };
  if (meta.state === "sealed") return { label: "Sealed", reasons: [] };

  let cap: Cap = gradeToCap(meta.grade);

  // state caps
  if (meta.state === "open_incomplete") {
    cap = worse(cap, "Fair");
    reasons.push("Incomplete");
  }
  if (meta.state === "loose") {
    cap = worse(cap, "Good");
    reasons.push("Loose / unboxed");
  }

  // flag caps
  if (flags.has("pieces_incomplete")) {
    cap = worse(cap, "Fair");
    reasons.push("Missing pieces");
  }
  if (flags.has("instructions_missing")) {
    cap = worse(cap, "Good");
    reasons.push("Instructions missing");
  }
  if (flags.has("box_missing")) {
    cap = worse(cap, "Good");
    reasons.push("Box missing");
  }
  if (flags.has("yellowing")) {
    cap = worse(cap, "Good");
    reasons.push("Yellowing");
  }

  const label: DisplayCondition =
    cap === "Excellent" ? "Excellent" :
    cap === "Good" ? "Good" :
    cap === "Fair" ? "Fair" :
    cap === "Poor" ? "Poor" :
    "For Parts";

  return { label, reasons: uniq(reasons) };
}

// -------------------------
// FAIR VALUE + DEAL BADGE (UI COMPAT)
// -------------------------

export type DealBadgeKey = "great" | "good" | "fair" | "overpriced" | "unknown";
export type DealBadge = { key: DealBadgeKey; label: string; color: "green" | "blue" | "red" | "gray" };

/**
 * Returns fair value for UI.
 * Accepts multiple shapes, including your current call:
 * getFairValue({ baseMarketPrice, conditionScore, conditionMeta, meta, ... })
 */
export function getFairValue(input: any): number | null {
  if (!input) return null;

  // support different base field names
  const baseCandidates = [
    input.baseMarketPrice,
    input.baseValueCad,
    input.base_value_cad,
    input.baseValue,
    input.base_value,
    input.fairValueCad,
    input.fair_value_cad,
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

  // meta sources (prefer explicit meta; fall back to score; fall back to deriveConditionMeta(condition_json))
  const explicitMeta: ConditionMeta | null =
    (input.conditionMeta as ConditionMeta) ??
    (input.meta as ConditionMeta) ??
    (typeof input.state === "string" && typeof input.grade === "string" ? (input as ConditionMeta) : null);

  const score = input.conditionScore ?? input.condition_score ?? null;
  const scoreMeta = score != null ? scoreToMeta(Number(score)) : null;

  const derivedFromJson =
    input.condition_json ? deriveConditionMeta(input.condition_json) : null;

  const meta = explicitMeta ?? scoreMeta ?? derivedFromJson;

  const m = meta ? getConditionMultiplier(meta) : 1.0;
  const fair = base * m;

  return Number.isFinite(fair) ? Math.max(0, fair) : null;
}

/**
 * Deal badge from price vs fair value.
 * Supports:
 * - getDealBadge(price, fair)
 * - getDealBadge({ listingPrice, fairValue })
 */
export function getDealBadge(
  a: number | null | undefined | { listingPrice?: number | null; fairValue?: number | null },
  b?: number | null | undefined
): DealBadge {
  const listingPrice =
    typeof a === "object" && a
      ? (typeof a.listingPrice === "number" ? a.listingPrice : a.listingPrice == null ? null : Number(a.listingPrice))
      : (typeof a === "number" ? a : a == null ? null : Number(a));

  const fairValue =
    typeof a === "object" && a
      ? (typeof a.fairValue === "number" ? a.fairValue : a.fairValue == null ? null : Number(a.fairValue))
      : (typeof b === "number" ? b : b == null ? null : Number(b));

  const p = typeof listingPrice === "number" && Number.isFinite(listingPrice) ? listingPrice : null;
  const fv = typeof fairValue === "number" && Number.isFinite(fairValue) ? fairValue : null;

  if (!p || !fv || p <= 0 || fv <= 0) return { key: "unknown", label: "Unknown", color: "gray" };

  const r = p / fv;

  if (r <= 0.8) return { key: "great", label: "Great deal", color: "green" };
  if (r <= 0.95) return { key: "good", label: "Good deal", color: "green" };
  if (r <= 1.05) return { key: "fair", label: "Fair", color: "blue" };
  return { key: "overpriced", label: "Overpriced", color: "red" };
}
