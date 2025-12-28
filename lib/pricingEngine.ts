// lib/pricingEngine.ts

export type DealBadge = {
  label: "Low" | "Average" | "High";
  color: "green" | "blue" | "red";
  ratio: number;
};

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

function clampScore(score: any): number {
  const n = Number(score);
  if (!Number.isFinite(n)) return 8;
  return Math.max(1, Math.min(10, n));
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

  // Default bucket (LEGO/Mega Bloks/Movies/Music/Video Games/etc.)
  return "Other";
}

function normalizeGradingCompany(gradingCompany: any, gradeLabel: any): string {
  const gc = norm(gradingCompany);
  const gl = norm(gradeLabel);

  // Treat any "black label" as BGS Black Label
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

export function getConditionLabel(score: any): string {
  const s = clampScore(score);

  if (s >= 9.75) return "Gem Mint";
  if (s >= 9.25) return "Mint";
  if (s >= 8.5) return "Near Mint";
  if (s >= 7.5) return "Excellent";
  if (s >= 6.5) return "Very Good";
  if (s >= 5.5) return "Good";
  if (s >= 4.5) return "Fair";
  if (s >= 3.5) return "Poor";
  if (s >= 2.5) return "Very Poor";
  if (s >= 1.5) return "Damaged";
  return "For Parts";
}

export function getConditionMultiplier(score: any): number {
  const s = clampScore(score);

  const lo = Math.floor(s);
  const hi = Math.ceil(s);

  const loM = CONDITION_MULTIPLIERS[lo] ?? 1.0;
  const hiM = CONDITION_MULTIPLIERS[hi] ?? 1.0;

  if (lo === hi) return loM;

  const t = (s - lo) / (hi - lo);
  return loM + (hiM - loM) * t;
}

export function getGradingPremium({
  category,
  gradingCompany,
  gradeValue, // kept for signature; not used in fallback table
  gradeLabel,
}: {
  category: string;
  gradingCompany?: string | null;
  gradeValue?: number | string | null;
  gradeLabel?: string | null;
}): number {
  const cat = normalizeCategory(category);
  const company = normalizeGradingCompany(gradingCompany, gradeLabel);

  // Not graded / unknown grader
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

  // LEGO / Mega Bloks / Movies / Music / Video Games / anything else
  return 1.0;
}

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
  conditionScore: number;
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
