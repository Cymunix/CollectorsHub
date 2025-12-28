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

function clampScore(n: any, fallback = 8) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(10, x));
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

export default function ItemValueBlock({
  catalogItemId,
  categoryName,
  isBuildingBlocks,
  isGradableCategory,
  conditionValues,
  conditionScore,
}: {
  catalogItemId: string;
  categoryName: string | null;
  isBuildingBlocks: boolean;
  isGradableCategory: boolean;
  conditionValues: Record<string, any>;
  conditionScore: number;
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

  const itemFair = useMemo(() => {
    if (typeof baseMarketPrice !== "number") return { value: null, confidence: "unknown" as const, reason: null as string | null };

    const isGraded = !!conditionValues?.isGraded;
    const gradingCompany = isGradableCategory && isGraded && typeof conditionValues?.gradingCompany === "string" ? conditionValues.gradingCompany : null;
    const gradeValue =
      isGradableCategory && isGraded && conditionValues?.gradeValue !== undefined && conditionValues?.gradeValue !== null && conditionValues?.gradeValue !== ""
        ? Number(conditionValues.gradeValue)
        : null;
    const gradeLabel = isGradableCategory && isGraded && typeof conditionValues?.gradeLabel === "string" ? conditionValues.gradeLabel : null;

    const score = !isBuildingBlocks ? clampScore(conditionScore, 8) : 8;

    const raw = getFairValue({
      baseMarketPrice,
      category: categoryName,
      conditionScore: score,
      gradingCompany,
      gradeValue,
      gradeLabel,
    });

    return normalizeFairValueResult(raw);
  }, [baseMarketPrice, categoryName, isBuildingBlocks, conditionScore, isGradableCategory, conditionValues]);

  const displayedCurrentValue = itemFair.value ?? marketCurrent ?? null;

  const showEstimatedNote = itemFair.confidence === "estimated";

  // Requested tooltip message (with fallback to engine reason if present)
  const estimatedTooltip = itemFair.reason?.trim()?.length
    ? itemFair.reason
    : "Adjusted from recent sales using condition modeling.";

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1220] text-white shadow-sm">
      {/* Header row (tight) */}
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white/60">Current Value</div>

            {/* Price row + estimated note beside it */}
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

            {isGradableCategory && conditionValues?.isGraded && conditionValues?.gradeLabel ? (
              <Chip tone="neutral">{String(conditionValues.gradeLabel)}</Chip>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stats row (compact) */}
      <div className="px-4 pb-4 mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Last Sold" value={money(marketCurrent)} />
        <StatPill label="30 Day Avg" value={money(market30DayAvg)} />
        <StatPill label="All Time High" value={money(marketAllTimeHigh)} />
        <StatPill label="Avg CH" value={money(avgCH)} />
      </div>
    </div>
  );
}
