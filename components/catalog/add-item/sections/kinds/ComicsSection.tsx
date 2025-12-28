// components/catalog/add-item/sections/kinds/ComicsSection.tsx
"use client";

import React from "react";
import FieldLabel from "../../blocks/FieldLabel";
import Select from "../../blocks/Select";
import TextInput from "../../blocks/TextInput";
import InlineCreateButton from "../../blocks/InlineCreateButton";
import type { ComicPublisher } from "@/lib/catalog/types";

export default function ComicsSection({
  comicPublishers,
  comicPublisherId,
  setComicPublisherId,
  comicSeries,
  setComicSeries,
  comicIssueNumber,
  setComicIssueNumber,
  comicVariant,
  setComicVariant,
  onCreateComicPublisher,
}: {
  comicPublishers: ComicPublisher[];
  comicPublisherId: string;
  setComicPublisherId: (v: string) => void;
  comicSeries: string;
  setComicSeries: (v: string) => void;
  comicIssueNumber: string;
  setComicIssueNumber: (v: string) => void;
  comicVariant: string;
  setComicVariant: (v: string) => void;
  onCreateComicPublisher: () => void;
}) {
  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold">Comics</h3>
        <span className="text-[11px] text-gray-500">Required: Publisher, Series, Issue #, Release Year</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between">
            <FieldLabel req>Publisher</FieldLabel>
            <InlineCreateButton onClick={onCreateComicPublisher}>+ New</InlineCreateButton>
          </div>
          <Select value={comicPublisherId} onChange={(e) => setComicPublisherId(e.target.value)}>
            <option value="">Select…</option>
            {comicPublishers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <FieldLabel req>Series</FieldLabel>
          <TextInput value={comicSeries} onChange={(e) => setComicSeries(e.target.value)} placeholder="e.g. Spider-Man" />
        </div>

        <div className="space-y-1">
          <FieldLabel req>Issue #</FieldLabel>
          <TextInput value={comicIssueNumber} onChange={(e) => setComicIssueNumber(e.target.value)} placeholder="e.g. 300" />
        </div>

        <div className="space-y-1 md:col-span-2">
          <FieldLabel>Variant</FieldLabel>
          <TextInput value={comicVariant} onChange={(e) => setComicVariant(e.target.value)} placeholder="(optional)" />
        </div>
      </div>
    </div>
  );
}
