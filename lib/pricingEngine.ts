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

/**
 * Back-compat + normalization:
 * - If condition_json.meta exists, use it.
 * - Else infer from known legacy shapes:
 *   - lego context: condition_json.item_type === "lego" + data.state or sealed/pieces_complete
 *   - generic tier10: data.tier10
 *   - graded card: data.is_graded + grade_value
 *   - for_parts: data.for_parts
 */
export function deriveConditionMeta(conditionJson: any): ConditionMeta {
  const cj = conditionJson ?? {};
  const meta = cj?.meta;

  if (meta && typeof meta === "object") {
    const state = String(meta.state || "").trim() as ConditionState;
    const grade = String(meta.grade || "").trim() as ConditionGrade;
    const flags = uniq(Array.isArray(meta.flags) ? meta.flags : []);
    // validate state/grade lightly
    const okState: ConditionState[] = ["sealed", "open_complete", "open_incomplete", "loose"];
    const okGrade: ConditionGrade[] = ["mint", "excellent", "good", "fair", "poor"];
    return {
      state: (okState.includes(state) ? state : "open_complete") as ConditionState,
      grade: (okGrade.includes(grade) ? grade : "excellent") as ConditionGrade,
      flags,
    };
  }

  const data = cj?.data ?? {};

  if (!!data?.for_parts) {
    return { state: "open_incomplete", grade: "poor", flags: ["for_parts"] };
  }

  // LEGO
  if (String(cj?.item_type || "").toLowerCase() === "lego") {
    const s = String(data?.state || "").toLowerCase();
    const sealed = !!data?.sealed || s === "sealed";
    const piecesComplete = data?.pieces_complete !== false;

    const state: ConditionState = sealed ? "sealed" : piecesComplete ? "open_complete" : "open_incomplete";

    // crude grade inference if no meta exists (UI-level only)
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

    return { state, grade, flags: uniq(flags) };
  }

  // Graded cards (derive tier10 from grade_value)
  if (!!data?.is_graded) {
    const gv = Number(data?.grade_value);
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
    const flags = uniq(["graded", String(data?.grading_company || "").toUpperCase()].filter(Boolean));
    return { state: "open_complete", grade, flags };
  }

  // Generic tier10
  const t = Number(data?.tier10);
  if (Number.isFinite(t)) {
    return { state: "open_complete", grade: tier10ToGrade(clamp(t, 1, 10)), flags: [] };
  }

  // Default
  return { state: "open_complete", grade: "excellent", flags: [] };
}

/**
 * Pricing: multipliers ONLY. No “entered scores”.
 * You can tune, but this is the hook everything should call.
 */
export function getConditionMultiplier(meta: ConditionMeta) {
  const flags = new Set(meta.flags || []);

  // hard floor
  if (flags.has("for_parts")) return 0.35;

  // base by state
  let m = 1.0;
  if (meta.state === "sealed") m *= 1.25;
  else if (meta.state === "open_incomplete") m *= 0.75;
  else if (meta.state === "loose") m *= 0.90;

  // base by grade
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
      m *= 0.70;
      break;
  }

  // example: small penalties for key flags (real world)
  if (flags.has("yellowing")) m *= 0.90;
  if (flags.has("pieces_incomplete")) m *= 0.90;
  if (flags.has("box_missing")) m *= 0.93;
  if (flags.has("instructions_missing")) m *= 0.96;

  // graded premium isolated (don’t double-count)
  if (flags.has("graded")) m *= 1.05;

  return clamp(m, 0.25, 1.8);
}

/** UI helper (optional): show a tier10 derived from meta */
export function metaToTier10(meta: ConditionMeta) {
  // sealed tends to present as 9/10 in UI, but still depends on grade
  let t = gradeToTier10(meta.grade);
  if (meta.state === "sealed") t = Math.max(t, 9);
  if ((meta.flags || []).includes("for_parts")) t = 2;
  return clamp(t, 1, 10);
}
