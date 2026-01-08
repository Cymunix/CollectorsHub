"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";

import CollectionItemScreen from "./_components/CollectionItemScreen";
import MinifigDetail from "./_components/MinifigDetail";

type CatalogMeta = { id: string; name: string | null; kind: string | null };

function asSingleParam(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default function CollectionItemPage() {
  const params = useParams();
  const router = useRouter();

  const catalogItemId = useMemo(
    () => asSingleParam((params as any)?.catalogItemId),
    [params]
  );

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [meta, setMeta] = useState<CatalogMeta | null>(null);
  const [isMinifig, setIsMinifig] = useState(false);

  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!catalogItemId) {
        setMeta(null);
        setIsMinifig(false);
        setErr(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErr(null);
      setMeta(null);
      setIsMinifig(false);

      try {
        // ✅ Source of truth should be catalog_items.kind.
        // catalog_minifigs is just a helper table; don’t treat user join tables as type checks.
        const metaRes = await supabase
          .from("catalog_items")
          .select("id,name,kind")
          .eq("id", catalogItemId)
          .single();

        if (cancelled) return;

        if (metaRes.error) {
          setErr(metaRes.error.message);
          setLoading(false);
          return;
        }

        const row = metaRes.data as { id: string; name: string | null; kind: string | null };
        const nextMeta: CatalogMeta = { id: row.id, name: row.name ?? null, kind: row.kind ?? null };
        setMeta(nextMeta);

        // If kind explicitly says minifig, we’re done.
        if ((row.kind ?? "").toLowerCase() === "minifig") {
          setIsMinifig(true);
          setLoading(false);
          return;
        }

        // Fallback (only if your DB hasn’t fully migrated to using kind consistently):
        const mfRes = await supabase
          .from("catalog_minifigs")
          .select("id")
          .eq("catalog_item_id", catalogItemId)
          .limit(1);

        if (cancelled) return;

        if (mfRes.error) {
          setErr(mfRes.error.message);
          setLoading(false);
          return;
        }

        setIsMinifig((mfRes.data ?? []).length > 0);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Unexpected error");
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  return (
    <>
      <Header />
      <SecondaryNav />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {!catalogItemId ? (
          <div className="rounded-xl border bg-white p-4">
            <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
              ← Back
            </button>
            <div className="mt-3 text-sm text-red-600">Missing catalog item id in route.</div>
          </div>
        ) : loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : err ? (
          <div className="rounded-xl border bg-white p-4">
            <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
              ← Back
            </button>
            <div className="mt-3 text-sm text-red-600">{err}</div>
          </div>
        ) : isMinifig ? (
          <MinifigDetail catalogItemId={catalogItemId} meta={meta} />
        ) : (
          <CollectionItemScreen catalogItemId={catalogItemId} key={catalogItemId} />
        )}
      </main>
    </>
  );
}
