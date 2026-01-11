// app/collection/[catalogItemId]/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import AuthModal from "@/components/AuthModal";
import CollectionItemScreen from "./_components/CollectionItemScreen";

function getRouteCatalogItemId(params: unknown): string {
  const p = params as any;
  return String(p?.catalogItemId ?? "");
}

export default function CollectionItemPage() {
  const params = useParams();
  const router = useRouter();
  const catalogItemId = useMemo(() => getRouteCatalogItemId(params), [params]);

  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {!catalogItemId ? (
          <div className="rounded-xl border bg-white p-4">
            <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
              ← Back
            </button>
            <div className="mt-3 text-sm text-red-600">Missing catalogue item id in route.</div>
          </div>
        ) : (
          <CollectionItemScreen
            catalogItemId={catalogItemId}
            onRequireAuth={() => setAuthOpen(true)}
          />
        )}
      </main>
    </>
  );
}
