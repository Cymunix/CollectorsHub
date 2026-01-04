// app/catalog/[id]/blocks/item_description.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatProductionStatus } from "@/lib/catalog/statusFormat";

type Row = {
  id: string;
  description: string | null;
  production_status: string | null;

  genre_name: string | null;
  age_rating_name: string | null;
};

type Props = {
  catalogItemId?: string;
  id?: string;

  // page.tsx passes these; we accept them (even if unused)
  isAdmin?: boolean;
  categoryName?: string | null;
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

export default function ItemDescription(p: Props) {
  const itemId = p.catalogItemId ?? p.id ?? "";

  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrMsg(null);

      // IMPORTANT: no comments in PostgREST select strings
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
        setRow(null);
        setErrMsg(error?.message ?? "Unknown error");
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

  if (!itemId) return <div className="text-sm text-slate-500">Missing item id.</div>;
  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;

  if (!row) {
    return (
      <div className="text-sm text-red-600">
        Failed to load description{errMsg ? `: ${errMsg}` : "."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Meta badges (only when present) */}
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

      {/* Description body — ALWAYS render (no “No description provided.” spam) */}
      <div className="min-h-[120px] rounded-2xl border bg-white p-4">
        {row.description ? (
          <div className="text-sm text-slate-800 whitespace-pre-wrap">{row.description}</div>
        ) : (
          // Keep the block height/shape, but show nothing.
          <div className="text-sm text-slate-500">&nbsp;</div>
        )}
      </div>
    </div>
  );
}
