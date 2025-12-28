"use client";

import React, { useMemo } from "react";

type Mode = "summary" | "breakdowns" | "duplicates" | "completeness" | "lego";

type AnyCard = {
  id?: string;
  catalog_item_id?: string;

  // common
  name?: string | null;
  kind?: string | null; // you already use this for filtering
  category_name?: string | null; // optional (if your query includes it)

  copiesCount?: number | null;

  // value fields (support multiple possible names)
  value_cad?: number | null;
  fair_value_cad?: number | null;
  estimated_value_cad?: number | null;
  current_value_cad?: number | null;
  price_cad?: number | null;

  // cost fields
  purchase_price_cad?: number | null;
  cost_cad?: number | null;
  paid_cad?: number | null;

  // grading
  graded?: boolean | null;
  grade?: string | null;
  grade_company?: string | null;
  grade_value?: number | null;

  // sale status
  forSale?: boolean | null;
  is_for_sale?: boolean | null;

  // completeness (support multiple possible names)
  theme_name?: string | null;
  theme?: string | null;
  themeName?: string | null;

  subtheme_name?: string | null;
  subtheme?: string | null;
  subthemeName?: string | null;

  year?: number | null;
  release_year?: number | null;
  releaseYear?: number | null;

  brand_name?: string | null;
  brand?: string | null;
  brandName?: string | null;

  // LEGO completion (optional)
  lego_box?: boolean | null;
  lego_instructions?: boolean | null;
  lego_minifigs_complete_pct?: number | null;
  lego_parts_complete_pct?: number | null;
};

function n(v: any): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtCad(v: number): string {
  try {
    return v.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

function pct01(v: number): string {
  if (!Number.isFinite(v)) return "0%";
  return `${Math.round(v * 100)}%`;
}

function getCopies(c: AnyCard): number {
  const x = Number(c.copiesCount ?? 1);
  return Number.isFinite(x) && x > 0 ? x : 1;
}

function getCategoryLabel(c: AnyCard): string {
  const cat = String(c.category_name || c.kind || "").trim();
  return cat || "Uncategorized";
}

function getTheme(c: AnyCard): string {
  return String(c.theme_name || c.theme || c.themeName || "").trim();
}

function getSubtheme(c: AnyCard): string {
  return String(c.subtheme_name || c.subtheme || c.subthemeName || "").trim();
}

function getBrand(c: AnyCard): string {
  return String(c.brand_name || c.brand || c.brandName || "").trim();
}

function getYear(c: AnyCard): number | null {
  const y = c.year ?? c.release_year ?? c.releaseYear;
  const x = Number(y);
  return Number.isFinite(x) ? x : null;
}

function pickValueCad(c: AnyCard): number {
  // priority order: value > current > fair > estimated > price
  const a = n(c.value_cad);
  if (a) return a;
  const b = n(c.current_value_cad);
  if (b) return b;
  const c1 = n(c.fair_value_cad);
  if (c1) return c1;
  const d = n(c.estimated_value_cad);
  if (d) return d;
  return n(c.price_cad);
}

function pickCostCad(c: AnyCard): number {
  const a = n(c.purchase_price_cad);
  if (a) return a;
  const b = n(c.cost_cad);
  if (b) return b;
  return n(c.paid_cad);
}

function isGraded(c: AnyCard): boolean {
  if (c.graded === true) return true;
  return Boolean(
    c.grade ||
      c.grade_company ||
      (c.grade_value != null && Number.isFinite(Number(c.grade_value)))
  );
}

function isForSale(c: AnyCard): boolean {
  if (c.forSale != null) return !!c.forSale;
  if (c.is_for_sale != null) return !!c.is_for_sale;
  return false;
}

/* UI helpers */

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MiniRow({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="text-sm text-gray-700">{left}</div>
      <div className="text-sm font-semibold">{right}</div>
    </div>
  );
}

function ProgressBar({ value01 }: { value01: number }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value01) ? value01 : 0));
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-2 rounded-full bg-gray-900"
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

export default function InsightsPanel({
  cards,
  mode = "summary",
}: {
  cards?: AnyCard[];
  mode?: Mode;
}) {
  const safeCards = Array.isArray(cards) ? cards : [];

  const insights = useMemo(() => {
    const uniqueItems = safeCards.length;
    const totalCopies = safeCards.reduce((sum, c) => sum + getCopies(c), 0);
    const gradedItems = safeCards.filter(isGraded).length;

    let totalValue = 0;
    let totalCost = 0;

    for (const c of safeCards) {
      const copies = getCopies(c);
      totalValue += pickValueCad(c) * copies;
      totalCost += pickCostCad(c) * copies;
    }

    const profit = totalValue - totalCost;
    const roi = totalCost > 0 ? profit / totalCost : 0;

    // value by category (use kind/category_name)
    const byCategory = new Map<string, number>();
    for (const c of safeCards) {
      const copies = getCopies(c);
      const cat = getCategoryLabel(c);
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + pickValueCad(c) * copies);
    }

    const categoryRows = Array.from(byCategory.entries())
      .map(([k, v]) => ({ k, v }))
      .sort((a, b) => b.v - a.v);

    const gradedValue = safeCards.reduce((sum, c) => {
      const copies = getCopies(c);
      return sum + (isGraded(c) ? pickValueCad(c) * copies : 0);
    }, 0);

    const rawValue = totalValue - gradedValue;

    // duplicates (current approach uses copiesCount)
    const duplicates = safeCards
      .filter((c) => getCopies(c) > 1)
      .map((c) => {
        const copies = getCopies(c);
        const unitValue = pickValueCad(c);
        const unitCost = pickCostCad(c);
        return {
          name: c.name || "Unnamed item",
          copies,
          unitValue,
          unitCost,
          unitProfit: unitValue - unitCost,
          totalProfit: (unitValue - unitCost) * copies,
        };
      })
      .sort((a, b) => b.copies - a.copies || b.unitValue - a.unitValue);

    // completeness (NOW aligns with your data)
    const metaFields = [
      { label: "Category", has: (c: AnyCard) => !!getCategoryLabel(c) && getCategoryLabel(c) !== "Uncategorized" },
      { label: "Theme", has: (c: AnyCard) => !!getTheme(c) },
      { label: "Subtheme", has: (c: AnyCard) => !!getSubtheme(c) },
      { label: "Year", has: (c: AnyCard) => getYear(c) != null },
      { label: "Brand", has: (c: AnyCard) => !!getBrand(c) },
    ];

    const completeness = metaFields.map((f) => {
      const filled = safeCards.filter(f.has).length;
      const total = safeCards.length || 1;
      return { label: f.label, filled, total, ratio: filled / total };
    });

    // sale summary (useful later)
    const forSaleCount = safeCards.reduce((sum, c) => sum + (isForSale(c) ? getCopies(c) : 0), 0);

    // LEGO completion
    const legoCards = safeCards.filter((c) =>
      getCategoryLabel(c).toLowerCase().includes("lego")
    );

    const legoCompletion = legoCards.map((c) => {
      const box = c.lego_box === true;
      const inst = c.lego_instructions === true;
      const minifigs = n(c.lego_minifigs_complete_pct) / 100;
      const parts = n(c.lego_parts_complete_pct) / 100;

      const signals: number[] = [];
      if (c.lego_box != null) signals.push(box ? 1 : 0);
      if (c.lego_instructions != null) signals.push(inst ? 1 : 0);
      if (c.lego_minifigs_complete_pct != null) signals.push(Math.max(0, Math.min(1, minifigs)));
      if (c.lego_parts_complete_pct != null) signals.push(Math.max(0, Math.min(1, parts)));

      const overall = signals.length
        ? signals.reduce((a, b) => a + b, 0) / signals.length
        : 0;

      return {
        name: c.name || "LEGO item",
        overall,
        box,
        inst,
        minifigs,
        parts,
      };
    });

    return {
      uniqueItems,
      totalCopies,
      gradedItems,
      totalValue,
      totalCost,
      profit,
      roi,
      categoryRows,
      gradedValue,
      rawValue,
      duplicates,
      completeness,
      forSaleCount,
      legoCompletion,
    };
  }, [safeCards]);

  // SUMMARY
  if (mode === "summary") {
    return (
      <div className="space-y-4">
        <Section title="Collection Financial Summary">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Tile label="Total Value" value={fmtCad(insights.totalValue)} sub="Estimated from current pricing" />
            <Tile label="Total Cost" value={fmtCad(insights.totalCost)} sub="Based on purchase prices (if set)" />
            <Tile
              label="Profit"
              value={
                <span className={insights.profit >= 0 ? "text-green-700" : "text-red-700"}>
                  {fmtCad(insights.profit)}
                </span>
              }
              sub={insights.totalCost > 0 ? `${pct01(insights.roi)} return` : "Set purchase prices to calculate ROI"}
            />
            <Tile
              label="Count"
              value={
                <span>
                  {insights.uniqueItems} <span className="text-gray-400">/</span> {insights.totalCopies}
                </span>
              }
              sub="Unique items / total copies"
            />
          </div>
        </Section>

        <Section title="Quick Stats">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Tile label="Unique Items" value={insights.uniqueItems} />
            <Tile label="Total Copies" value={insights.totalCopies} />
            <Tile label="Graded Items" value={insights.gradedItems} />
            <Tile label="For Sale (copies)" value={insights.forSaleCount} />
          </div>
        </Section>
      </div>
    );
  }

  // BREAKDOWNS
  if (mode === "breakdowns") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Value by Category">
          {insights.categoryRows.length === 0 ? (
            <div className="text-sm text-gray-500">No items yet.</div>
          ) : (
            <div className="space-y-2">
              {insights.categoryRows.slice(0, 10).map((r) => (
                <div key={r.k} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">{r.k}</div>
                    <div className="text-sm font-semibold">{fmtCad(r.v)}</div>
                  </div>
                  <ProgressBar value01={insights.totalValue > 0 ? r.v / insights.totalValue : 0} />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Graded vs Raw Value">
          <MiniRow left="Graded Value" right={fmtCad(insights.gradedValue)} />
          <ProgressBar value01={insights.totalValue > 0 ? insights.gradedValue / insights.totalValue : 0} />

          <div className="h-3" />

          <MiniRow left="Raw Value" right={fmtCad(insights.rawValue)} />
          <ProgressBar value01={insights.totalValue > 0 ? insights.rawValue / insights.totalValue : 0} />
        </Section>
      </div>
    );
  }

  // DUPLICATES
  if (mode === "duplicates") {
    return (
      <Section title="Duplicates">
        {insights.duplicates.length === 0 ? (
          <div className="text-sm text-gray-500">No duplicates yet.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-right">Copies</div>
              <div className="col-span-2 text-right">Value</div>
              <div className="col-span-2 text-right">Profit</div>
            </div>

            {insights.duplicates.slice(0, 50).map((d, i) => (
              <div key={i} className="grid grid-cols-12 px-3 py-2 text-sm border-t">
                <div className="col-span-6 text-gray-800 truncate">{d.name}</div>
                <div className="col-span-2 text-right font-semibold">{d.copies}</div>
                <div className="col-span-2 text-right">{fmtCad(d.unitValue)}</div>
                <div className={`col-span-2 text-right ${d.unitProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {fmtCad(d.unitProfit)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 text-xs text-gray-500">
          Duplicates are currently detected using <code>copiesCount</code>. If you later store one row per copy, we’ll switch to grouping by
          <code>catalog_item_id</code>.
        </div>
      </Section>
    );
  }

  // COMPLETENESS
  if (mode === "completeness") {
    return (
      <Section title="Completeness">
        <div className="space-y-3">
          {insights.completeness.map((c) => (
            <div key={c.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">{c.label}</div>
                <div className="text-sm font-semibold">
                  {c.filled}/{c.total}
                </div>
              </div>
              <ProgressBar value01={c.ratio} />
            </div>
          ))}
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Completeness is based on fields present in your collection query (kind/theme/subtheme/year/brand).
        </div>
      </Section>
    );
  }

  // LEGO
  return (
    <Section title="LEGO Set Completion">
      {insights.legoCompletion.length === 0 ? (
        <div className="text-sm text-gray-500">No LEGO items detected in the current view.</div>
      ) : (
        <div className="space-y-3">
          {insights.legoCompletion.slice(0, 30).map((l, idx) => (
            <div key={idx} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold truncate">{l.name}</div>
                <div className="text-sm font-semibold">{pct01(l.overall)}</div>
              </div>

              <div className="mt-2">
                <ProgressBar value01={l.overall} />
              </div>

              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                <div>
                  Box: <span className="font-semibold text-gray-900">{l.box ? "Yes" : "No"}</span>
                </div>
                <div>
                  Instructions: <span className="font-semibold text-gray-900">{l.inst ? "Yes" : "No"}</span>
                </div>
                <div>
                  Minifigs: <span className="font-semibold text-gray-900">{pct01(l.minifigs)}</span>
                </div>
                <div>
                  Parts: <span className="font-semibold text-gray-900">{pct01(l.parts)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
