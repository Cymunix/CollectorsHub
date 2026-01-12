// app/collection/[catalogItemId]/page.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import AuthModal from "@/components/AuthModal";
// We import the component AND the type definition
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

  // ------------------------------------------------------------------
  // DATA FETCHING LAYER
  // Since this is a Client Component, we fetch data on mount.
  // Replace the mock object below with your actual API call (e.g. Supabase)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!catalogItemId) return;

    setLoading(true);

    // TODO: Replace this timeout with: const data = await fetchCollectionItem(catalogItemId);
    const timer = setTimeout(() => {
      const mockItem: CollectionItemLite = {
        id: "mock-collection-id",
        catalog_item_id: catalogItemId,
        condition_meta: { status: "new" },
        graded: false,
        grade: null,
        paid_price_cents: 2499,
        notes: "Loaded from Client Component page.",
        created_at: new Date().toISOString(),
        catalog: {
          id: "cat-1",
          name: "Mock Item Title",
          kind: "building_blocks",
        },
      };

      setItem(mockItem);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [catalogItemId]);

  // ------------------------------------------------------------------

  // 1. Handle missing Route Param
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

  // 2. Handle Loading State
  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-12 flex justify-center">
        <div className="text-sm text-gray-500">Loading item...</div>
      </main>
    );
  }

  // 3. Handle Item Not Found (after fetching)
  if (!item) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-6">
        <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
          Item not found in your collection.
        </div>
      </main>
    );
  }

  // 4. Render Success State
  return (
    <>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <main className="bg-gray-50 min-h-screen">
        <CollectionItemScreen
          item={item} // <--- The Type Error is fixed here
          catalogItemId={catalogItemId}
          onRequireAuth={() => setAuthOpen(true)}
        />
      </main>
    </>
  );
}
