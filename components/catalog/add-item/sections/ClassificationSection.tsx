// components/catalog/add-item/sections/ClassificationSection.tsx
"use client";

import React from "react";
import FieldLabel from "../blocks/FieldLabel";
import Select from "../blocks/Select";
import InlineCreateButton from "../blocks/InlineCreateButton";
import type { Category, Subcategory, Franchise } from "@/lib/catalog/types";

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
}: {
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
}) {
  const modalSubcategories = subcategories.filter((sc) => !categoryId || sc.category_id === categoryId);

  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold">Classification</h3>
        {metaLoading && <span className="text-[11px] text-gray-500">Loading…</span>}
      </div>

      {metaError && <p className="text-[11px] text-red-600 mb-2">{metaError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <FieldLabel req>Category</FieldLabel>
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSubcategoryId("");
              setFranchiseId("");
            }}
          >
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <FieldLabel req>Subcategory</FieldLabel>
          <Select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            disabled={!categoryId}
          >
            <option value="">{categoryId ? "Select…" : "Select category first"}</option>
            {modalSubcategories.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 text-xs">
        <div className="flex items-center justify-between">
          <FieldLabel>Franchise</FieldLabel>
          <InlineCreateButton onClick={onCreateFranchise}>+ New</InlineCreateButton>
        </div>
        <Select value={franchiseId} onChange={(e) => setFranchiseId(e.target.value)} className="mt-1">
          <option value="">(none)</option>
          {franchises.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
