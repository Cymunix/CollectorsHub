"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Meta = {
  id: string;
  name: string | null;
  kind?: string | null;
  category_slug?: string | null;
};

type PhotoRow = { image_url: string; is_primary: boolean | null; sort_order: number | null };

// NOTE: we only select "safe" columns here to avoid schema-cache errors.
// If your table has more columns you want displayed, add them later.
type CopyRow = {
  id: string;
  catalog_item_id: string;
  condition_json: any | null;
  notes?: string | null;
  created_at?: string | null;
};

function ConditionPill({ conditionJson }: { conditionJson: any }) {
  const text = useMemo(() => {
    if (!conditionJson) return "Condition: —";

    // Try a few common shapes
    const graded = conditionJson?.graded || conditionJson?.grading || conditionJson?.slab;
    if (graded?.company || graded?.grade) {
      const company = graded.company ? String(graded.company) : "";
      const grade = graded.grade ? String(graded.grade) : "";
      const bits = [company, grade].filter(Boolean).join(" ");
      return bits ? `Graded: ${bits}` : "Graded";
    }

    const rawScore =
      conditionJson?.raw?.score ??
      conditionJson?.condition?.score ??
      conditionJson?.score ??
      conditionJson?.minifig?.score;

    if (typeof rawScore === "number") return `Condition: ${rawScore}/10`;

    // fallback: if it’s an object, avoid dumping full JSON in UI
    if (typeof conditionJson === "object") return "Condition: (saved)";
    return "Condition: —";
  }, [conditionJson]);

  return <span className="rounded-full border bg-white px-2 py-1 text-xs text-gray-700">{text}</span>;
}

function CopyCard({ copy, idx }: { copy: CopyRow; idx: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Copy #{idx + 1}</div>
        <ConditionPill conditionJson={copy.condition_json} />
      </div>

      <div className="mt-3 text-xs text-gray-500">
        ID: <span className="font-mono">{copy.id}</span>
      </div>

      {copy.notes ? (
        <div className="mt-3 rounded-xl border bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
          {copy.notes}
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-400">No notes.</div>
      )}
    </div>
  );
}

function ItemHeroImage({ catalogItemId, title }: { catalogItemId: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await supabase
        .from("catalog_item_photos")
        .select("image_url,is_primary,sort_order")
        .eq("catalog_item_id", catalogItemId)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(1);

      if (cancelled) return;

      const rows = (res.data ?? []) as PhotoRow[];
      setUrl(rows[0]?.image_url ?? null);
    }

    if (catalogItemId) load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="aspect-[16/9] w-full bg-gray-50 flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="h-full w-full object-contain" />
        ) : (
          <div className="text-sm text-gray-400">No photo</div>
        )}
      </div>
    </div>
  );
}

export default function MinifigDetail({ catalogItemId, meta }: { catalogItemId: string; meta: Meta | null }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copies, setCopies] = useState<CopyRow[]>([]);

  const title = meta?.name?.trim() || "Minifig";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data?.user?.id;

      if (!userId) {
        setErr("You must be logged in to view your collection item.");
        setCopies([]);
        setLoading(false);
        return;
      }

      // Safe select. If you know notes exists, keep it; otherwise remove it.
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

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ItemHeroImage catalogItemId={catalogItemId} title={title} />
          <div className="mt-4 rounded-2xl border bg-white p-4">
            <div className="text-lg font-semibold">{title}</div>
            <div className="mt-1 text-sm text-gray-500">Type: Minifig</div>
            <div className="mt-3 text-sm">
              Copies: <span className="font-semibold">{copies.length}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">Your Copies</div>
              {loading ? <div className="text-sm text-gray-400">Loading…</div> : null}
            </div>

            {err ? (
              <div className="mt-4 rounded-xl border bg-red-50 p-3 text-sm text-red-700">{err}</div>
            ) : null}

            {!loading && !err && copies.length === 0 ? (
              <div className="mt-4 text-sm text-gray-500">No copies found for this minifig.</div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-4">
              {copies.map((c, i) => (
                <CopyCard key={c.id} copy={c} idx={i} />
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border bg-white p-4">
            <div className="text-base font-semibold">MVP notes</div>
            <div className="mt-2 text-sm text-gray-600">
              This is a simple minifig detail page: photo + your copies + condition/notes. No set-minifig checklist here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
