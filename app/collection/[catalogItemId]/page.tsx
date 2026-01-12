"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import AuthModal from "@/components/AuthModal";
import CollectionItemScreen, { CollectionItemLite } from "./_components/CollectionItemScreen";

function getRouteCatalogItemId(params: unknown): string {
  const p = params as any;
  return String(p?.catalogItemId ?? "");
}

export default function CollectionItemPage() {
  const params = useParams();
  const router = useRouter();
  const catalogItemId = useMemo(() => getRouteCatalogItemId(params), [params]);

  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<CollectionItemLite | null>(null);

  useEffect(() => {
    if (!catalogItemId) return;

    let cancelled = false;

    const fetchItem = async () => {
      setLoading(true);

      try {
        // 1) Get current user (client-side session)
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        // Not signed in => show auth modal + stop
        if (userErr || !user) {
          if (!cancelled) {
            setItem(null);
            setAuthOpen(true);
          }
          return;
        }

        // 2) Fetch item in this user's collection that matches the route catalog item id
        const { data, error } = await supabase
          .from("collection_items")
          .select(
            `
            *,
            catalog:catalog_items (
              id,
              name,
              kind
            )
          `
          )
          .eq("catalog_item_id", catalogItemId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching item:", error);
        }

        if (!cancelled) {
          setItem((data ?? null) as unknown as CollectionItemLite);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        if (!cancelled) setItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchItem();

    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  if (!catalogItemId) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-6">
        <div className="rounded-xl border bg-white p-4">
          <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
            ← Back
          </button>
          <div className="mt-3 text-sm text-red-600">Missing catalogue item id in route.</div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-12 flex justify-center">
        <div className="text-sm text-gray-500">Loading collection...</div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-6">
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
          Item not found in your collection.
        </div>
        <div className="text-center mt-4">
          <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">
            Go back
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <main className="bg-gray-50 min-h-screen">
        <CollectionItemScreen
          item={item}
          catalogItemId={catalogItemId}
          onRequireAuth={() => setAuthOpen(true)}
        />
      </main>
    </>
  );
}
