"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";

type Props = {
  catalogItemId: string;
  isAdmin?: boolean;
};

type Row = {
  description: string | null;
  production_status: string | null;
  genre_name: string | null;
  age_rating_name: string | null;
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700 font-medium shadow-sm">
      {children}
    </span>
  );
}

export default function ItemDescription({ catalogItemId }: Props) {
  // Initialize with the ID to prevent the "blank" return null check
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!catalogItemId) return;

    async function load() {
      // Step 1: Attempt to get everything
      const { data, error: fetchError } = await supabase
        .from("catalog_items")
        .select(`
          description,
          production_status,
          genre:genres(name),
          age_rating:age_ratings(rating, name)
        `)
        .eq("id", catalogItemId)
        .single();

      if (fetchError) {
        console.error("Fetch error, attempting fallback:", fetchError);
        
        // Step 2: Fallback - Get only the description/status if the joins fail
        const { data: fallbackData } = await supabase
          .from("catalog_items")
          .select("description, production_status")
          .eq("id", catalogItemId)
          .single();

        if (fallbackData) {
          setRow({
            description: fallbackData.description,
            production_status: fallbackData.production_status,
            genre_name: null,
            age_rating_name: null,
          });
        } else {
          setError(true);
        }
        return;
      }

      if (data) {
        const genre = Array.isArray(data.genre) ? data.genre[0] : data.genre;
        const age = Array.isArray(data.age_rating) ? data.age_rating[0] : data.age_rating;

        setRow({
          description: data.description,
          production_status: data.production_status,
          genre_name: genre?.name || null,
          age_rating_name: age?.rating || age?.name || null,
        });
      }
    }

    load();
  }, [catalogItemId]);

  const status = formatProductionStatus(row?.production_status);
  const statusLabel = status?.label && status.label !== "—" ? status.label : "Unknown";

  // Render a skeleton instead of "null" so the area isn't blank while loading
  if (!row && !error) {
    return <div className="h-20 w-full animate-pulse bg-slate-50 rounded-md" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Row: Pills */}
      <div className="flex flex-wrap gap-2">
        <Pill>Production: {statusLabel}</Pill>
        {row?.genre_name && <Pill>Genre: {row.genre_name}</Pill>}
        {row?.age_rating_name && <Pill>Rating: {row.age_rating_name}</Pill>}
      </div>

      {/* Description Body */}
      <div className="min-h-[40px]">
        {row?.description ? (
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {row.description}
          </div>
        ) : (
          <div className="text-sm text-slate-400 font-light">
            No description saved yet.
          </div>
        )}
      </div>
    </div>
  );
}
