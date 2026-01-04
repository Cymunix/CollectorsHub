"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";

type Props = {
  catalogItemId: string;
  isAdmin?: boolean;
  categoryName?: string | null;
};

type Row = {
  id: string;
  description: string | null;
  production_status: string | null;
  genre_name: string | null;
  age_rating_name: string | null;
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700">
      {children}
    </span>
  );
}

export default function ItemDescription({ catalogItemId }: Props) {
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!catalogItemId) return;

    let isMounted = true;

    async function loadData() {
      setLoading(true);
      
      // We use a single query but make the joins flexible. 
      // Note: check your Supabase table names. If 'genres' or 'age_ratings' 
      // are wrong, this query will fail.
      const { data, error } = await supabase
        .from("catalog_items")
        .select(`
          id,
          description,
          production_status,
          genre:genres(name),
          age_rating:age_ratings(name, rating, label)
        `)
        .eq("id", catalogItemId)
        .single();

      if (!isMounted) return;

      if (error) {
        console.error("Supabase Error:", error.message);
        // If the join fails, try one more time without joins to get the description
        const { data: fallbackData } = await supabase
          .from("catalog_items")
          .select("id, description, production_status")
          .eq("id", catalogItemId)
          .single();
        
        if (fallbackData) {
          setRow({
            id: String(fallbackData.id),
            description: fallbackData.description,
            production_status: fallbackData.production_status,
            genre_name: null,
            age_rating_name: null,
          });
        }
      } else if (data) {
        // Extract names safely from joined objects or arrays
        const genreData = Array.isArray(data.genre) ? data.genre[0] : data.genre;
        const ageData = Array.isArray(data.age_rating) ? data.age_rating[0] : data.age_rating;

        setRow({
          id: String(data.id),
          description: data.description,
          production_status: data.production_status,
          genre_name: genreData?.name || null,
          age_rating_name: ageData?.rating || ageData?.name || ageData?.label || null,
        });
      }
      setLoading(false);
    }

    loadData();
    return () => { isMounted = false; };
  }, [catalogItemId]);

  const prod = useMemo(() => formatProductionStatus(row?.production_status), [row?.production_status]);
  const prodLabel = prod?.label && prod.label !== "—" ? prod.label : "Status unknown";

  if (loading && !row) return <div className="animate-pulse h-20 bg-slate-50 rounded-lg" />;
  if (!row) return null;

  return (
    <div className="space-y-3">
      {/* Top row pills */}
      <div className="flex flex-wrap gap-2">
        <Pill>Production: {prodLabel}</Pill>
        {row.genre_name && <Pill>Genre: {row.genre_name}</Pill>}
        {row.age_rating_name && <Pill>Age rating: {row.age_rating_name}</Pill>}
      </div>

      {/* Body */}
      {row.description ? (
        <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
          {row.description}
        </div>
      ) : (
        <div className="text-sm text-slate-400 italic">No description available.</div>
      )}
    </div>
  );
}
