// ---- Pricing helpers (back-compat for UI) ----

export type DealBadge = "great" | "good" | "fair" | "overpriced" | "unknown";

/**
 * Returns "fair value" for the UI.
 * Current model: baseValue * conditionMultiplier, where baseValue comes from listing/market data.
 *
 * This is intentionally defensive because different call-sites may pass different shapes.
 */
export function getFairValue(input: any): number | null {
  if (!input) return null;

  // Common patterns we might see passed in:
  // - getFairValue({ baseValueCad, conditionMeta })
  // - getFairValue({ base_value_cad, meta })
  // - getFairValue(conditionMeta)  <-- fallback returns null
  const baseCandidates = [
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

  const meta: ConditionMeta | null =
    (input.conditionMeta as ConditionMeta) ??
    (input.meta as ConditionMeta) ??
    (typeof input.state === "string" && typeof input.grade === "string" ? (input as ConditionMeta) : null);

  const m = meta ? getConditionMultiplier(meta) : 1.0;
  const fair = base * m;

  // Keep it sane
  return Number.isFinite(fair) ? Math.max(0, fair) : null;
}

/**
 * Deal badge from price vs fair value.
 * Ratio thresholds are intentionally simple; tune later.
 */
export function getDealBadge(priceCad: number | null | undefined, fairValueCad: number | null | undefined): DealBadge {
  const p = typeof priceCad === "number" ? priceCad : null;
  const fv = typeof fairValueCad === "number" ? fairValueCad : null;

  if (!p || !fv || p <= 0 || fv <= 0) return "unknown";

  const r = p / fv;
  if (r <= 0.80) return "great";
  if (r <= 0.95) return "good";
  if (r <= 1.05) return "fair";
  return "overpriced";
}
