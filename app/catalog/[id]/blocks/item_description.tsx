// app/catalog/[id]/blocks/item_description.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";

type Lookup = { id: string; name: string };

type Row = {
  id: string;

  description: string | null;

  release_year: number | null;
  release_month: number | null;
  release_day: number | null;

  production_status: string | null;

  end_year: number | null;
  end_month: number | null;
  end_day: number | null;

  // ✅ normalised display fields
  genre_name: string | null;
  age_rating_name: string | null;
};

type Props = {
  catalogItemId?: string;
  id?: string; // allow either prop name (defensive)
};

function pickLookup(v: any): Lookup | null {
  if (!v) return null;
  if (Array.isArray(v)) {
    const first = v[0];
    if (!first) return null;
    return {
      id: String(first.id ?? ""),
      name: String(first.name ?? ""),
    };
  }
  // object form
  return {
    id: String(v.id ?? ""),
    name: String(v.name ?? ""),
  };
}

function toIntOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export default function ItemDescription(p: Props) {
  const itemId = p.catalogItemId ?? p.id ?? "";

  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!itemId) return;

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

          -- These embeds may come back as OBJECT or ARRAY depending on relationship config:
          genre:genres(id,name),
          age_rating:age_ratings(id,name)
        `
        )
        .eq("id", itemId)
        .single();

      if (cancelled) return;

      if (error || !data) {
        console.error("item_description load error", error);
        setRow(null);
        setLoading(false);
        return;
      }

      const g = pickLookup((data as any).genre);
      const a = pickLookup((data as any).age_rating);

      const normalised: Row = {
        id: String((data as any).id),

        description: (data as any).description ?? null,

        release_year: toIntOrNull((data as any).release_year),
        release_month: toIntOrNull((data as any).release_month),
        release_day: toIntOrNull((data as any).release_day),

        production_status: (data as any).production_status ?? null,

        end_year: toIntOrNull((data as any).end_year),
        end_month: toIntOrNull((data as any).end_month),
        end_day: toIntOrNull((data as any).end_day),

        genre_name: g?.name?.trim() ? g.name : null,
        age_rating_name: a?.name?.trim() ? a.name : null,
      };

      setRow(normalised);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const prod = useMemo(() => formatProductionStatus(row?.production_status ?? null), [row?.production_status]);

  if (!itemId) {
    return <div className="text-sm text-slate-500">Missing item id.</div>;
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  if (!row) {
    return <div className="text-sm text-red-600">Failed to load description.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Meta badges */}
      <div className="flex flex-wrap gap-2">
        {row.genre_name ? (
          <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700">
            Genre: {row.genre_name}
          </span>
        ) : null}

        {row.age_rating_name ? (
          <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700">
            Age rating: {row.age_rating_name}
          </span>
        ) : null}

        {prod?.label && prod.label !== "—" ? (
          <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700">
            Production: {prod.label}
          </span>
        ) : null}
      </div>

      {/* Description */}
      {row.description ? (
        <div className="text-sm text-slate-800 whitespace-pre-wrap">{row.description}</div>
      ) : (
        <div className="text-sm text-slate-500 italic">No description provided.</div>
      )}
    </div>
  );
}
