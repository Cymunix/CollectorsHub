"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ImgRow = {
  image_url: string;
  sort_order: number | null;
  role?: string | null; // if you use role = 'primary'
  is_primary?: boolean | null; // if you use is_primary
};

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

      /* =========================
         1) Preferred: catalog_item_images
         - Primary first (role or is_primary), then sort_order
         ========================= */

      // Try role-based primary
      const resImagesRole = await supabase
        .from("catalog_item_images")
        .select("image_url, sort_order, role")
        .eq("catalog_item_id", catalogItemId)
        .order("role", { ascending: true }) // NOTE: we’ll handle primary via filter below
        .order("sort_order", { ascending: true })
        .limit(25);

      if (cancelled) return;

      if (!resImagesRole.error) {
        const rows = (resImagesRole.data ?? []) as ImgRow[];

        // Pick primary by role first, else first by sort_order
        const primary =
          rows.find((r) => (r.role ?? "").toLowerCase() === "primary") ??
          rows.find((r) => r.sort_order === 0) ??
          rows[0];

        if (primary?.image_url) {
          setUrl(primary.image_url);
          return;
        }
      }

      // If your table uses is_primary instead of role, try that too
      const resImagesPrimary = await supabase
        .from("catalog_item_images")
        .select("image_url, sort_order, is_primary")
        .eq("catalog_item_id", catalogItemId)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(1);

      if (cancelled) return;

      if (!resImagesPrimary.error) {
        const row = (resImagesPrimary.data ?? [])[0] as ImgRow | undefined;
        if (row?.image_url) {
          setUrl(row.image_url);
          return;
        }
      }

      /* =========================
         2) Legacy: catalog_item_photos
         ========================= */
      const photoRes = await supabase
        .from("catalog_item_photos")
        .select("image_url,is_primary,sort_order")
        .eq("catalog_item_id", catalogItemId)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(1);

      if (cancelled) return;

      const photoUrl = (photoRes.data ?? [])[0]?.image_url ?? null;
      if (photoUrl) {
        setUrl(photoUrl);
        return;
      }

      /* =========================
         3) Final fallback: catalog_items.image_url
         ========================= */
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
