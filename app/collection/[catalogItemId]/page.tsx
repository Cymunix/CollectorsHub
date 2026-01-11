// app/collection/[catalogItemId]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";

import CollectionItemScreen from "./_components/CollectionItemScreen";

type CatalogLite = {
  id: string;
  name: string | null;
  kind: string | null;
};

type CollectionItemLite = {
  id: string;
  catalog_item_id: string;
  quantity: number | null;
  condition_meta: any | null;
  graded: boolean | null;
  grade: number | null;
  paid_price_cents: number | null;
  paid_currency: string | null;
  notes: string | null;
  created_at: string | null;
  catalog: CatalogLite | null;
};

export default function CollectionItemPage() {
  const params = useParams();
  const router = useRouter();
  const catalogItemId = String(params?.catalogItemId ?? "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [row, setRow] = useState<CollectionItemLite | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!auth?.user) {
          setAuthOpen(true);
          setLoading(false);
          return;
        }

        const res = await supabase
          .from("user_collection_items")
          .select(`
            id, catalog_item_id, quantity, condition_meta, graded, grade,
            paid_price_cents, paid_currency, notes, created_at,
            catalog:catalog_items!user_collection_items_catalog_item_id_fkey (id, name, kind)
          `)
          .eq("catalog_item_id", catalogItemId)
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (res.error) throw res.error;

        setRow(res.data as any);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [catalogItemId]);

  return (
    <>
      <Header />
      <SecondaryNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {loading ? <div>Loading...</div> : row ? (
          <CollectionItemScreen item={row} />
        ) : (
          <div className="text-red-600">Item not found in collection.</div>
        )}
      </main>
    </>
  );
}
