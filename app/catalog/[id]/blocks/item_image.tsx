"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PhotoRow = { image_url: string; is_primary: boolean | null; sort_order: number | null };

export default function ItemImage({ catalogItemId, itemName }: { catalogItemId: string; itemName: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!catalogItemId) {
        setUrl(null);
        return;
      }

      // 1) Try catalog_item_photos first (preferred)
      const photoRes = await supabase
        .from("catalog_item_photos")
        .select("image_url,is_primary,sort_order")
        .eq("catalog_item_id", catalogItemId)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(1);

      if (cancelled) return;

      const photoRows = (photoRes.data ?? []) as PhotoRow[];
      const photoUrl = photoRows[0]?.image_url ?? null;

      if (photoUrl) {
        setUrl(photoUrl);
        return;
      }

      // 2) Fallback to catalog_items.image_url (your minifig-style storage)
      const itemRes = await supabase.from("catalog_items").select("image_url").eq("id", catalogItemId).single();

      if (cancelled) return;

      setUrl((itemRes.data as any)?.image_url ?? null);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  return (
    <div className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] p-3 self-start">
      <div className="aspect-square w-full rounded-xl bg-white border border-[#E5E9F2] overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? (
          <img src={url} alt={itemName} className="h-full w-full object-contain" />
        ) : (
          <div className="text-xs text-[#94A3B8]">No image</div>
        )}
      </div>
    </div>
  );
}
