// components/catalog/add-item/sections/VariantsSection.tsx
"use client";

import React from "react";
import TextInput from "../blocks/TextInput";
import Select from "../blocks/Select";

type CatalogSearchRow = { id: string; name: string; upc: string | null; release_year: number | null };
type VariantDraft = { target_id: string; target_name: string; link_type: string; label: string };

export default function VariantsSection({
  LINK_TYPES,
  variantQuery,
  setVariantQuery,
  variantSearching,
  variantResults,
  linkedVariants,
  variantDefaultType,
  setVariantDefaultType,
  variantDefaultLabel,
  setVariantDefaultLabel,
  searchVariants,
  addVariant,
  removeVariant,
  updateVariant,
}: {
  LINK_TYPES: readonly string[];

  variantQuery: string;
  setVariantQuery: (v: string) => void;

  variantSearching: boolean;
  variantResults: CatalogSearchRow[];

  linkedVariants: VariantDraft[];

  variantDefaultType: string;
  setVariantDefaultType: (v: string) => void;

  variantDefaultLabel: string;
  setVariantDefaultLabel: (v: string) => void;

  searchVariants: () => Promise<void> | void;
  addVariant: (row: CatalogSearchRow) => void;
  removeVariant: (id: string) => void;
  updateVariant: (id: string, patch: Partial<VariantDraft>) => void;
}) {
  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold">Variants / Related</h3>
        <span className="text-[11px] text-gray-500">Optional</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="md:col-span-2 space-y-1">
          <label className="font-medium">Search catalog items</label>
          <div className="flex gap-2">
            <TextInput
              value={variantQuery}
              onChange={(e) => setVariantQuery(e.target.value)}
              placeholder="Search by name or UPC…"
              className="flex-1"
            />
            <button
              type="button"
              onClick={searchVariants}
              disabled={variantSearching}
              className="rounded-xl border bg-white px-3 py-2"
            >
              {variantSearching ? "Searching…" : "Search"}
            </button>
          </div>

          {variantResults.length > 0 && (
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border">
              {variantResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addVariant(r)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {r.release_year ? `Year ${r.release_year}` : "—"}
                    {r.upc ? ` • UPC ${r.upc}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="font-medium">Default type</label>
          <Select value={variantDefaultType} onChange={(e) => setVariantDefaultType(e.target.value)}>
            {(LINK_TYPES ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>

          <div className="space-y-1">
            <label className="font-medium">Default label</label>
            <TextInput
              value={variantDefaultLabel}
              onChange={(e) => setVariantDefaultLabel(e.target.value)}
              placeholder='e.g. "Blue variant"'
            />
          </div>
        </div>
      </div>

      <div className="mt-3">
        {linkedVariants.length === 0 ? (
          <div className="text-xs text-gray-400">No linked items.</div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            {linkedVariants.map((v) => (
              <div key={v.target_id} className="px-3 py-3 border-b last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{v.target_name}</div>
                    <div className="text-[11px] text-gray-500 font-mono">{v.target_id}</div>
                  </div>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() => removeVariant(v.target_id)}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">Type</div>
                    <Select
                      value={v.link_type}
                      onChange={(e) => updateVariant(v.target_id, { link_type: e.target.value })}
                    >
                      {(LINK_TYPES ?? []).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <div className="text-[11px] text-gray-500">Label</div>
                    <TextInput
                      value={v.label}
                      onChange={(e) => updateVariant(v.target_id, { label: e.target.value })}
                      placeholder="Optional label"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
