// app/catalog/[id]/blocks/item_description.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";

type Props = {
  catalogItemId: string;

  // page.tsx passes these; accept them so TS doesn’t complain
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

function toStrOrNull(v: any): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function pickFirstEmbed(v: any): any | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function pickDisplayName(obj: any): string | null {
  if (!obj) return null;

  // Don’t assume column names. Use whatever exists.
  return (
    toStrOrNull(obj.name) ??
    toStrOrNull(obj.label) ??
    toStrOrNull(obj.title) ??
    toStrOrNull(obj.rating) ??
    toStrOrNull(obj.code) ??
    toStrOrNull(obj.slug) ??
    null
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700">
      {children}
    </span>
  );
}

export default function ItemDescription(p: Props) {
  const itemId = p.catalogItemId;

  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);

      const select = `
        id,
        description,
        production_status,
        genre:genres(*),
        age_rating:age_ratings(*)
      `;

      const { data, error } = await supabase.from("catalog_items").select(select).eq("id", itemId).single();

      if (cancelled) return;

      if (error || !data) {
        console.error("ItemDescription load error:", error);
        setRow(null);
        setLoading(false);
        return;
      }

      const genreObj = pickFirstEmbed((data as any).genre);
      const ageObj = pickFirstEmbed((data as any).age_rating);

      setRow({
        id: String((data as any).id),
        description: (data as any).description ?? null,
        production_status: (data as any).production_status ?? null,
        genre_name: pickDisplayName(genreObj),
        age_rating_name: pickDisplayName(ageObj),
      });

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const prod = useMemo(() => formatProductionStatus(row?.production_status ?? null), [row?.production_status]);

  if (loading) return null;
  if (!row) return null;

  return (
    <div>
      {/* Top row pills: Production + Genre + Age rating */}
      <div className="flex flex-wrap gap-2">
        {prod?.label && prod.label !== "—" ? <Pill>Production: {prod.label}</Pill> : null}
        {row.genre_name ? <Pill>Genre: {row.genre_name}</Pill> : null}
        {row.age_rating_name ? <Pill>Age rating: {row.age_rating_name}</Pill> : null}
      </div>

      {/* Body: only render description when it exists. NO empty-state message. */}
      {row.description ? (
        <div className="mt-3 text-sm text-slate-800 whitespace-pre-wrap">{row.description}</div>
      ) : (
        // Keep spacing so the section still “exists” visually, without showing any text.
        <div className="mt-3" />
      )}
    </div>
  );
}
