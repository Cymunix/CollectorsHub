"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";

import CollectionItemScreen from "./_components/CollectionItemScreen";
import MinifigDetail from "./_components/MinifigDetail";

type CatalogMeta = { id: string; name: string | null };

export default function CollectionItemPage() {
  const params = useParams();
  const router = useRouter();
  const catalogItemId = String((params as any)?.catalogItemId ?? "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [meta, setMeta] = useState<CatalogMeta | null>(null);
  const [isMinifig, setIsMinifig] = useState(false);

  // ✅ FIX: AuthModal requires props
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!catalogItemId) {
          setLoading(false);
          return;
        }

        setLoading(true);
        setErr(null);

        // basic meta (safe)
        const metaRes = await supabase.from("catalog_items").select("id,name").eq("id", catalogItemId).single();

        if (cancelled) return;

        if (metaRes.error) {
          setErr(metaRes.error.message);
          setMeta(null);
          setIsMinifig(false);
          setLoading(false);
          return;
        }

        setMeta({ id: metaRes.data.id, name: metaRes.data.name ?? null });

        // minifig check (if errors, treat as not-minifig -> fall back to existing screen)
        const mfRes = await supabase.from("catalog_minifigs").select("id").eq("catalog_item_id", catalogItemId).limit(1);

        if (cancelled) return;

        setIsMinifig(!mfRes.error && (mfRes.data ?? []).length > 0);
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

      {/* ✅ FIX: pass required props */}
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
          <CollectionItemScreen catalogItemId={catalogItemId} meta={meta} key={catalogItemId} />
        )}
      </main>
    </>
  );
}
