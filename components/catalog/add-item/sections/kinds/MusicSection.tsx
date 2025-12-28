// components/catalog/add-item/sections/kinds/MusicSection.tsx
"use client";

import React from "react";
import FieldLabel from "../../blocks/FieldLabel";
import Select from "../../blocks/Select";
import InlineCreateButton from "../../blocks/InlineCreateButton";
import type { MusicArtist } from "@/lib/catalog/types";

export default function MusicSection({
  musicArtists,
  musicArtistId,
  setMusicArtistId,
  onCreateMusicArtist,
}: {
  musicArtists: MusicArtist[];
  musicArtistId: string;
  setMusicArtistId: (v: string) => void;
  onCreateMusicArtist: () => void;
}) {
  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold">Music</h3>
        <span className="text-[11px] text-gray-500">Required: Artist, Release Year, Version</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between">
            <FieldLabel req>Artist</FieldLabel>
            <InlineCreateButton onClick={onCreateMusicArtist}>+ New</InlineCreateButton>
          </div>
          <Select value={musicArtistId} onChange={(e) => setMusicArtistId(e.target.value)}>
            <option value="">Select…</option>
            {musicArtists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        <p className="text-[11px] text-gray-500 md:col-span-2">
          Tip: Use “Version” above for format/version (e.g., Vinyl, CD, Deluxe).
        </p>
      </div>
    </div>
  );
}
