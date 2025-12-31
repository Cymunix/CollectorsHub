"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getConditionLabel } from "@/lib/pricingEngine";

type SaleRow = {
  id: string;
  sale_at: string | null;
  sale_price_cad: number | null;
  condition_json: Record<string, any> | null;
  source: string | null;
};

function money(value: number | string | null | undefined, currency: string = "CAD") {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function clampTier10(n: any, fallback = 8) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(10, x));
}

function clampScore100(n: any, fallback = 80) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function score100ToTier10(score100: any) {
  return clampTier10(Math.round(clampScore100(score100) / 10), 8);
}

function formatRelativeTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";

  const now = Date.now();
  const diffSec = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const mins = Math.round(diffSec / 60);
  const hours = Math.round(diffSec / 3600);
  const days = Math.round(diffSec / 86400);
  const weeks = Math.round(diffSec / 604800);
  const months = Math.round(diffSec / 2629800);
  const years = Math.round(diffSec / 31557600);

  if (abs < 60) return rtf.format(diffSec, "second");
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  if (Math.abs(weeks) < 5) return rtf.format(weeks, "week");
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  return rtf.format(years, "year");
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

/**
 * New schema:
 * cj = { v, item_type, mode, data: {...} }
 * Legacy schema:
 * cj = { conditionScore, isGraded, gradingCompany, ... }
 */
function formatConditionOrGradeFromJson(cj: Record<string, any> | null | undefined) {
  if (!cj) return "—";

  const data = cj?.data ?? cj;

  // For parts
  const forParts = !!(data?.for_parts ?? data?.forParts ?? data?.broken_for_parts);
  if (forParts) return "Broken / For Parts";

  // Graded
  const isGraded = !!(data?.is_graded ?? data?.isGraded ?? data?.graded);
  const company =
    typeof data?.grading_company === "string"
      ? data.grading_company
      : typeof data?.gradingCompany === "string"
        ? data.gradingCompany
        : "";
  const black = !!(data?.is_black_label ?? data?.isBlackLabel ?? data?.black_label);
  const gradeValueRaw = data?.grade_value ?? data?.gradeValue ?? data?.grade ?? data?.grade_value;

  if (isGraded && (company || gradeValueRaw !== undefined)) {
    const gv = gradeValueRaw !== undefined && gradeValueRaw !== null && gradeValueRaw !== "" ? Number(gradeValueRaw) : NaN;
    const isBgs = String(company || "").toUpperCase() === "BGS";
    if (isBgs && black) return "BGS Black Label 10";
    if (company && Number.isFinite(gv)) return `${company} ${gv}`;
    if (company) return String(company);
    if (Number.isFinite(gv)) return `Graded ${gv}`;
    return "Graded";
  }

  // Raw: prefer explicit score100 if present on the json (optional)
  // Otherwise fall back to tier10 if stored (generic items)
  // Otherwise legacy conditionScore 1–10
  const score100Maybe = data?.condition_score ?? cj?.condition_score;
  if (score100Maybe !== undefined && score100Maybe !== null && score100Maybe !== "") {
    const tier10 = score100ToTier10(score100Maybe);
    return `${tier10}/10 – ${getConditionLabel(tier10)}`;
  }

  const tier10Maybe = data?.tier10;
  if (tier10Maybe !== undefined && tier10Maybe !== null && tier10Maybe !== "") {
    const t = clampTier10(tier10Maybe, 8);
    return `${t}/10 – ${getConditionLabel(t)}`;
  }

  const legacyScore = data?.conditionScore ?? data?.condition_score;
  if (legacyScore !== undefined && legacyScore !== null && legacyScore !== "") {
    const t = clampTier10(legacyScore, 8);
    return `${t}/10 – ${getConditionLabel(t)}`;
  }

  return "—";
}

function formatSaleSource(raw: any): "Store" | "Online" | "Collector" | "—" {
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return "—";
  if (s.includes("store") || s.includes("instore") || s.includes("in_store") || s.includes("shop")) return "Store";
  if (s.includes("online") || s.includes("web") || s.includes("ebay") || s.includes("tcg") || s.includes("amazon")) return "Online";
  if (s.includes("collector") || s.includes("private") || s.includes("person") || s.includes("peer")) return "Collector";
  if (s === "store") return "Store";
  if (s === "online") return "Online";
  if (s === "collector") return "Collector";
  return "—";
}

/**
 * Filter key:
 * - Graded: company|grade|blacklabel
 * - Raw: tier10 (derived from score100 if present)
 */
function conditionKeyFromJson(cj: Record<string, any> | null | undefined): string {
  if (!cj) return "unknown";
  const data = cj?.data ?? cj;

  const forParts = !!(data?.for_parts ?? data?.forParts ?? data?.broken_for_parts);
  if (forParts) return "for_parts";

  const isGraded = !!(data?.is_graded ?? data?.isGraded ?? data?.graded);
  const companyRaw =
    typeof data?.grading_company === "string"
      ? data.grading_company
      : typeof data?.gradingCompany === "string"
        ? data.gradingCompany
        : "";
  const company = String(companyRaw || "").trim().toUpperCase();
  const black = !!(data?.is_black_label ?? data?.isBlackLabel ?? data?.black_label);
  const gradeValueRaw = data?.grade_value ?? data?.gradeValue ?? data?.grade;

  if (isGraded) {
    const gv = gradeValueRaw !== undefined && gradeValueRaw !== null && gradeValueRaw !== "" ? Number(gradeValueRaw) : NaN;
    const g = Number.isFinite(gv) ? String(gv) : "?";
    return `graded|${company || "UNKNOWN"}|${g}|${black ? "black" : "normal"}`;
  }

  const score100Maybe = data?.condition_score ?? cj?.condition_score;
  if (score100Maybe !== undefined && score100Maybe !== null && score100Maybe !== "") {
    const tier10 = score100ToTier10(score100Maybe);
    return `raw|${tier10}`;
  }

  const tier10Maybe = data?.tier10;
  if (tier10Maybe !== undefined && tier10Maybe !== null && tier10Maybe !== "") {
    const t = clampTier10(tier10Maybe, 8);
    return `raw|${t}`;
  }

  const legacyScore = data?.conditionScore ?? data?.condition_score;
  if (legacyScore !== undefined && legacyScore !== null && legacyScore !== "") {
    const t = clampTier10(legacyScore, 8);
    return `raw|${t}`;
  }

  return "unknown";
}

export default function ItemSalesHistoryTab({
  catalogItemId,
  selectedConditionJson,
}: {
  catalogItemId: string;
  selectedConditionJson?: Record<string, any> | null;
}) {
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesErr, setSalesErr] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);

  const selectedKey = useMemo(() => conditionKeyFromJson(selectedConditionJson ?? null), [selectedConditionJson]);

  const loadSales = async () => {
    if (!catalogItemId) return;
    setSalesLoading(true);
    setSalesErr(null);

    try {
      const res = await supabase
        .from("marketplace_sales")
        .select("id,sale_at,sale_price_cad,condition_jsonb,source")
        .eq("catalog_item_id", catalogItemId)
        .not("sale_price_cad", "is", null)
        .order("sale_at", { ascending: false })
        .limit(250);

      if (res.error) throw res.error;

      const rows = (res.data ?? []).map((r: any) => ({
        id: String(r.id),
        sale_at: r.sale_at ?? null,
        sale_price_cad:
          typeof r.sale_price_cad === "number" ? r.sale_price_cad : r.sale_price_cad === null ? null : Number(r.sale_price_cad),
        condition_json: (r.condition_jsonb ?? null) as any,
        source: r.source ?? null,
      })) as SaleRow[];

      setSales(rows);
    } catch (e: any) {
      console.error(e);
      setSales([]);
      setSalesErr(e?.message || "Could not load sales history.");
    } finally {
      setSalesLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId]);

  const filteredSales = useMemo(() => {
    if (!selectedConditionJson) return sales;
    if (selectedKey === "unknown") return sales;
    return sales.filter((s) => conditionKeyFromJson(s.condition_json) === selectedKey);
  }, [sales, selectedConditionJson, selectedKey]);

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Sales History</div>
        <button
          type="button"
          onClick={loadSales}
          className="rounded-lg border border-[#E5E9F2] bg-white px-3 py-1.5 text-[11px] font-semibold hover:bg-[#F8FAFC]"
        >
          Refresh
        </button>
      </div>

      <div className="p-4">
        {salesErr ? <div className="mb-3 text-xs text-red-600">{salesErr}</div> : null}

        {salesLoading ? (
          <div className="text-xs text-[#64748B]">Loading…</div>
        ) : filteredSales.length === 0 ? (
          <div className="text-xs text-[#64748B]">No sales recorded yet.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left">
                  <th className="sticky top-0 bg-white border-b border-[#E5E9F2] px-3 py-2 text-[11px] font-semibold text-[#0F172A]">Date</th>
                  <th className="sticky top-0 bg-white border-b border-[#E5E9F2] px-3 py-2 text-[11px] font-semibold text-[#0F172A]">Sold Price</th>
                  <th className="sticky top-0 bg-white border-b border-[#E5E9F2] px-3 py-2 text-[11px] font-semibold text-[#0F172A]">Condition / Grade</th>
                  <th className="sticky top-0 bg-white border-b border-[#E5E9F2] px-3 py-2 text-[11px] font-semibold text-[#0F172A]">Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((s) => (
                  <tr key={s.id} className="border-b border-[#EEF2F7]">
                    <td className="px-3 py-2 text-xs text-[#0F172A]">
                      <div className="font-medium">{formatRelativeTime(s.sale_at)}</div>
                      <div className="text-[11px] text-[#64748B]">{formatShortDate(s.sale_at)}</div>
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-[#0F172A]">{money(s.sale_price_cad)}</td>
                    <td className="px-3 py-2 text-xs text-[#0F172A]">{formatConditionOrGradeFromJson(s.condition_json)}</td>
                    <td className="px-3 py-2 text-xs text-[#0F172A]">{formatSaleSource(s.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 text-[11px] text-[#64748B]">Sales are anonymized. No buyer info and no store names are shown.</div>
      </div>
    </div>
  );
}
