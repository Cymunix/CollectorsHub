"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Minifig = { id: string; name: string | null; minifig_number: string | null; image_url: string | null };
type LinkRow = {
  id: string;
  user_collection_item_id: string;
  included: boolean;
  included_qty: number;
  created_at: string;
};

export default function Page() {
  const router = useRouter();
  const params = useParams();
  const minifigId = String((params as any)?.minifigId ?? "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [minifig, setMinifig] = useState<Minifig | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!minifigId) return;

      setLoading(true);
      setErr(null);

      try {
        const auth = await supabase.auth.getUser();
        if (!auth.data.user) throw new Error("Not signed in.");

        const mRes = await supabase
          .from("catalog_minifigs")
          .select("id,name,minifig_number,image_url")
          .eq("id", minifigId)
          .maybeSingle();

        if (mRes.error) throw mRes.error;

        const lRes = await supabase
          .from("user_collection_item_minifigs")
          .select("id,user_collection_item_id,included,included_qty,created_at")
          .eq("minifig_id", minifigId)
          .order("created_at", { ascending: false });

        if (lRes.error) throw lRes.error;

        if (cancelled) return;
        setMinifig((mRes.data as any) ?? null);
        setLinks((lRes.data ?? []) as any);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setErr(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [minifigId]);

  const label = minifig?.name?.trim() || "Unknown minifig";

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => router.push("/collection")}
          >
            ← Back to Collection
          </button>
          <div className="text-lg font-semibold">Minifig</div>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">Loading…</div>
        ) : err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{err}</div>
        ) : (
          <>
            <div className="rounded-2xl border bg-white p-5 flex items-center gap-4">
              <div className="h-20 w-20 rounded-2xl border bg-gray-50 overflow-hidden flex items-center justify-center">
                {minifig?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={minifig.image_url} alt={label} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400">No photo</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{label}</div>
                <div className="text-sm text-gray-500">
                  {minifig?.minifig_number ? `#${minifig.minifig_number}` : "No number"}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5">
              <div className="text-sm font-semibold">Included in these copies</div>
              <div className="mt-3 space-y-2">
                {links.length === 0 ? (
                  <div className="text-sm text-gray-600">No copies linked.</div>
                ) : (
                  links.map((r) => (
                    <div key={r.id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3">
                      <div className="text-sm">
                        Copy ID: <span className="font-mono text-xs">{r.user_collection_item_id}</span>
                      </div>
                      <div className="text-sm text-gray-700">
                        {r.included ? "Included" : "Not included"} · Qty {Number(r.included_qty ?? 0)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
