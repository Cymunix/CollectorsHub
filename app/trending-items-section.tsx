"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type TrendingItem = {
  id: string;
  name: string | null;
  image_url: string | null; // from RPC (may be a full URL OR a storage path)
  category: string | null;
  purchases: number;
};

type TrendingItemUI = TrendingItem & {
  resolved_image_url: string | null; // browser-ready URL
};

export default function TrendingItemsSection({ columns }: { columns: number }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TrendingItemUI[]>([]);

  const wantedCount = useMemo(() => columns * 2, [columns]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase.rpc("get_trending_items_24h", {
        p_limit: wantedCount,
      });

      if (cancelled) return;

      if (error) {
        console.error("Trending RPC error:", error);
        setItems([]);
        setLoading(false);
        return;
      }

      const raw: TrendingItem[] = (data ?? []).map((r: any) => ({
        id: String(r.id),
        name: r.name ?? null,
        image_url: r.image_url ?? null,
        category: r.category ?? null,
        purchases: Number(r.purchases ?? 0),
      }));

      // Resolve image URLs (supports full URLs, public storage, or signed URLs)
      const resolved = await Promise.all(
        raw.map(async (it) => {
          const resolved_image_url = await resolveImageUrl(it.image_url);
          return { ...it, resolved_image_url };
        })
      );

      if (cancelled) return;

      setItems(resolved);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [wantedCount]);

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
          Trending Items
        </h2>
        <button className="text-xs text-[#2563EB] hover:underline">View all</button>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {loading ? (
          Array.from({ length: wantedCount }).map((_, i) => <SkeletonCard key={i} />)
        ) : items.length === 0 ? (
          Array.from({ length: wantedCount }).map((_, i) => <EmptyCard key={i} />)
        ) : (
          items.map((it) => (
            <TrendingCard
              key={it.id}
              id={it.id}
              name={it.name ?? "Unknown item"}
              category={it.category ?? null}
              imageUrl={it.resolved_image_url}
              purchases={it.purchases}
            />
          ))
        )}
      </div>
    </section>
  );
}

/**
 * Turns whatever you store in the DB into a browser-usable image URL.
 * Supports:
 * - Full URLs (http/https) -> returned as-is
 * - "bucket/path/to/file.jpg" -> uses that bucket
 * - "path/to/file.jpg" -> assumes defaultBucket
 */
async function resolveImageUrl(value: string | null): Promise<string | null> {
  if (!value) return null;

  const v = value.trim();
  if (!v) return null;

  // Already a full URL
  if (/^https?:\/\//i.test(v)) return v;

  // Try to parse "bucket/path..."
  const defaultBucket = "item-images";
  const parts = v.split("/").filter(Boolean);

  const bucket = parts.length >= 2 ? parts[0] : defaultBucket;
  const path = parts.length >= 2 ? parts.slice(1).join("/") : v;

  // First try public URL (works if bucket is public)
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (data?.publicUrl) {
      // If the bucket is public, this will load in <img>.
      return data.publicUrl;
    }
  } catch (e) {
    // ignore and try signed url
  }

  // If bucket is private, use a signed URL
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour

    if (!error && data?.signedUrl) return data.signedUrl;
  } catch (e) {
    // ignore
  }

  return null;
}

function TrendingCard({
  id,
  name,
  category,
  imageUrl,
  purchases,
}: {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  purchases: number;
}) {
  return (
    <Link
      href={`/catalog/${id}`}
      className="
        block overflow-hidden rounded-xl bg-white dark:bg-[#111827]
        shadow-sm border border-[#E5E9F2] dark:border-[#1F2937]
        hover:shadow-md transition
      "
    >
      <div className="aspect-[3/4] w-full bg-[#F3F4F6] dark:bg-[#0B1220]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-[#6B7280] dark:text-[#9CA3AF]">
            No image
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="text-sm font-semibold leading-snug line-clamp-2">{name}</div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] line-clamp-1">
            {category ?? "—"}
          </div>
          <div className="text-xs font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
            {purchases} sold
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div
      className="
        animate-pulse overflow-hidden rounded-xl bg-white dark:bg-[#111827]
        shadow-sm border border-[#E5E9F2] dark:border-[#1F2937]
      "
    >
      <div className="aspect-[3/4] bg-[#E5E7EB] dark:bg-[#0B1220]" />
      <div className="p-3 space-y-2">
        <div className="h-3 rounded bg-[#E5E7EB] dark:bg-[#1F2937]" />
        <div className="h-3 w-2/3 rounded bg-[#E5E7EB] dark:bg-[#1F2937]" />
      </div>
    </div>
  );
}

function EmptyCard() {
  return (
    <div
      className="
        overflow-hidden rounded-xl bg-white dark:bg-[#111827]
        shadow-sm border border-[#E5E9F2] dark:border-[#1F2937]
      "
    >
      <div className="aspect-[3/4] flex items-center justify-center text-xs text-[#6B7280] dark:text-[#9CA3AF]">
        No purchases yet
      </div>
    </div>
  );
}
