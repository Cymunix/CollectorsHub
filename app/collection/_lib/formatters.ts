// app/collection/_lib/formatters.ts
import type { ConditionInfo } from "./types";
import { getConditionLabel } from "@/lib/pricingEngine";

export function formatConditionForCard(cond: ConditionInfo): string {
  if (cond.mode === "graded") {
    const c = (cond.graded.company || "").trim();
    const g = (cond.graded.grade || "").trim();
    if (!c && !g) return "Graded";
    if (!c) return g;
    if (!g) return c;
    return `${c} ${g}`;
  }

  if (cond.mode === "raw") {
    const score = clamp1to10(cond.raw.score);
    return `${score} – ${getConditionLabel(score)}`;
  }

  return "Condition: Unknown";
}

export function clamp1to10(n: any, fallback = 8): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(10, Math.round(x)));
}
