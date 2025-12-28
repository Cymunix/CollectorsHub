// components/catalog/add-item/sections/kinds/BuildingBlocksSection.tsx
"use client";

import React from "react";
import FieldLabel from "../../blocks/FieldLabel";
import TextInput from "../../blocks/TextInput";
import Select from "../../blocks/Select";
import InlineCreateButton from "../../blocks/InlineCreateButton";
import ChipList from "../../blocks/ChipList";
import type { BbTheme, BbSubtheme, CatalogMinifig, SelectedMinifig } from "@/lib/catalog/types";

export default function BuildingBlocksSection({
  subcategoryId,

  bbThemeId,
  setBbThemeId,
  bbSubthemeId,
  setBbSubthemeId,
  bbSetNumber,
  setBbSetNumber,
  bbPieceCount,
  setBbPieceCount,
  bbRetailCad,
  setBbRetailCad,
  bbRetailUsd,
  setBbRetailUsd,

  bbThemeOptions,
  bbSubthemeOptions,

  onCreateBbTheme,
  onCreateBbSubtheme,

  // minifigs
  minifigQuery,
  setMinifigQuery,
  minifigSearching,
  minifigResults,
  selectedMinifigs,
  onSearchMinifigs,
  onAddMinifig,
  onRemoveMinifig,
  onSetMinifigQty,
  onBumpMinifigQty,
  onOpenCreateMinifig,
}: {
  subcategoryId: string;

  bbThemeId: string;
  setBbThemeId: (v: string) => void;
  bbSubthemeId: string;
  setBbSubthemeId: (v: string) => void;
  bbSetNumber: string;
  setBbSetNumber: (v: string) => void;
  bbPieceCount: string;
  setBbPieceCount: (v: string) => void;
  bbRetailCad: string;
  setBbRetailCad: (v: string) => void;
  bbRetailUsd: string;
  setBbRetailUsd: (v: string) => void;

  bbThemeOptions: BbTheme[];
  bbSubthemeOptions: BbSubtheme[];

  onCreateBbTheme: () => void;
  onCreateBbSubtheme: () => void;

  minifigQuery: string;
  setMinifigQuery: (v: string) => void;
  minifigSearching: boolean;
  minifigResults: CatalogMinifig[];
  selectedMinifigs: SelectedMinifig[];
  onSearchMinifigs: () => void;
  onAddMinifig: (mf: CatalogMinifig) => void;
  onRemoveMinifig: (id: string) => void;
  onSetMinifigQty: (id: string, qty: number) => void;
  onBumpMinifigQty: (id: string, delta: number) => void;
  onOpenCreateMinifig: () => void;
}) {
  const totalMinifigs = selectedMinifigs.reduce((sum, mf) => sum + (mf.qty || 1), 0);

  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold">Building Blocks</h3>
        <span className="text-[11px] text-gray-500">Subcategory = Brand</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel req>Theme</FieldLabel>
            <InlineCreateButton onClick={onCreateBbTheme}>+ New</InlineCreateButton>
          </div>
          <Select
            value={bbThemeId}
            onChange={(e) => {
              setBbThemeId(e.target.value);
              setBbSubthemeId("");
            }}
            disabled={!subcategoryId}
          >
            <option value="">{subcategoryId ? "Select…" : "Select brand first"}</option>
            {bbThemeOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel req>Subtheme</FieldLabel>
            <InlineCreateButton onClick={onCreateBbSubtheme} disabled={!bbThemeId}>
              + New
            </InlineCreateButton>
          </div>
          <Select value={bbSubthemeId} onChange={(e) => setBbSubthemeId(e.target.value)} disabled={!bbThemeId}>
            <option value="">{bbThemeId ? "Select…" : "Select theme first"}</option>
            {bbSubthemeOptions.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <FieldLabel req>Set Number</FieldLabel>
          <TextInput value={bbSetNumber} onChange={(e) => setBbSetNumber(e.target.value)} />
        </div>

        <div className="space-y-1">
          <FieldLabel req>Piece Count</FieldLabel>
          <TextInput value={bbPieceCount} onChange={(e) => setBbPieceCount(e.target.value)} inputMode="numeric" />
        </div>

        <div className="space-y-1">
          <FieldLabel>Retail Price (CAD)</FieldLabel>
          <TextInput
            value={bbRetailCad}
            onChange={(e) => setBbRetailCad(e.target.value)}
            inputMode="decimal"
            placeholder="(optional)"
          />
        </div>

        <div className="space-y-1">
          <FieldLabel>Retail Price (USD)</FieldLabel>
          <TextInput
            value={bbRetailUsd}
            onChange={(e) => setBbRetailUsd(e.target.value)}
            inputMode="decimal"
            placeholder="(optional)"
          />
        </div>
      </div>

      {/* MINIFIGS */}
      <div className="mt-4 rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold">Minifigs (optional)</h4>
          <button type="button" onClick={onOpenCreateMinifig} className="text-[11px] text-blue-600 hover:underline">
            + New Minifig
          </button>
        </div>

        <div className="flex gap-2">
          <TextInput
            value={minifigQuery}
            onChange={(e) => setMinifigQuery(e.target.value)}
            className="flex-1"
            placeholder="Search by fig # or name…"
          />
          <button
            type="button"
            onClick={onSearchMinifigs}
            className="rounded-xl border bg-white px-3 py-2 text-xs"
            disabled={minifigSearching}
          >
            {minifigSearching ? "Searching…" : "Search"}
          </button>
        </div>

        {minifigResults.length > 0 && (
          <div className="mt-3 max-h-44 overflow-y-auto rounded-xl border">
            {minifigResults.map((mf) => (
              <button
                key={mf.id}
                type="button"
                onClick={() => onAddMinifig(mf)} // ✅ now increments qty if already selected
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-md bg-gray-100 overflow-hidden border shrink-0 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {mf.image_url ? (
                    <img src={mf.image_url} alt={mf.name || mf.minifig_number} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-gray-400">N/A</span>
                  )}
                </div>
                <div>
                  <div className="font-semibold">{mf.minifig_number}</div>
                  <div className="text-gray-600">{mf.name}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          <p className="text-[11px] text-gray-500 mb-2">
            Selected minifigs:{" "}
            <span className="font-semibold">
              {selectedMinifigs.length} unique / {totalMinifigs} total
            </span>
          </p>

          <ChipList
            items={selectedMinifigs}
            getKey={(x) => x.id}
            render={(mf) => (
              <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs">
                <span className="font-semibold">{mf.minifig_number}</span>
                <span className="text-gray-600">{mf.name}</span>

                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    className="h-6 w-6 rounded-full border bg-white text-xs"
                    onClick={() => onBumpMinifigQty(mf.id, -1)}
                    title="Decrease"
                  >
                    −
                  </button>

                  <input
                    value={String(mf.qty || 1)}
                    onChange={(e) => onSetMinifigQty(mf.id, Number(e.target.value))}
                    className="h-6 w-10 rounded-md border px-2 text-xs text-center"
                    inputMode="numeric"
                  />

                  <button
                    type="button"
                    className="h-6 w-6 rounded-full border bg-white text-xs"
                    onClick={() => onBumpMinifigQty(mf.id, +1)}
                    title="Increase"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveMinifig(mf.id)}
                  className="text-gray-400 hover:text-red-600 ml-1"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
