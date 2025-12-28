// components/catalog/add-item/sections/PhotoSection.tsx
"use client";

import React from "react";

export default function PhotoSection({
  itemImagePreview,
  onPick,
}: {
  itemImagePreview: string | null;
  onPick: (file: File | null) => void;
}) {
  return (
    <div className="rounded-xl border p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold">Photo</h3>
        <span className="text-[11px] text-gray-500">required</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {itemImagePreview ? (
            <img src={itemImagePreview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-gray-400 text-center px-1">No image</span>
          )}
        </div>

        <div className="flex-1">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            className="w-full text-xs"
          />
          {itemImagePreview && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="mt-1 text-[11px] text-red-600 hover:underline"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
