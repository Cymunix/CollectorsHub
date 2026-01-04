"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";

type Props = {
  catalogItemId: string;
  isAdmin?: boolean;
  categoryName?: string | null;
};

type Row = {
  description: string | null;
  production_status: string | null;
  genre_name: string | null;
  age_rating_name: string | null;
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700 font-medium">
      {children}
    </span>
  );
}

export default function ItemDescription({ catalogItemId }: Props) {
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    if (!catalogItemId) return;

    async function load() {
      // Fetch core data and joined data in one go
      // Note: Ensure your foreign keys in Supabase match these names exactly
      const { data, error } = await supabase
        .from("catalog_items")
        .select(`
          description,
          production_status,
          genre:genres(name),
          age_rating:age_ratings(name, rating)
        `)
        .eq("id", catalogItemId)
        .single();

      if (error || !data) {
        console.error("Error loading description:", error);
        return;
      }

      // Handle potential array vs object returns from Supabase joins
      const genre = Array.isArray(data.genre) ? data.genre[0] : data.genre;
      const age = Array.isArray(data.age_rating) ? data.age_rating[0] : data.age_rating;

      setRow({
        description: data.description,
        production_status: data.production_status,
        genre_name: genre?.name || null,
        age_rating_name: age?.rating || age?.name || null,
      });
    }

    load();
  }, [catalogItemId]);

  if (!row) return <div className="animate-pulse h-12 bg-slate-50 rounded" />;

  const status = formatProductionStatus(row.production_status);
  const statusLabel = status?.label && status.label !== "—" ? status.label : "Unknown";

  return (
    <div className="flex flex-col gap-3">
      {/* Top Row: Combined Pills */}
      <div className="flex flex-wrap gap-2">
        <Pill>Production: {statusLabel}</Pill>
        {row.genre_name && <Pill>Genre: {row.genre_name}</Pill>}
        {row.age_rating_name && <Pill>Rating: {row.age_rating_name}</Pill>}
      </div>

      {/* Description Body */}
      {row.description ? (
        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
          {row.description}
        </div>
      ) : (
        <div className="text-sm text-slate-400 italic">No description saved yet.</div>
      )}
    </div>
  );
}
