"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"; // or "@supabase/ssr" depending on your version

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

  // Initialize Supabase client
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!catalogItemId) return;

    const fetchItem = async () => {
      setLoading(true);
      
      try {
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error("No user logged in");
          setLoading(false);
          return;
        }

        // 2. Fetch the real item from the database
        // We match 'catalog_item_id' from the URL and ensure it belongs to the user
        const { data, error } = await supabase
          .from("collection_items")
          .select(`
            *,
            catalog:catalog_items (
              id,
              name,
              kind
            )
          `)
          .eq("catalog_item_id", catalogItemId)
          .eq("user_id", user.id)
          .maybeSingle(); // Use maybeSingle() to handle "not found" gracefully

        if (error) {
          console.error("Error fetching item:", error);
        }

        // 3. Set the real data
        if (data) {
            // We cast the data to match your TypeScript type
            // You might need to adjust the select query above if your relation name isn't 'catalog_items'
            setItem(data as unknown as CollectionItemLite);
        } else {
            setItem(null);
        }

      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [catalogItemId, supabase]);

  // ------------------------------------------------------------------

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
