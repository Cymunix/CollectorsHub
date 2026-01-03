"use client";

import React, { useRef } from "react";

export default function PhotoSection({
  previews,
  onPickFiles,
  onRemoveAt,
  disabled,
}: {
  previews: string[];
  onPickFiles: (files: File[]) => void;
  onRemoveAt: (index: number) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="mt-4 rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#0F172A]">Photos</div>
          <div className="mt-1 text-xs text-[#64748B]">
            Upload multiple photos. The first one becomes the primary image.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!!disabled}
            className="rounded-xl bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-200 disabled:text-gray-600"
          >
            Add Photos
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={!!disabled}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onPickFiles(files);
              // allow selecting the same file again later
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      {/* Previews */}
      <div className="mt-4">
        {previews.length === 0 ? (
          <div className="rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">No photos selected.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {previews.map((src, i) => (
              <div key={src + i} className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-2">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-[#0F172A]">
                    {i === 0 ? "Primary" : `#${i + 1}`}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAt(i)}
                    disabled={!!disabled}
                    className="rounded-lg border px-2 py-1 text-[11px] font-semibold hover:bg-white disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

                <div className="aspect-square w-full overflow-hidden rounded-xl bg-white border border-[#E5E9F2] flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`photo ${i + 1}`} className="h-full w-full object-contain" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previews.length > 1 ? (
        <div className="mt-3 text-[11px] text-[#64748B]">
          Ordering: right now it’s the order you picked them. (We can add drag-reorder next.)
        </div>
      ) : null}
    </div>
  );
}
