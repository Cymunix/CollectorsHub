"use client";

import { useState } from "react";
import { searchVariantFamilies, type VariantFamily } from "@/lib/catalog/variantSearch";

export default function VariantSearchBox({
  onSelectFamily,
}: {
  onSelectFamily: (family: VariantFamily) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantFamily[]>([]);
  const [loading, setLoading] = useState(false);

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await searchVariantFamilies(query);
      setResults(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder="Search by UPC or name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
        />
        <button
          onClick={runSearch}
          className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </div>

      {loading && <div className="text-xs text-gray-500">Searching…</div>}

      <div className="space-y-1">
        {results.map((family, idx) => (
          <button
            key={idx}
            onClick={() => onSelectFamily(family)}
            className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
          >
            <div className="font-medium">
              {family.items[0]?.name ?? "Unnamed item"}
            </div>
            <div className="text-xs text-gray-500">
              {family.items.length} variant{family.items.length !== 1 ? "s" : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
