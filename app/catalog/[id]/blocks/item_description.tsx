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

type BaseRow = {
  id: string;
  description: string | null;
  production_status: string | null;
  genre_id: string | null;
  age_rating_id: string | null;
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

  const [base, setBase] = useState<BaseRow>({
    id: itemId,
    description: null,
    production_status: null,
    genre_id: null,
    age_rating_id: null,
  });

  const [genreName, setGenreName] = useState<string | null>(null);
  const [ageRatingName, setAgeRatingName] = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;

    async function load() {
      setLoaded(false);

      // 1) Always load the base item fields (this is what was “working before”)
      const { data, error } = await supabase
        .from("catalog_items")
        .select("id, description, production_status, genre_id, age_rating_id")
        .eq("id", itemId)
        .single();

      if (cancelled) return;

      if (error || !data) {
        console.error("ItemDescription base load error:", error);
        // Don’t blank the UI; just mark as loaded and keep defaults.
        setLoaded(true);
        return;
      }

      const nextBase: BaseRow = {
        id: String((data as any).id),
        description: (data as any).description ?? null,
        production_status: (data as any).production_status ?? null,
        genre_id: (data as any).genre_id ? String((data as any).genre_id) : null,
        age_rating_id: (data as any).age_rating_id ? String((data as any).age_rating_id) : null,
      };

      setBase(nextBase);

      // reset names before lookup
      setGenreName(null);
      setAgeRatingName(null);

      // 2) Look up Genre name (no joins)
      if (nextBase.genre_id) {
        const rG = await supabase.from("genres").select("*").eq("id", nextBase.genre_id).single();
        if (!cancelled && !rG.error && rG.data) {
          setGenreName(pickDisplayName(rG.data));
        }
      }

      // 3) Look up Age rating name (no joins)
      if (nextBase.age_rating_id) {
        const rA = await supabase.from("age_ratings").select("*").eq("id", nextBase.age_rating_id).single();
        if (!cancelled && !rA.error && rA.data) {
          setAgeRatingName(pickDisplayName(rA.data));
        }
      }

      if (!cancelled) setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const prod = useMemo(() => formatProductionStatus(base.production_status), [base.production_status]);
  const prodLabel = prod?.label && prod.label !== "—" ? prod.label : "Status unknown";

  // IMPORTANT: never return null — the block should always “exist”
  return (
    <div>
      {/* Top row pills: keep your original Production pill + add Genre/Age rating */}
      <div className="flex flex-wrap gap-2">
        <Pill>Production: {prodLabel}</Pill>
        {genreName ? <Pill>Genre: {genreName}</Pill> : null}
        {ageRatingName ? <Pill>Age rating: {ageRatingName}</Pill> : null}
      </div>

      {/* Description: show exactly like before (only if it exists). No empty-state message. */}
      {base.description ? (
        <div className="mt-3 text-sm text-slate-800 whitespace-pre-wrap">{base.description}</div>
      ) : (
        <div className="mt-3" />
      )}

      {/* Optional: keep layout stable while loading without adding new UI */}
      {!loaded ? <div className="sr-only">Loading</div> : null}
    </div>
  );
}
