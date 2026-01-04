"use client";

import React from "react";
import FieldLabel from "../blocks/FieldLabel";
import Select from "../blocks/Select";
import InlineCreateButton from "../blocks/InlineCreateButton";
import type { Category, Subcategory, Franchise } from "@/lib/catalog/types";

// Adding the missing types for the props
export default function ClassificationSection({
  metaLoading,
  metaError,
  categories,
  subcategories,
  franchises,
  genres,      // Added
  ageRatings,  // Added

  categoryId,
  setCategoryId,
  subcategoryId,
  setSubcategoryId,
  franchiseId,
  setFranchiseId,
  genreIds,    // Added
  setGenreIds, // Added
  ageRatingId, // Added
  setAgeRatingId, // Added

  onCreateFranchise,
}: {
  metaLoading: boolean;
  metaError: string | null;
  categories: Category[];
  subcategories: Subcategory[];
  franchises: Franchise[];
  genres: any[];      // Added
  ageRatings: any[];  // Added

  categoryId: string;
  setCategoryId: (v: string) => void;
  subcategoryId: string;
  setSubcategoryId: (v: string) => void;
  franchiseId: string;
  setFranchiseId: (v: string) => void;
  genreIds: string[];      // Added
  setGenreIds: (v: string[]) => void; // Added
  ageRatingId: string;     // Added
  setAgeRatingId: (v: string) => void; // Added

  onCreateFranchise: () => void;
}) {
  const modalSubcategories = subcategories.filter((sc) => !categoryId || sc.category_id === categoryId);

  // Helper to toggle genres in the array
  const toggleGenre = (id: string) => {
    if (genreIds.includes(id)) {
      setGenreIds(genreIds.filter(g => g !== id));
    } else {
      setGenreIds([...genreIds, id]);
    }
  };

  return (
    <div className="rounded-2xl border p-4 mb-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Classification</h3>
        {metaLoading && <span className="text-[10px] animate-pulse text-blue-500 font-bold">Fetching Data…</span>}
      </div>

      {metaError && <p className="text-[11px] text-red-600 mb-2">{metaError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Category */}
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
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>

        {/* Subcategory */}
        <div className="space-y-1">
          <FieldLabel req>Subcategory</FieldLabel>
          <Select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            disabled={!categoryId}
          >
            <option value="">{categoryId ? "Select…" : "Select category first"}</option>
            {modalSubcategories.map((sc) => (
              <option key={sc.id} value={sc.id}>{sc.name}</option>
            ))}
          </Select>
        </div>

        {/* Age Rating - NEW */}
        <div className="space-y-1">
          <FieldLabel>Age Rating</FieldLabel>
          <Select 
            value={ageRatingId} 
            onChange={(e) => setAgeRatingId(e.target.value)}
          >
            <option value="">Select Rating…</option>
            {ageRatings.map((ar) => (
              <option key={ar.id} value={ar.id}>
                {ar.code} {ar.label ? `(${ar.label})` : ""}
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
          <Select value={franchiseId} onChange={(e) => setFranchiseId(e.target.value)}>
            <option value="">(none)</option>
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Genres - NEW */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <FieldLabel className="mb-2 block">Genres (Select Multiple)</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => {
            const isSelected = genreIds.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGenre(g.id)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                  isSelected 
                    ? "bg-blue-600 border-blue-600 text-white" 
                    : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
