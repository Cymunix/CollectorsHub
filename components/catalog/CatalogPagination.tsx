"use client";

import React from "react";

export default function CatalogPagination({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  // Hide when useless
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-[11px] text-gray-500">
        Page <span className="font-semibold text-gray-700">{page}</span> of{" "}
        <span className="font-semibold text-gray-700">{totalPages}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage(1)}
          disabled={page === 1}
          className="rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 disabled:opacity-50"
        >
          First
        </button>
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 disabled:opacity-50"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 disabled:opacity-50"
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
          className="rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 disabled:opacity-50"
        >
          Last
        </button>
      </div>
    </div>
  );
}
