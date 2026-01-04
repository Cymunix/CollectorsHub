// app/catalog/[id]/blocks/item_description.tsx
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
  const itemId = p.catalogItemId;

  const [row, setRow] = useState<Row>({
    id: itemId,
    description: null,
    production_status: null,
    genre_name: null,
    age_rating_name: null,
  });

  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;

    async function load() {
      // 1) Try with joins (Genre + Age)
      const selectWithJoins = `
        id,
        description,
        production_status,
        genre:genres(*),
        age_rating:age_ratings(*)
      `;

      const r1 = await supabase.from("catalog_items").select(selectWithJoins).eq("id", itemId).single();

      if (cancelled) return;

      if (!r1.error && r1.data) {
        const genreObj = pickFirstEmbed((r1.data as any).genre);
        const ageObj = pickFirstEmbed((r1.data as any).age_rating);

        setRow({
          id: String((r1.data as any).id),
          description: (r1.data as any).description ?? null,
          production_status: (r1.data as any).production_status ?? null,
          genre_name: pickDisplayName(genreObj),
          age_rating_name: pickDisplayName(ageObj),
        });
        return;
      }

      // 2) Fallback: base fields only (so the block never goes blank)
      const selectBase = `
        id,
        description,
        production_status
      `;

      const r2 = await supabase.from("catalog_items").select(selectBase).eq("id", itemId).single();

      if (cancelled) return;

      if (r2.error || !r2.data) {
        console.error("ItemDescription load failed:", r1.error ?? r2.error);
        // keep whatever we already had (don’t blank the UI)
        return;
      }

      setRow({
        id: String((r2.data as any).id),
        description: (r2.data as any).description ?? null,
        production_status: (r2.data as any).production_status ?? null,
        genre_name: null,
        age_rating_name: null,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const prod = useMemo(() => formatProductionStatus(row.production_status), [row.production_status]);
  const prodLabel = prod?.label && prod.label !== "—" ? prod.label : "Status unknown";

  return (
    <div>
      {/* Top row pills (matches your screenshot style) */}
      <div className="flex flex-wrap gap-2">
        <Pill>Production: {prodLabel}</Pill>
        {row.genre_name ? <Pill>Genre: {row.genre_name}</Pill> : null}
        {row.age_rating_name ? <Pill>Age rating: {row.age_rating_name}</Pill> : null}
      </div>

      {/* Body: render description only if it exists. No empty-state message. */}
      {row.description ? (
        <div className="mt-3 text-sm text-slate-800 whitespace-pre-wrap">{row.description}</div>
      ) : (
        <div className="mt-3" />
      )}
    </div>
  );
}
