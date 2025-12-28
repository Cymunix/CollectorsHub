"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Meta = { id: string; name: string | null; category_slug?: string | null };

type CopyRow = {
  id: string;
  catalog_item_id: string;
  condition_json: any | null;
  notes?: string | null;
  created_at?: string | null;
};

export default function GenericDetail({ catalogItemId, meta }: { catalogItemId: string; meta: Meta | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copies, setCopies] = useState<CopyRow[]>([]);

  const title = meta?.name?.trim() || "Collection Item";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data?.user?.id;

      if (!userId) {
        setErr("You must be logged in to view this item.");
        setCopies([]);
        setLoading(false);
        return;
      }

      const res = await supabase
        .from("user_collection_items")
        .select("id,catalog_item_id,condition_json,notes,created_at")
        .eq("user_id", userId)
        .eq("catalog_item_id", catalogItemId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (res.error) {
        setErr(res.error.message);
        setCopies([]);
        setLoading(false);
        return;
      }

      setCopies((res.data ?? []) as any);
      setLoading(false);
    }

    if (catalogItemId) load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
        ← Back
      </button>

      <div className="mt-4 rounded-2xl border bg-white p-4">
        <div className="text-lg font-semibold">{title}</div>
        <div className="mt-3 text-sm">
          Copies: <span className="font-semibold">{copies.length}</span>
        </div>

        {loading ? <div className="mt-4 text-sm text-gray-500">Loading…</div> : null}
        {err ? <div className="mt-4 rounded-xl border bg-red-50 p-3 text-sm text-red-700">{err}</div> : null}

        {!loading && !err && copies.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500">No copies found for this item.</div>
        ) : null}

        {!loading && !err && copies.length > 0 ? (
          <div className="mt-4 space-y-3">
            {copies.map((c, i) => (
              <div key={c.id} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Copy #{i + 1}</div>
                  <span className="rounded-full border bg-white px-2 py-1 text-xs text-gray-700">
                    Condition: {c.condition_json ? "saved" : "—"}
                  </span>
                </div>

                {c.notes ? (
                  <div className="mt-3 rounded-xl border bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                    {c.notes}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-gray-400">No notes.</div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
