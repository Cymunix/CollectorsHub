// components/catalog/add-item/sections/kinds/GamingSection.tsx
"use client";

import React from "react";
import FieldLabel from "../../blocks/FieldLabel";
import Select from "../../blocks/Select";
import InlineCreateButton from "../../blocks/InlineCreateButton";
import type { GamePlatform, GamePublisher } from "@/lib/catalog/types";

export default function GamingSection({
  gamePlatforms,
  gamePublishers,
  gamePlatformId,
  setGamePlatformId,
  gamePublisherId,
  setGamePublisherId,
  onCreateGamePlatform,
  onCreateGamePublisher,
}: {
  gamePlatforms: GamePlatform[];
  gamePublishers: GamePublisher[];
  gamePlatformId: string;
  setGamePlatformId: (v: string) => void;
  gamePublisherId: string;
  setGamePublisherId: (v: string) => void;
  onCreateGamePlatform: () => void;
  onCreateGamePublisher: () => void;
}) {
  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold">Gaming</h3>
        <span className="text-[11px] text-gray-500">Required: Platform, Release Year, Version</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel req>Platform</FieldLabel>
            <InlineCreateButton onClick={onCreateGamePlatform}>+ New</InlineCreateButton>
          </div>
          <Select value={gamePlatformId} onChange={(e) => setGamePlatformId(e.target.value)}>
            <option value="">Select…</option>
            {gamePlatforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel>Publisher</FieldLabel>
            <InlineCreateButton onClick={onCreateGamePublisher}>+ New</InlineCreateButton>
          </div>
          <Select value={gamePublisherId} onChange={(e) => setGamePublisherId(e.target.value)}>
            <option value="">(optional)</option>
            {gamePublishers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
