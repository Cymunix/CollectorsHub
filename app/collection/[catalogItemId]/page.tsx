// app/collection/[catalogItemId]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";

import CollectionItemScreen from "./_components/CollectionItemScreen";

// ... (Keep your Type definitions: CatalogLite, ConditionMeta, CollectionItemLite) ...
// ... (For brevity, I'm assuming the types are defined as in your snippet) ...

type CatalogLite = {
  id: string;
  name: string | null;
  kind: string | null;
};

type ConditionMeta = {
  status?: string;
  flags?: string[];
  [k: string]: any;
};

type CollectionItemLite = {
  id: string;
  catalog_item_id: string;
  quantity: number | null;
  condition_meta: ConditionMeta | null;
  graded: boolean | null;
  grade: number | null;
  paid_price_cents: number | null;
  paid_currency: string | null;
  notes: string | null;
  created_at: string | null;
  catalog: CatalogLite | null;
};

function getRouteCatalogItemId(params: unknown): string {
  const p = params as any;
  return String(p?.catalogItemId ?? "");
}

export default function CollectionItemPage() {
  const params = useParams();
  const router = useRouter();
  const catalogItemId = useMemo(() => getRouteCatalogItemId(params), [params]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [row, setRow] = useState<CollectionItemLite | null>(null);
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

        const { data: auth } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!auth?.user) {
          setAuthOpen(true);
          setRow(null);
          setLoading(false);
          return;
        }

        const res = await supabase
          .from("user_collection_items")
          .select(
            `
            id,
            catalog_item_id,
            quantity,
            condition_meta,
            graded,
            grade,
            paid_price_cents,
            paid_currency,
            notes,
            created_at,
            catalog:catalog_items!user_collection_items_catalog_item_id_fkey (
              id,
              name,
              kind
            )
          `
          )
          .eq("catalog_item_id", catalogItemId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (res.error) {
          setErr(res.error.message);
          setRow(null);
          setLoading(false);
          return;
        }

        if (!res.data) {
          setRow(null);
          setLoading(false);
          return;
        }

        const data = res.data as any;

        const mapped: CollectionItemLite = {
          id: data.id,
          catalog_item_id: data.catalog_item_id,
          quantity: data.quantity ?? null,
          condition_meta: (data.condition_meta ?? null) as ConditionMeta | null,
          graded: data.graded ?? null,
          grade: data.grade ?? null,
          paid_price_cents: data.paid_price_cents ?? null,
          paid_currency: data.paid_currency ?? null,
          notes: data.notes ?? null,
          created_at: data.created_at ?? null,
          catalog: data.catalog
            ? {
                id: data.catalog.id,
                name: data.catalog.name ?? null,
                kind: data.catalog.kind ?? null,
              }
            : null,
        };

        setRow(mapped);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Unexpected error");
        setRow(null);
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
            <div className="mt-3 text-sm text-red-600">Missing catalogue item id in route.</div>
          </div>
        ) : loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : err ? (
          <div className="rounded-xl border bg-white p-4">
            <div className="mt-3 text-sm text-red-600">{err}</div>
          </div>
        ) : !row ? (
          <div className="rounded-xl border bg-white p-4">
             {/* ... Empty state ... */}
             <div className="mt-3 text-sm text-gray-700">No collection entry found.</div>
          </div>
        ) : (
          /* ✅ UPDATE: Pass the full 'item' row here */
          <CollectionItemScreen
            key={row.id}
            item={row} 
            onRequireAuth={() => setAuthOpen(true)}
          />
        )}
      </main>
    </>
  );
}
