// components/catalog/add-item/modals/CreateMinifigModal.tsx
"use client";

import React from "react";
import FieldLabel from "../blocks/FieldLabel";
import TextInput from "../blocks/TextInput";

export default function CreateMinifigModal({
  open,
  creating,
  onClose,
  newMinifigNumber,
  setNewMinifigNumber,
  newMinifigName,
  setNewMinifigName,
  newMinifigImagePreview,
  onPickImage,
  onCreate,
}: {
  open: boolean;
  creating: boolean;
  onClose: () => void;

  newMinifigNumber: string;
  setNewMinifigNumber: (v: string) => void;
  newMinifigName: string;
  setNewMinifigName: (v: string) => void;

  newMinifigImagePreview: string | null;
  onPickImage: (file: File | null) => void;

  onCreate: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white border shadow-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Create Minifig</h3>
          <button type="button" onClick={onClose} className="text-sm text-gray-500" disabled={creating}>
            ✕
          </button>
        </div>

        <p className="text-[11px] text-gray-500 mb-3">Requires: fig #, name, image.</p>

        <div className="grid grid-cols-1 gap-3 text-xs">
          <div className="space-y-1">
            <FieldLabel req>Fig #</FieldLabel>
            <TextInput
              value={newMinifigNumber}
              onChange={(e) => setNewMinifigNumber(e.target.value)}
              placeholder="e.g. sw1234"
            />
          </div>

          <div className="space-y-1">
            <FieldLabel req>Name</FieldLabel>
            <TextInput
              value={newMinifigName}
              onChange={(e) => setNewMinifigName(e.target.value)}
              placeholder="e.g. Darth Vader"
            />
          </div>

          <div className="space-y-1">
            <FieldLabel req>Image</FieldLabel>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-lg bg-gray-100 overflow-hidden border flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {newMinifigImagePreview ? (
                  <img src={newMinifigImagePreview} alt="Minifig preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-gray-400">No image</span>
                )}
              </div>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-4 py-2 text-xs text-gray-600"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="rounded-full bg-green-500 px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
            disabled={creating}
          >
            {creating ? "Creating…" : "Create Minifig"}
          </button>
        </div>
      </div>
    </div>
  );
}
