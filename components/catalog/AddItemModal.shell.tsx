// components/catalog/add-item/AddItemModal.shell.tsx
"use client";

import React from "react";

export default function AddItemModalShell({
  open,
  title = "Create Catalog Item",
  saving,
  banner,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title?: string;
  saving: boolean;
  banner: { type: "error" | "success"; msg: string } | null;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white border shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{title}</h2>
            <p className="text-[11px] text-gray-500">
              Creates a catalog item (global). Not adding to a user collection.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {banner && (
          <div
            className={`px-4 py-2 text-xs border-b ${
              banner.type === "error"
                ? "bg-red-50 text-red-700 border-red-100"
                : "bg-green-50 text-green-700 border-green-100"
            }`}
          >
            {banner.msg}
          </div>
        )}

        <div className="max-h-[80vh] overflow-y-auto p-4">{children}</div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border px-4 py-2 text-xs text-gray-600 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-full bg-green-500 px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
