"use client";

import React from "react";

export default function MinifigsScreen() {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold text-gray-900">Minifigs</div>
        <p className="mt-1 text-sm text-gray-600">
          This tab is being rebuilt.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">What it will do</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>Show every minifig you own across your collection.</li>
              <li>Track included quantity per minifig.</li>
              <li>Filters: search, owned only, include/exclude sets.</li>
            </ul>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Why it’s disabled</div>
            <p className="mt-2 text-sm text-gray-700">
              The current version was causing the page to get stuck on a loading state.
              This placeholder keeps Collection stable while we refactor the data loading + UX.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border bg-white p-4">
          <div className="text-sm font-semibold text-gray-900">Next steps</div>
          <ol className="mt-2 list-decimal pl-5 text-sm text-gray-700 space-y-1">
            <li>Confirm the exact Supabase relationships for joins (minifigs → copies → catalog items).</li>
            <li>Rebuild loader with explicit timeouts + visible errors.</li>
            <li>Re-enable this tab.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
