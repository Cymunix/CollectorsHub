// lib/pricingEngine.ts

export type DealBadge = {
  label: "Low" | "Average" | "High";
  color: "green" | "blue" | "red";
  ratio: number;
};

// Same curve as before, but now we derive tier10 from score100
const CONDITION_MULTIPLIERS: Record<number, number> = {
  10: 1.2,
  9: 1.1,
  8: 1.0,
  7: 0.9,
  6: 0.8,
  5: 0.7,
  4: 0.55,
  3: 0.4,
  2: 0.25,
  1: 0.15,
};

function clampTier10(tier: any): number {
  const n = Number(tier);
  if (!Number.isFinite(n)) return 8;
  return Math.max(1, Math.min(10, n));
}

function clampScore100(score100: any): number {
  const n = Number(score100);
  if (!Number.isFinite(n)) return 80;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function score100ToTier10(score100: any): number {
  const s = clampScore100(score100);
  return clampTier10(Math.round(s / 10));
}

function norm(s: any): string {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeCategory(category: any): string {
  const c = norm(category);

  if (c.includes("sports") && c.includes("card")) return "Sports Cards";
  if (c.includes("trading") && c.includes("card")) return "Trading Cards";
  if (c.includes("comic")) return "Comics";
  if (c.includes("toy")) return "Toys";

  return "Other";
}

function normalizeGradingCompany(gradingCompany: any, gradeLabel: any): string {
  const gc = norm(gradingCompany);
  const gl = norm(gradeLabel);

  if (gc.includes("black") || gl.includes("black")) return "BGS Black Label";

  if (gc.includes("psa")) return "PSA";
  if (gc.includes("bgs") || gc.includes("beckett")) return "BGS";
  if (gc.includes("sgc")) return "SGC";
  if (gc.includes("cgc")) return "CGC";
  if (gc.includes("cbcs")) return "CBCS";
  if (gc.includes("pgx")) return "PGX";
  if (gc.includes("afa")) return "AFA";
  if (gc.includes("cas")) return "CAS";

  return "";
}

/**
 * ✅ Labels are now based on tier10 (1–10), derived from score100.
 * We keep the names you already use.
 */
export function getConditionLabel(tierOrScore: any): string {
  // Accept either tier10 or score100
  const n = Number(tierOrScore);
  const tier10 = n > 10 ? score100ToTier10(n) : clampTier10(n);

  if (tier10 >= 10) return "Near Mint";
  if (tier10 === 9) return "Excellent";
  if (tier10 === 8) return "Very Good";
  if (tier10 === 7) return "Good";
  if (tier10 === 6) return "Fair";
  if (tier10 === 5) return "Poor";
  if (tier10 === 4) return "Very Poor";
  if (tier10 === 3) return "Damaged";
  if (tier10 === 2) return "For Parts";
  return "For Parts";
}

/**
 * ✅ Multiplier takes score100 now (0–100).
 */
export function getConditionMultiplier(score100: any): number {
  const tier10 = score100ToTier10(score100);

  const lo = Math.floor(tier10);
  const hi = Math.ceil(tier10);

  const loM = CONDITION_MULTIPLIERS[lo] ?? 1.0;
  const hiM = CONDITION_MULTIPLIERS[hi] ?? 1.0;

  if (lo === hi) return loM;

  const t = (tier10 - lo) / (hi - lo);
  return loM + (hiM - loM) * t;
}

/**
 * ✅ Reads grading info from BOTH new schema (cj.data.*) and legacy keys.
 */
function extractGradingFromConditionJson(conditionJson: any): {
  gradingCompany: string | null;
  gradeLabel: string | null;
} {
  const cj = conditionJson ?? {};
  const data = cj?.data ?? cj;

  const gradingCompany =
    typeof data?.grading_company === "string"
      ? data.grading_company
      : typeof data?.gradingCompany === "string"
        ? data.gradingCompany
        : null;

  const gradeLabel =
    typeof data?.grade_label === "string"
      ? data.grade_label
      : typeof data?.gradeLabel === "string"
        ? data.gradeLabel
        : null;

  return { gradingCompany, gradeLabel };
}

export function getGradingPremium({
  category,
  gradingCompany,
  gradeValue, // kept for signature
  gradeLabel,
}: {
  category: string;
  gradingCompany?: string | null;
  gradeValue?: number | string | null;
  gradeLabel?: string | null;
}): number {
  const cat = normalizeCategory(category);
  const company = normalizeGradingCompany(gradingCompany, gradeLabel);

  if (!company) return 1.0;

  if (cat === "Sports Cards") {
    const table: Record<string, number> = {
      PSA: 1.0,
      BGS: 0.95,
      "BGS Black Label": 1.3,
      SGC: 0.9,
      CGC: 0.85,
    };
    return table[company] ?? 1.0;
  }

  if (cat === "Trading Cards") {
    const table: Record<string, number> = {
      PSA: 1.0,
      BGS: 0.98,
      "BGS Black Label": 1.35,
      CGC: 0.95,
    };
    return table[company] ?? 1.0;
  }

  if (cat === "Comics") {
    const table: Record<string, number> = {
      CGC: 1.0,
      CBCS: 0.9,
      PGX: 0.7,
    };
    return table[company] ?? 1.0;
  }

  if (cat === "Toys") {
    const table: Record<string, number> = {
      AFA: 1.0,
      CAS: 0.9,
    };
    return table[company] ?? 1.0;
  }

  return 1.0;
}

/**
 * ✅ conditionScore is NOW 0–100
 */
export function getFairValue({
  baseMarketPrice,
  category,
  conditionScore,
  gradingCompany,
  gradeValue,
  gradeLabel,
}: {
  baseMarketPrice: number;
  category: string;
  conditionScore: number; // 0–100
  gradingCompany?: string | null;
  gradeValue?: number | string | null;
  gradeLabel?: string | null;
}): number {
  const base = Number(baseMarketPrice);
  if (!Number.isFinite(base) || base <= 0) return 0;

  const cond = getConditionMultiplier(conditionScore);
  const prem = getGradingPremium({ category, gradingCompany, gradeValue, gradeLabel });

  const v = base * cond * prem;
  return Number.isFinite(v) ? v : 0;
}

export function getDealBadge({
  listingPrice,
  fairValue,
}: {
  listingPrice: number;
  fairValue: number;
}): DealBadge {
  const lp = Number(listingPrice);
  const fv = Number(fairValue);

  const safeLp = Number.isFinite(lp) ? lp : 0;
  const safeFv = Number.isFinite(fv) ? fv : 0;

  const ratio =
    safeLp > 0 ? safeFv / safeLp : safeFv > 0 ? Number.POSITIVE_INFINITY : 0;

  if (ratio > 1.5) return { label: "High", color: "green", ratio };
  if (ratio >= 0.75 && ratio <= 1.5) return { label: "Average", color: "blue", ratio };
  return { label: "Low", color: "red", ratio };
}
