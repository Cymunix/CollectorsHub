"use client";

import React from "react";

type Row = { id: string; name: string };

export default function GamingSection({
  gamePlatforms,
  gamePublishers,
  gamePlatformId,
  setGamePlatformId,
  gamePublisherId,
  setGamePublisherId,
  onCreatePlatform,
  onCreatePublisher,
}: {
  gamePlatforms: Row[];
  gamePublishers: Row[];
  gamePlatformId: string;
  setGamePlatformId: (v: string) => void;
  gamePublisherId: string;
  setGamePublisherId: (v: string) => void;
  onCreatePlatform?: () => void;
  onCreatePublisher?: () => void;
}) {
  const platformsEmpty = (gamePlatforms?.length ?? 0) === 0;
  const publishersEmpty = (gamePublishers?.length ?? 0) === 0;

  return (
    <section className="mt-6 rounded-2xl border bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[#0F172A]">Gaming Details</h3>
        <p className="mt-0.5 text-xs text-gray-500">Platform is required for video games.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Platform */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">
              Platform <span className="text-red-500">*</span>
            </label>

            {onCreatePlatform ? (
              <button
                type="button"
                onClick={onCreatePlatform}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                + Add platform
              </button>
            ) : null}
          </div>

          <select
            value={gamePlatformId}
            onChange={(e) => setGamePlatformId(e.target.value)}
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="">{platformsEmpty ? "No platforms available" : "Select platform..."}</option>
            {gamePlatforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {platformsEmpty ? (
            <div className="mt-2 text-xs text-gray-500">
              No platforms loaded. Add one (admin) or check RLS/table names.
            </div>
          ) : null}
        </div>

        {/* Publisher */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">Publisher</label>

            {onCreatePublisher ? (
              <button
                type="button"
                onClick={onCreatePublisher}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                + Add publisher
              </button>
            ) : null}
          </div>

          <select
            value={gamePublisherId}
            onChange={(e) => setGamePublisherId(e.target.value)}
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="">{publishersEmpty ? "No publishers available" : "(optional) Select publisher..."}</option>
            {gamePublishers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {publishersEmpty ? (
            <div className="mt-2 text-xs text-gray-500">No publishers loaded. Add one (admin) or check RLS.</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
