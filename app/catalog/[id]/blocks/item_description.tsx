"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";

type Props = {
  catalogItemId: string;
  isAdmin?: boolean;
  categoryName?: string | null; // RESTORED: This fixed the build error
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

export default function ItemDescription({ catalogItemId, categoryName }: Props) {
  // Initialize with empty strings instead of null to prevent "blank" flickering
  const [row, setRow] = useState<Row>({
    description: "",
    production_status: null,
    genre_name: null,
    age_rating_name: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!catalogItemId) return;

    async function load() {
      setLoading(true);
      
      // Attempt query with joins
      const { data, error } = await supabase
        .from("catalog_items")
        .select(`
          description,
          production_status,
          genre:genres(name),
          age_rating:age_ratings(rating, name)
        `)
        .eq("id", catalogItemId)
        .single();

      if (error || !data) {
        // Fallback: If joins fail, just get the description
        const { data: simpleData } = await supabase
          .from("catalog_items")
          .select("description, production_status")
          .eq("id", catalogItemId)
          .single();

        if (simpleData) {
          setRow({
            description: simpleData.description,
            production_status: simpleData.production_status,
            genre_name: null,
            age_rating_name: null,
          });
        }
      } else {
        const genre = Array.isArray(data.genre) ? data.genre[0] : data.genre;
        const age = Array.isArray(data.age_rating) ? data.age_rating[0] : data.age_rating;

        setRow({
          description: data.description,
          production_status: data.production_status,
          genre_name: genre?.name || null,
          age_rating_name: age?.rating || age?.name || null,
        });
      }
      setLoading(false);
    }

    load();
  }, [catalogItemId]);

  const status = formatProductionStatus(row.production_status);
  const statusLabel = status?.label && status.label !== "—" ? status.label : "Unknown";

  return (
    <div className="flex flex-col gap-4">
      {/* Top Row: Pills (Matches your screenshot) */}
      <div className="flex flex-wrap gap-2">
        <Pill>Production: {statusLabel}</Pill>
        {row.genre_name && <Pill>Genre: {row.genre_name}</Pill>}
        {row.age_rating_name && <Pill>Rating: {row.age_rating_name}</Pill>}
      </div>

      {/* Description Body */}
      <div className="mt-1">
        {loading ? (
          <div className="h-4 w-3/4 animate-pulse bg-slate-100 rounded" />
        ) : row.description ? (
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {row.description}
          </div>
        ) : (
          <div className="text-sm text-slate-400 font-light italic">
            No description saved yet.
          </div>
        )}
      </div>
    </div>
  );
}
