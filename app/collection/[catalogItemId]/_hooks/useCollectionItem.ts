"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CatalogItem = {
  id: string;
  name: string | null;
};

type CollectionCopy = {
  id: string;
  catalog_item_id: string;
  condition_json?: any;
  created_at?: string;
};

type PhotoRow = {
  image_url: string;
  is_primary: boolean | null;
  sort_order: number | null;
};

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

async function resolveStorageUrl(bucket: string, path: string): Promise<string | null> {
  // Works if bucket is public
  const pub = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = pub?.data?.publicUrl ?? null;
  if (publicUrl) return publicUrl;

  // Works if bucket is private and user is authed
  const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (signed.data?.signedUrl) return signed.data.signedUrl;

  return null;
}

async function loadPhotoUrlForCatalogItem(catalogItemId: string): Promise<string | null> {
  // 1) Prefer DB photo table if you have it wired
  const dbRes = await supabase
    .from("catalog_item_photos")
    .select("image_url,is_primary,sort_order")
    .eq("catalog_item_id", catalogItemId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1);

  const rows = (dbRes.data ?? []) as PhotoRow[];
  const first = rows[0]?.image_url?.trim();

  if (first) {
    if (isHttpUrl(first)) return first;

    // Treat as storage path in item-images
    const url = await resolveStorageUrl("item-images", first);
    if (url) return url;
  }

  // 2) Fallback: list files in Storage bucket under catalog-items/<id>/
  const folder = `catalog-items/${catalogItemId}`;

  const listRes = await supabase.storage.from("item-images").list(folder, {
    limit: 50,
    sortBy: { column: "created_at", order: "desc" },
  });

  const files = listRes.data ?? [];
  const firstFile = files.find((f) => !!f.name && !f.name.endsWith("/"));
  if (!firstFile?.name) return null;

  const path = `${folder}/${firstFile.name}`;
  return await resolveStorageUrl("item-images", path);
}

export function useCollectionItem(catalogItemId: string) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [copies, setCopies] = useState<CollectionCopy[]>([]);

  const stats = useMemo(() => {
    const total = copies.length;

    // If you store condition_json.mode, this will work.
    // Otherwise raw/graded will be 0; adjust to your schema as needed.
    let raw = 0;
    let graded = 0;

    for (const c of copies) {
      const mode = (c as any)?.condition_json?.mode;
      if (mode === "graded") graded += 1;
      else if (mode === "raw") raw += 1;
    }

    return { total, raw, graded };
  }, [copies]);

  const load = useCallback(async () => {
    if (!catalogItemId) return;

    setLoading(true);
    setErr(null);

    try {
      // Catalog item
      const itemRes = await supabase
        .from("catalog_items")
        .select("id,name")
        .eq("id", catalogItemId)
        .maybeSingle();

      if (itemRes.error) throw itemRes.error;
      setItem((itemRes.data as any) ?? null);

      // Copies you own for this catalog item
      const copiesRes = await supabase
        .from("user_collection_items")
        .select("id,catalog_item_id,condition_json,created_at")
        .eq("catalog_item_id", catalogItemId)
        .order("created_at", { ascending: false });

      if (copiesRes.error) throw copiesRes.error;
      setCopies((copiesRes.data ?? []) as any);

      // Photo URL (DB -> Storage fallback)
      const p = await loadPhotoUrlForCatalogItem(catalogItemId);
      setPhotoUrl(p);
    } catch (e: any) {
      setErr(e?.message ? String(e.message) : String(e));
      setItem(null);
      setCopies([]);
      setPhotoUrl(null);
    } finally {
      setLoading(false);
    }
  }, [catalogItemId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  return { loading, err, item, photoUrl, copies, stats, refresh };
}
