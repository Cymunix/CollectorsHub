// app/catalog/[id]/blocks/item_description.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ItemDescription({ catalogItemId }: { catalogItemId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);

      const res = await supabase
        .from("catalog_item_descriptions")
        .select("description")
        .eq("catalog_item_id", catalogItemId)
        .maybeSingle();

      if (cancelled) return;

      if (res.error) {
        setErr(res.error.message || "Failed to load description.");
        setDescription("");
        setLoading(false);
        return;
      }

      setDescription(String(res.data?.description ?? ""));
      setLoading(false);
    };

    if (catalogItemId) load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Description</div>
      </div>

      <div className="p-4">
        {loading ? <div className="text-sm text-[#64748B]">Loading…</div> : null}
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {!loading && !err ? (
          description.trim().length ? (
            <div className="text-sm text-[#0F172A] whitespace-pre-wrap">{description}</div>
          ) : (
            <div className="text-sm text-[#64748B]">No description saved yet.</div>
          )
        ) : null}
      </div>
    </div>
  );
}
