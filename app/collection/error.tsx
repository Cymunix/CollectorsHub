// app/collection/error.tsx
"use client";

import React, { useEffect } from "react";

export default function CollectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Collection route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="text-lg font-semibold text-red-800">Collection crashed</div>
        <div className="mt-2 text-sm text-red-700 whitespace-pre-wrap">
          {error?.message || "Unknown error"}
          {error?.digest ? `\n\nDigest: ${error.digest}` : ""}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90"
          >
            Retry
          </button>

          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Reload
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-600">
          Open DevTools → Console. The real stack trace is logged there.
        </div>
      </div>
    </div>
  );
}
