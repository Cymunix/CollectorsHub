// components/catalog/add-item/sections/GlobalDetailsSection.tsx
"use client";

import React from "react";
import FieldLabel from "../blocks/FieldLabel";
import TextInput from "../blocks/TextInput";
import type { ItemKind } from "@/lib/catalog/types";

export default function GlobalDetailsSection({
  itemKind,
  catalogName,
  setCatalogName,
  catalogReleaseYear,
  setCatalogReleaseYear,
  catalogUPC,
  setCatalogUPC,
  catalogVersion,
  setCatalogVersion,
}: {
  itemKind: ItemKind;
  catalogName: string;
  setCatalogName: (v: string) => void;
  catalogReleaseYear: string;
  setCatalogReleaseYear: (v: string) => void;
  catalogUPC: string;
  setCatalogUPC: (v: string) => void;
  catalogVersion: string;
  setCatalogVersion: (v: string) => void;
}) {
  const nameLabel =
    itemKind === "building_blocks"
      ? "Set Name"
      : itemKind === "trading_card" || itemKind === "sports_card"
      ? "Card Name"
      : "Item Name";

  return (
    <div className="rounded-2xl border p-4 mb-4">
      <h3 className="text-xs font-semibold mb-3">Item Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1 md:col-span-2">
          <FieldLabel req>{nameLabel}</FieldLabel>
          <TextInput value={catalogName} onChange={(e) => setCatalogName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <FieldLabel req={itemKind !== "building_blocks"}>Release Year</FieldLabel>
          <TextInput
            value={catalogReleaseYear}
            onChange={(e) => setCatalogReleaseYear(e.target.value)}
            inputMode="numeric"
            placeholder={itemKind === "building_blocks" ? "(optional)" : "e.g. 2021"}
          />
        </div>

        <div className="space-y-1">
          <FieldLabel>UPC</FieldLabel>
          <TextInput
            value={catalogUPC}
            onChange={(e) => setCatalogUPC(e.target.value)}
            placeholder="(optional)"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <FieldLabel req={itemKind === "gaming" || itemKind === "music"}>Version</FieldLabel>
          <TextInput
            value={catalogVersion}
            onChange={(e) => setCatalogVersion(e.target.value)}
            placeholder={itemKind === "gaming" ? "Required (e.g., GOTY, Remastered…)" : "(optional)"}
          />
        </div>
      </div>
    </div>
  );
}
