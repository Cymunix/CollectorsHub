"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { resolveItemImage, type PhotoRow } from "@/lib/resolveItemImage";

export default function ItemImage({
  catalogItemId,
  itemName,
}: {
  catalogItemId: string;
  itemName: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!catalogItemId) {
        setUrl(null);
        return;
      }

      // 1) Preferred: catalog_item_photos (multiple photos)
      const photosRes = await supabase
        .from("catalog_item_photos")
        .select("image_url,is_primary,sort_order")
        .eq("catalog_item_id", catalogItemId);

      if (cancelled) return;

      const photos = (photosRes.data ?? []) as PhotoRow[];
      const best = resolveItemImage(photos);

      if (best) {
        setUrl(best);
        return;
      }

      // 2) Fallback: catalog_items.image_url (legacy single image)
      const itemRes = await supabase
        .from("catalog_items")
        .select("image_url")
        .eq("id", catalogItemId)
        .single();

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
