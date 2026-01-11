"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";

import CollectionItemScreen from "./_components/CollectionItemScreen";

/**
 * Collection/[id] should behave like catalog/[id]:
 * - Load one “page model” up front
 * - Render one screen component (no minifig branching in the page layer)
 * - Keep catalogue vs collection responsibilities clean
 */

type CatalogLite = {
  id: string;
  name: string | null;
  kind: string | null;
};

type CollectionItemLite = {
  id: string;
  catalog_item_id: string;
  quantity: number | null;
  condition_text: string | null;
  graded_score: number | null;
  paid_price: number | null;
  notes: string | null;
  acquired_at: string | null;
  catalog: CatalogLite | null;
};

function getRouteId(params: unknown): string {
  const p = params as any;
  // Support a few likely param names so you don’t brick the page if you rename the folder.
  return String(p?.id ?? p?.collectionItemId ?? p?.collection_item_id ?? "");
}

export default function CollectionItemPage() {
  const params = useParams();
  const router = useRouter();

  const collectionItemId = useMemo(() => getRouteId(params), [params]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [row, setRow] = useState<CollectionItemLite | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!collectionItemId) {
          setLoading(false);
          return;
        }

        setLoading(true);
        setErr(null);

        // If you want to hard-require auth for collection pages, do it here.
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
              condition_text,
              graded_score,
              paid_price,
              notes,
              acquired_at,
              catalog:catalog_items!user_collection_items_catalog_item_id_fkey (
                id,
                name,
                kind
              )
            `
          )
          .eq("id", collectionItemId)
          .single();

        if (cancelled) return;

        if (res.error) {
          setErr(res.error.message);
          setRow(null);
          setLoading(false);
          return;
        }

        const data = res.data as any;

        const mapped: CollectionItemLite = {
          id: data.id,
          catalog_item_id: data.catalog_item_id,
          quantity: data.quantity ?? null,
          condition_text: data.condition_text ?? null,
          graded_score: data.graded_score ?? null,
          paid_price: data.paid_price ?? null,
          notes: data.notes ?? null,
          acquired_at: data.acquired_at ?? null,
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
  }, [collectionItemId]);

  return (
    <>
      <Header />
      <SecondaryNav />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {!collectionItemId ? (
          <div className="rounded-xl border bg-white p-4">
            <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
              ← Back
            </button>
            <div className="mt-3 text-sm text-red-600">Missing collection item id in route.</div>
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
        ) : !row ? (
          <div className="rounded-xl border bg-white p-4">
            <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
              ← Back
            </button>
            <div className="mt-3 text-sm text-gray-700">
              {authOpen ? "Sign in to view your collection item." : "Collection item not found."}
            </div>
          </div>
        ) : (
          <CollectionItemScreen
            key={row.id}
            collectionItemId={row.id}
            catalogItemId={row.catalog_item_id}
            catalogMeta={row.catalog}
            // Keep auth handling consistent with your catalog page pattern.
            onRequireAuth={() => setAuthOpen(true)}
          />
        )}
      </main>
    </>
  );
}
