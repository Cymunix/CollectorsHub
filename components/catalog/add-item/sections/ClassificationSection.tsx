"use client";

import React, { useMemo } from "react";
import FieldLabel from "../blocks/FieldLabel";
import Select from "../blocks/Select";
import InlineCreateButton from "../blocks/InlineCreateButton";
import type { Category, Subcategory, Franchise } from "@/lib/catalog/types";

type Props = {
  metaLoading: boolean;
  metaError: string | null;

  categories: Category[];
  subcategories: Subcategory[];
  franchises: Franchise[];

  categoryId: string;
  setCategoryId: (v: string) => void;

  subcategoryId: string;
  setSubcategoryId: (v: string) => void;

  franchiseId: string;
  setFranchiseId: (v: string) => void;

  onCreateFranchise: () => void;
};

export default function ClassificationSection({
  metaLoading,
  metaError,
  categories,
  subcategories,
  franchises,
  categoryId,
  setCategoryId,
  subcategoryId,
  setSubcategoryId,
  franchiseId,
  setFranchiseId,
  onCreateFranchise,
}: Props) {
  const hasCategory = !!String(categoryId || "").trim();
  const hasSubcategory = !!String(subcategoryId || "").trim();

  const filteredSubcategories = useMemo(() => {
    const c = String(categoryId || "");
    if (!c) return subcategories ?? [];
    return (subcategories ?? []).filter((sc) => String(sc.category_id) === c);
  }, [subcategories, categoryId]);

  return (
    <div className="rounded-2xl border p-4 mb-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Classification</h3>
        {metaLoading ? (
          <span className="text-[10px] animate-pulse text-blue-500 font-bold">Updating Data...</span>
        ) : null}
      </div>

      {metaError ? <p className="text-[11px] text-red-600 mb-2">{metaError}</p> : null}

      {/* Helpful UI hint (does NOT replace submit validation) */}
      {hasCategory && !hasSubcategory ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          Subcategory is required. Pick a subcategory before creating the item.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Category */}
        <div className="space-y-1">
          <FieldLabel req>Category</FieldLabel>
          <Select
            value={categoryId}
            onChange={(e) => {
              const next = e.target.value;
              setCategoryId(next);

              // category change invalidates these
              setSubcategoryId("");
              setFranchiseId("");
            }}
          >
            <option value="">Select Category…</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Subcategory */}
        <div className="space-y-1">
          <FieldLabel req>Subcategory</FieldLabel>
          <Select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            disabled={!hasCategory}
          >
            <option value="">{hasCategory ? "Select Subcategory…" : "Select category first"}</option>
            {filteredSubcategories.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Franchise */}
        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Franchise</FieldLabel>
            <InlineCreateButton onClick={onCreateFranchise}>+ New</InlineCreateButton>
          </div>

          <Select
            value={franchiseId}
            onChange={(e) => setFranchiseId(e.target.value)}
            disabled={!hasSubcategory}
          >
            <option value="">{hasSubcategory ? "(none)" : "Select subcategory first"}</option>
            {(franchises ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
