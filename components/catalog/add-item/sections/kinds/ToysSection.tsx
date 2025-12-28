// components/catalog/add-item/sections/kinds/ToysSection.tsx
"use client";

import React from "react";
import FieldLabel from "../../blocks/FieldLabel";
import Select from "../../blocks/Select";
import TextInput from "../../blocks/TextInput";
import InlineCreateButton from "../../blocks/InlineCreateButton";
import type { ToyManufacturer, ToyBrand, ToyLine } from "@/lib/catalog/types";

export default function ToysSection({
  toyManufacturers,
  toyBrandOptions,
  toyLineOptions,

  toyManufacturerId,
  setToyManufacturerId,
  toyBrandId,
  setToyBrandId,
  toyLineId,
  setToyLineId,
  toyModelNumber,
  setToyModelNumber,

  onCreateToyManufacturer,
  onCreateToyBrand,
  onCreateToyLine,
}: {
  toyManufacturers: ToyManufacturer[];
  toyBrandOptions: ToyBrand[];
  toyLineOptions: ToyLine[];

  toyManufacturerId: string;
  setToyManufacturerId: (v: string) => void;
  toyBrandId: string;
  setToyBrandId: (v: string) => void;
  toyLineId: string;
  setToyLineId: (v: string) => void;
  toyModelNumber: string;
  setToyModelNumber: (v: string) => void;

  onCreateToyManufacturer: () => void;
  onCreateToyBrand: () => void;
  onCreateToyLine: () => void;
}) {
  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold">Toys</h3>
        <span className="text-[11px] text-gray-500">Required: Manufacturer, Brand, Line, Release Year</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel req>Manufacturer</FieldLabel>
            <InlineCreateButton onClick={onCreateToyManufacturer}>+ New</InlineCreateButton>
          </div>
          <Select
            value={toyManufacturerId}
            onChange={(e) => {
              setToyManufacturerId(e.target.value);
              setToyBrandId("");
              setToyLineId("");
            }}
          >
            <option value="">Select…</option>
            {toyManufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel req>Brand</FieldLabel>
            <InlineCreateButton onClick={onCreateToyBrand} disabled={!toyManufacturerId}>
              + New
            </InlineCreateButton>
          </div>
          <Select
            value={toyBrandId}
            onChange={(e) => {
              setToyBrandId(e.target.value);
              setToyLineId("");
            }}
            disabled={!toyManufacturerId}
          >
            <option value="">{toyManufacturerId ? "Select…" : "Select manufacturer first"}</option>
            {toyBrandOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel req>Line</FieldLabel>
            <InlineCreateButton onClick={onCreateToyLine} disabled={!toyBrandId}>
              + New
            </InlineCreateButton>
          </div>
          <Select value={toyLineId} onChange={(e) => setToyLineId(e.target.value)} disabled={!toyBrandId}>
            <option value="">{toyBrandId ? "Select…" : "Select brand first"}</option>
            {toyLineOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <FieldLabel>Model Number</FieldLabel>
          <TextInput
            value={toyModelNumber}
            onChange={(e) => setToyModelNumber(e.target.value)}
            placeholder="(optional)"
          />
        </div>
      </div>
    </div>
  );
}
