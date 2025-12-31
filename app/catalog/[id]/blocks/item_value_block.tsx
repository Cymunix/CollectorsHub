"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getFairValue } from "@/lib/pricingEngine";

function money(value: number | string | null | undefined, currency: string = "CAD") {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function clampScore100(n: any, fallback = 80) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function normalizeFairValueResult(raw: any): { value: number | null; confidence: "estimated" | "exact" | "unknown"; reason: string | null } {
  if (typeof raw === "number" && Number.isFinite(raw)) return { value: raw, confidence: "exact", reason: null };
  if (raw && typeof raw === "object") {
    const v =
      typeof raw.value === "number"
        ? raw.value
        : typeof raw.fairValue === "number"
          ? raw.fairValue
          : typeof raw.price === "number"
            ? raw.price
            : null;
    const conf = raw.confidence === "estimated" || raw.confidence === "exact" ? raw.confidence : "unknown";
    const reason = typeof raw.reason === "string" && raw.reason.trim().length ? raw.reason : null;
    return { value: v !== null && Number.isFinite(v) ? v : null, confidence: conf, reason };
  }
  return { value: null, confidence: "unknown", reason: null };
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
      <div className="text-[11px] text-white/60">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
    </div>
  );
}

function Chip({
  children,
  title,
  tone,
}: {
  children: React.ReactNode;
  title?: string;
  tone: "neutral" | "warn";
}) {
  const cls =
    tone === "warn"
      ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
      : "border-white/15 bg-white/5 text-white/80";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`} title={title}>
      {children}
    </span>
  );
}

/**
 * ✅ NEW condition system support:
 * conditionValues = { v, item_type, mode, data:{...} }
 * But we also accept legacy keys while migrating.
 */
function extractGrading(conditionValues: Record<string, any>) {
  const cv = conditionValues ?? {};
  const data = cv.data ?? cv;

  const isGraded = !!(data.is_graded ?? data.isGraded ?? data.graded);

  const gradingCompany =
    typeof data.grading_company === "string"
      ? data.grading_company
      : typeof data.gradingCompany === "string"
        ? data.gradingCompany
        : null;

  const gradeValueRaw = data.grade_value ?? data.gradeValue ?? data.grade;
  const gradeValue =
    gradeValueRaw !== undefined && gradeValueRaw !== null && gradeValueRaw !== ""
      ? Number(gradeValueRaw)
      : null;

  const gradeLabel =
    typeof data.grade_label === "string"
      ? data.grade_label
      : typeof data.gradeLabel === "string"
        ? data.gradeLabel
        : null;

  return { isGraded, gradingCompany, gradeValue, gradeLabel };
}

export default function ItemValueBlock({
  catalogItemId,
  categoryName,
  isBuildingBlocks,
  isGradableCategory,
  conditionValues,
  conditionScore, // ✅ this is NOW 0–100
}: {
  catalogItemId: string;
  categoryName: string | null;
  isBuildingBlocks: boolean;
  isGradableCategory: boolean;
  conditionValues: Record<string, any>;
  conditionScore: number; // 0–100
}) {
  const [marketCurrent, setMarketCurrent] = useState<number | null>(null);
  const [marketAllTimeHigh, setMarketAllTimeHigh] = useState<number | null>(null);
  const [market30DayAvg, setMarket30DayAvg] = useState<number | null>(null);
  const [avgCH, setAvgCH] = useState<number | null>(null);
  const [marketLastUpdated, setMarketLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);

      const { data, error } = await supabase
        .from("marketplace_sales")
        .select("sale_price_cad, sale_at")
        .eq("catalog_item_id", catalogItemId)
        .not("sale_price_cad", "is", null)
        .order("sale_at", { ascending: false });

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        setMarketCurrent(null);
        setMarketAllTimeHigh(null);
        setMarket30DayAvg(null);
        setAvgCH(null);
        setMarketLastUpdated(null);
        return;
      }

      const rows = data
        .map((r: any) => ({
          price: typeof r.sale_price_cad === "number" ? r.sale_price_cad : Number(r.sale_price_cad),
          at: r.sale_at ? new Date(r.sale_at) : null,
        }))
        .filter((r: any) => Number.isFinite(r.price) && r.at instanceof Date && !isNaN(r.at.getTime()));

      if (rows.length === 0) {
        setMarketCurrent(null);
        setMarketAllTimeHigh(null);
        setMarket30DayAvg(null);
        setAvgCH(null);
        setMarketLastUpdated(null);
        return;
      }

      const prices = rows.map((r: any) => r.price);
      const ath = Math.max(...prices);
      const latest = rows[0].price;
      const last30 = rows.filter((r: any) => r.at >= since30).map((r: any) => r.price);
      const avg30 = last30.length ? last30.reduce((a: number, b: number) => a + b, 0) / last30.length : null;
      const avgAll = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;

      setMarketCurrent(latest);
      setMarketAllTimeHigh(ath);
      setMarket30DayAvg(avg30);
      setAvgCH(avgAll);
      setMarketLastUpdated(new Date().toLocaleDateString());
    };

    if (catalogItemId) load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const baseMarketPrice = useMemo(() => {
    const v = market30DayAvg ?? avgCH ?? marketCurrent ?? null;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }, [market30DayAvg, avgCH, marketCurrent]);

  const grading = useMemo(() => extractGrading(conditionValues), [conditionValues]);

  const itemFair = useMemo(() => {
    if (typeof baseMarketPrice !== "number") {
      return { value: null, confidence: "unknown" as const, reason: null as string | null };
    }

    // ✅ IMPORTANT: pricing engine now expects 0–100
    const score100 = clampScore100(conditionScore, 80);

    const raw = getFairValue({
      baseMarketPrice,
      category: categoryName ?? "",
      conditionScore: score100,
      gradingCompany: isGradableCategory && grading.isGraded ? grading.gradingCompany : null,
      gradeValue: isGradableCategory && grading.isGraded ? grading.gradeValue : null,
      gradeLabel: isGradableCategory && grading.isGraded ? grading.gradeLabel : null,
    });

    // Your engine currently returns number only → we treat that as exact.
    // If later you return objects, normalizeFairValueResult handles it.
    return normalizeFairValueResult(raw);
  }, [baseMarketPrice, categoryName, conditionScore, grading, isGradableCategory]);

  const displayedCurrentValue = itemFair.value ?? marketCurrent ?? null;

  const showEstimatedNote = itemFair.confidence === "estimated";
  const estimatedTooltip = itemFair.reason?.trim()?.length ? itemFair.reason : "Adjusted from recent sales using condition modeling.";

  // ✅ Show grade label if graded
  const gradeChip = useMemo(() => {
    if (!isGradableCategory) return null;
    if (!grading.isGraded) return null;
    return grading.gradeLabel || (grading.gradingCompany ? String(grading.gradingCompany) : null);
  }, [grading, isGradableCategory]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1220] text-white shadow-sm">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white/60">Current Value</div>

            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="text-3xl font-bold tracking-tight">{money(displayedCurrentValue)}</div>

              {showEstimatedNote ? (
                <span
                  className="text-[12px] font-semibold text-amber-200/90 underline decoration-dotted underline-offset-4 cursor-help"
                  title={estimatedTooltip}
                >
                  Estimated price based on condition
                </span>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 text-right space-y-2">
            {marketLastUpdated ? <Chip tone="neutral">{`Updated ${marketLastUpdated}`}</Chip> : <Chip tone="neutral">No recent sales</Chip>}

            {gradeChip ? <Chip tone="neutral">{String(gradeChip)}</Chip> : null}

            {/* optional: show lego tag, purely informational */}
            {isBuildingBlocks ? <Chip tone="neutral">LEGO</Chip> : null}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Last Sold" value={money(marketCurrent)} />
        <StatPill label="30 Day Avg" value={money(market30DayAvg)} />
        <StatPill label="All Time High" value={money(marketAllTimeHigh)} />
        <StatPill label="Avg CH" value={money(avgCH)} />
      </div>
    </div>
  );
}
