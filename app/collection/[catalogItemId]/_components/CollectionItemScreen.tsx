"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import CopiesList from "./CopiesList";

type CatalogLite = {
  id: string;
  name: string | null;
  kind: string | null;
};

type CollectionCopy = {
  id: string;
  created_at: string | null;
  condition_json?: any | null;
  grade?: string | null;
  notes?: string | null;
  price_paid_cad?: number | null;
};

type Props = {
  catalogItemId: string;
  onRequireAuth?: () => void;
};

type TabKey = "overview" | "copies";

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-sm border",
        active ? "bg-black text-white border-black" : "bg-white text-gray-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function CollectionItemScreen({ catalogItemId, onRequireAuth }: Props) {
  const [tab, setTab] = useState<TabKey>("overview");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<CatalogLite | null>(null);
  const [copies, setCopies] = useState<CollectionCopy[]>([]);

  // You can wire worthCad later if you’ve got a pricing source; keeping null is safe.
  const worthCad: number | null = null;

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
          onRequireAuth?.();
          setCatalog(null);
          setCopies([]);
          setLoading(false);
          return;
        }

        // Load item basics (name/kind)
        const itemRes = await supabase
          .from("catalog_items")
          .select("id,name,kind")
          .eq("id", catalogItemId)
          .maybeSingle();

        if (cancelled) return;

        if (itemRes.error) {
          setErr(itemRes.error.message);
          setCatalog(null);
          setCopies([]);
          setLoading(false);
          return;
        }

        const item = itemRes.data as any;
        setCatalog(
          item
            ? { id: item.id, name: item.name ?? null, kind: item.kind ?? null }
            : null
        );

        // Load user's copies for this item
        const copiesRes = await supabase
          .from("user_collection_items")
          .select("id,created_at,condition_json,grade,notes,price_paid_cad")
          .eq("catalog_item_id", catalogItemId)
          .order("created_at", { ascending: false });

        if (cancelled) return;

        if (copiesRes.error) {
          setErr(copiesRes.error.message);
          setCopies([]);
          setLoading(false);
          return;
        }

        setCopies((copiesRes.data ?? []) as any);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Unexpected error");
        setCatalog(null);
        setCopies([]);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId, onRequireAuth]);

  const itemName = useMemo(() => catalog?.name?.trim() || "Untitled item", [catalog?.name]);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  if (err) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-red-600">
        {err}
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-gray-700">
        Item not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="text-2xl font-semibold text-gray-900">{itemName}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={tab === "copies"} onClick={() => setTab("copies")}>
            Your copies ({copies.length})
          </TabButton>
        </div>
      </div>

      {/* Tabs */}
      {tab === "overview" ? (
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Overview</div>
          <div className="mt-2 text-sm text-gray-700">
            Kind: <span className="font-semibold">{String(catalog.kind ?? "unknown")}</span>
          </div>
          <div className="mt-1 text-sm text-gray-700">
            Copies you own: <span className="font-semibold">{copies.length}</span>
          </div>
        </div>
      ) : (
        <CopiesList
          copies={copies}
          catalogItemId={catalogItemId}
          itemName={itemName}
          worthCad={worthCad}
        />
      )}
    </div>
  );
}
