"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ReviewRow = {
  id: string;
  catalog_item_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  verified_owner: boolean;
};

function stars(n: number) {
  const full = "★".repeat(Math.max(0, Math.min(5, n)));
  const empty = "☆".repeat(5 - full.length);
  return full + empty;
}

export default function ItemReviewsTab({ catalogItemId }: { catalogItemId: string }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);

      try {
        const res = await supabase
          .from("catalog_item_reviews")
          .select("id,catalog_item_id,user_id,rating,title,body,created_at,verified_owner")
          .eq("catalog_item_id", catalogItemId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (res.error) throw res.error;

        if (!cancelled) setRows((res.data ?? []) as ReviewRow[]);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setRows([]);
          setErr(e?.message || "Failed to load reviews.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (catalogItemId) load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const avg = useMemo(() => {
    if (!rows.length) return null;
    const sum = rows.reduce((a, r) => a + (Number(r.rating) || 0), 0);
    return Math.round((sum / rows.length) * 10) / 10;
  }, [rows]);

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Reviews</div>
        <div className="text-[11px] text-[#64748B]">
          {rows.length ? `${rows.length} review(s)${avg !== null ? ` • Avg ${avg}/5` : ""}` : ""}
        </div>
      </div>

      <div className="p-4">
        {err ? <div className="mb-3 text-xs text-red-600">{err}</div> : null}
        {loading ? <div className="text-xs text-[#64748B]">Loading…</div> : null}

        {!loading && rows.length === 0 ? (
          <div className="text-xs text-[#64748B]">No reviews yet.</div>
        ) : null}

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#E5E9F2] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[#0F172A]">{stars(r.rating)}</div>
                {r.verified_owner ? (
                  <span className="text-[10px] font-semibold rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5">
                    Verified owner
                  </span>
                ) : null}
              </div>

              {r.title ? <div className="mt-1 text-sm font-semibold text-[#0F172A]">{r.title}</div> : null}
              {r.body ? <div className="mt-1 text-xs text-[#334155] whitespace-pre-wrap">{r.body}</div> : null}

              <div className="mt-2 text-[11px] text-[#64748B]">
                {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
