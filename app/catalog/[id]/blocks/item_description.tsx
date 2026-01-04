// app/catalog/[id]/blocks/item_description.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CatalogItemRow = {
  id: string;

  description: string | null;

  release_year: number | null;
  release_month: number | null;
  release_day: number | null;

  production_status: string | null;

  end_year: number | null;
  end_month: number | null;
  end_day: number | null;

  // ✅ lookups
  genre?: {
    id: string;
    name: string;
  } | null;

  age_rating?: {
    id: string;
    name: string;
  } | null;
};

type Props = {
  catalogItemId: string;
};

function formatProductionStatus(v: string | null) {
  if (!v) return null;

  switch (v) {
    case "in_production":
      return "In production";
    case "out_of_production":
      return "Out of production";
    case "discontinued":
      return "Discontinued";
    default:
      return v.replace(/_/g, " ");
  }
}

export default function ItemDescription(p: Props) {
  const [row, setRow] = useState<CatalogItemRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("catalog_items")
        .select(
          `
          id,
          description,
          release_year,
          release_month,
          release_day,
          production_status,
          end_year,
          end_month,
          end_day,
          genre:genres(id,name),
          age_rating:age_ratings(id,name)
        `
        )
        .eq("id", p.catalogItemId)
        .single();

      if (!cancelled) {
        if (error) {
          console.error("ItemDescription load error", error);
          setRow(null);
        } else {
          setRow(data as CatalogItemRow);
        }
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [p.catalogItemId]);

  if (loading) {
    return <div className="text-sm text-neutral-500">Loading description…</div>;
  }

  if (!row) {
    return <div className="text-sm text-red-600">Failed to load description.</div>;
  }

  const productionStatus = formatProductionStatus(row.production_status);

  return (
    <div className="space-y-4">
      {/* Metadata row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-700">
        {row.genre?.name ? (
          <div>
            <span className="font-medium">Genre:</span> {row.genre.name}
          </div>
        ) : null}

        {row.age_rating?.name ? (
          <div>
            <span className="font-medium">Age rating:</span> {row.age_rating.name}
          </div>
        ) : null}

        {productionStatus ? (
          <div>
            <span className="font-medium">Production:</span> {productionStatus}
          </div>
        ) : null}
      </div>

      {/* Description */}
      {row.description ? (
        <div className="prose prose-sm max-w-none">
          {row.description}
        </div>
      ) : (
        <div className="text-sm text-neutral-500 italic">
          No description provided.
        </div>
      )}
    </div>
  );
}
