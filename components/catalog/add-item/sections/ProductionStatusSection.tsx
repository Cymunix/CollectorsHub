// components/catalog/add-item/sections/ProductionStatusSection.tsx
"use client";

import React from "react";

export const PRODUCTION_STATUSES = [
  { value: "in_production", label: "In Production" },
  { value: "out_of_production", label: "Out of Production" },
  { value: "discontinued", label: "Discontinued" },
  { value: "limited_run", label: "Limited Run" },
  { value: "preorder", label: "Pre-Order" },
  { value: "unknown", label: "Unknown" },
] as const;

export default function ProductionStatusSection(p: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-[#0F172A]">Production Status</div>
      <div className="mt-1 text-xs text-[#64748B]">
        Helps filters + pricing expectations. Use <b>Unknown</b> if you’re not sure.
      </div>

      <div className="mt-3">
        <select
          value={p.value || "unknown"}
          onChange={(e) => p.onChange(e.target.value)}
          disabled={p.disabled}
          className="w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
        >
          {PRODUCTION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
