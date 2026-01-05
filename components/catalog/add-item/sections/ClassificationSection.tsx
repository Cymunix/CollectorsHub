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

  // ✅ ADDED
  genres: Array<{ id: string; name: string }>;
  ageRatings: Array<{ id: string; code: string; label?: string | null; system?: string | null }>;

  categoryId: string;
  setCategoryId: (v: string) => void;

  subcategoryId: string;
  setSubcategoryId: (v: string) => void;

  franchiseId: string;
  setFranchiseId: (v: string) => void;

  // ✅ ADDED
  genreIds: string[];
  setGenreIds: (v: string[]) => void;
  ageRatingId: string;
  setAgeRatingId: (v: string) => void;

  onCreateFranchise: () => void;
};

export default function ClassificationSection({
  metaLoading,
  metaError,
  categories,
  subcategories,
  franchises,
  genres = [],
  ageRatings = [],

  categoryId,
  setCategoryId,
  subcategoryId,
  setSubcategoryId,
  franchiseId,
  setFranchiseId,

  genreIds = [],
  setGenreIds,
  ageRatingId,
  setAgeRatingId,

  onCreateFranchise,
}: Props) {
  const modalSubcategories = useMemo(() => {
    return subcategories.filter((sc) => !categoryId || sc.category_id === categoryId);
  }, [subcategories, categoryId]);

  const hasCategory = !!String(categoryId || "").trim();
  const hasSubcategory = !!String(subcategoryId || "").trim();

  const showSubcategoryMissing = hasCategory && !hasSubcategory;

  const toggleGenre = (id: string) => {
    const current = genreIds ?? [];
    if (current.includes(id)) setGenreIds(current.filter((gid) => gid !== id));
    else setGenreIds([...current, id]);
  };

  return (
    <div className="rounded-2xl border p-4 mb-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Classification</h3>
        {metaLoading && (
          <span className="text-[10px] animate-pulse text-blue-500 font-bold">Updating Data...</span>
        )}
      </div>

      {metaError ? <p className="text-[11px] text-red-600 mb-2">{metaError}</p> : null}

      {/* HARD WARNING: subcategory required */}
      {showSubcategoryMissing ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          Subcategory is required. Select a subcategory before creating the item.
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

              // Changing category invalidates subcategory
              setCategoryId(next);
              setSubcategoryId("");
              setFranchiseId("");

              // Also reset genre + age rating so you don't carry incompatible values
              setGenreIds([]);
              setAgeRatingId("");
            }}
          >
            <option value="">Select Category…</option>
            {categories.map((c) => (
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
            {modalSubcategories.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Age Rating */}
        <div className="space-y-1">
          <FieldLabel>Age Rating</FieldLabel>
          <Select
            value={ageRatingId}
            onChange={(e) => setAgeRatingId(e.target.value)}
            disabled={!hasSubcategory} // ✅ prevents nonsense states
          >
            <option value="">{hasSubcategory ? "Select Rating…" : "Select subcategory first"}</option>
            {ageRatings.map((ar) => (
              <option key={ar.id} value={ar.id}>
                {ar.code}
                {ar.label ? ` - ${ar.label}` : ""}
              </option>
            ))}
          </Select>
        </div>

        {/* Franchise */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel>Franchise</FieldLabel>
            <InlineCreateButton onClick={onCreateFranchise}>+ New</InlineCreateButton>
          </div>
          <Select
            value={franchiseId}
            onChange={(e) => setFranchiseId(e.target.value)}
            disabled={!hasSubcategory} // optional but keeps selection sane
          >
            <option value="">{hasSubcategory ? "(none)" : "Select subcategory first"}</option>
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Genres */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="mb-2">
          <FieldLabel>Genres (Select Multiple)</FieldLabel>
        </div>

        {!hasSubcategory ? (
          <div className="rounded-xl border bg-[#F8FAFC] p-3 text-[11px] text-slate-500">
            Select a subcategory first.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {genres.length === 0 ? (
              <span className="text-slate-400">Loading...</span>
            ) : (
              genres.map((g) => {
                const isSelected = (genreIds ?? []).includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGenre(g.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
