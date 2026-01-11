// app/collection/[catalogItemId]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import AuthModal from "@/components/AuthModal";
import CollectionItemScreen from "./_components/CollectionItemScreen";

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

export type CollectionItemLite = {
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

        const d = res.data as any;

        const mapped: CollectionItemLite = {
          id: d.id,
          catalog_item_id: d.catalog_item_id,
          quantity: d.quantity ?? null,

          condition_meta: (d.condition_meta ?? null) as ConditionMeta | null,
          graded: d.graded ?? null,
          grade: d.grade ?? null,

          paid_price_cents: d.paid_price_cents ?? null,
          paid_currency: d.paid_currency ?? null,

          notes: d.notes ?? null,
          created_at: d.created_at ?? null,

          catalog: d.catalog
            ? {
                id: d.catalog.id,
                name: d.catalog.name ?? null,
                kind: d.catalog.kind ?? null,
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
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* IMPORTANT:
          Header/SecondaryNav should be rendered by your app layout.
          If you render them here as well, you will get doubled headers. */}
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {!catalogItemId ? (
          <div className="rounded-xl border bg-white p-4">
            <button
              onClick={() => router.back()}
              className="text-sm text-gray-600 hover:underline"
            >
              ← Back
            </button>
            <div className="mt-3 text-sm text-red-600">
              Missing catalogue item id in route.
            </div>
          </div>
        ) : loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : err ? (
          <div className="rounded-xl border bg-white p-4">
            <button
              onClick={() => router.back()}
              className="text-sm text-gray-600 hover:underline"
            >
              ← Back
            </button>
            <div className="mt-3 text-sm text-red-600">{err}</div>
          </div>
        ) : !row ? (
          <div className="rounded-xl border bg-white p-4">
            <button
              onClick={() => router.back()}
              className="text-sm text-gray-600 hover:underline"
            >
              ← Back
            </button>
            <div className="mt-3 text-sm text-gray-700">
              {authOpen ? "Sign in to view your collection item." : "No collection entry found."}
            </div>
          </div>
        ) : (
          <CollectionItemScreen item={row} onRequireAuth={() => setAuthOpen(true)} />
        )}
      </main>
    </>
  );
}
