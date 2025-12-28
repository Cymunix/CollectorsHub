// app/purchases/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";

type SaleRow = {
  id: string;
  catalog_item_id: string;
  sale_at: string | null;
  sale_price_cad: number | null;
  buyer_user_id: string | null;
  seller_user_id: string | null;
};

type CatalogItem = {
  id: string;
  title?: string | null;
  name?: string | null;
};

type PhotoRow = {
  catalog_item_id: string;
  image_url: string;
  is_primary: boolean | null;
  sort_order: number | null;
};

function formatMoney(n: number | null | undefined) {
  const v = typeof n === "number" ? n : null;
  if (v === null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-CA", { year: "numeric", month: "short", day: "2-digit" });
}

export default function PurchasesPage() {
  const [showAuth, setShowAuth] = useState(false);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [rows, setRows] = useState<SaleRow[]>([]);
  const [catalogById, setCatalogById] = useState<Record<string, CatalogItem>>({});
  const [photoByCatalogId, setPhotoByCatalogId] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Auth source of truth
  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      setAuthLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error) setAuthUserId(null);
      else setAuthUserId(data.user?.id ?? null);
      setAuthLoading(false);
    }

    loadAuth();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadAuth());

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load purchases
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr(null);
      setBusy(true);

      if (!authUserId) {
        setRows([]);
        setCatalogById({});
        setPhotoByCatalogId({});
        setBusy(false);
        return;
      }

      const salesRes = await supabase
        .from("marketplace_sales")
        .select("id,catalog_item_id,sale_at,sale_price_cad,buyer_user_id,seller_user_id")
        .eq("buyer_user_id", authUserId)
        .order("sale_at", { ascending: false });

      if (cancelled) return;

      if (salesRes.error) {
        setErr(salesRes.error.message);
        setRows([]);
        setBusy(false);
        return;
      }

      const sales = (salesRes.data ?? []) as SaleRow[];
      setRows(sales);

      const catalogIds = Array.from(new Set(sales.map((s) => s.catalog_item_id).filter(Boolean)));

      if (catalogIds.length === 0) {
        setCatalogById({});
        setPhotoByCatalogId({});
        setBusy(false);
        return;
      }

      const itemsRes = await supabase.from("catalog_items").select("id,title,name").in("id", catalogIds);

      if (cancelled) return;

      if (itemsRes.error) {
        setCatalogById({});
      } else {
        const map: Record<string, CatalogItem> = {};
        for (const it of (itemsRes.data ?? []) as CatalogItem[]) map[it.id] = it;
        setCatalogById(map);
      }

      const photosRes = await supabase
        .from("catalog_item_photos")
        .select("catalog_item_id,image_url,is_primary,sort_order")
        .in("catalog_item_id", catalogIds)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });

      if (cancelled) return;

      if (photosRes.error) {
        setPhotoByCatalogId({});
      } else {
        const by: Record<string, string> = {};
        const photos = (photosRes.data ?? []) as PhotoRow[];
        for (const p of photos) {
          if (!by[p.catalog_item_id]) by[p.catalog_item_id] = p.image_url;
        }
        setPhotoByCatalogId(by);
      }

      setBusy(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [authUserId]);

  const items = useMemo(() => rows ?? [], [rows]);

  return (
    <>
      <Header />
      <SecondaryNav />
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {/* Page header (since SecondaryNav doesn't take title/subtitle props) */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-[#0F172A]">Purchase History</h1>
          <p className="mt-1 text-sm text-[#64748B]">Everything you’ve bought on CollectorsHub</p>
        </div>

        {authLoading && (
          <div className="rounded-2xl border bg-white p-6">
            <div className="h-6 w-48 animate-pulse rounded bg-[#F1F5F9]" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-[#F1F5F9]" />
          </div>
        )}

        {!authLoading && !authUserId && (
          <div className="rounded-2xl border bg-white p-6">
            <div className="text-lg font-semibold text-[#0F172A]">You’re not logged in.</div>
            <div className="mt-1 text-sm text-[#475569]">Log in to see your purchase history.</div>
            <button
              onClick={() => setShowAuth(true)}
              className="mt-4 rounded-full bg-[#3B82F6] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2563EB]"
            >
              Login
            </button>
          </div>
        )}

        {!authLoading && authUserId && (
          <div className="rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-[#0F172A]">Purchases</div>
                <div className="text-sm text-[#64748B]">Most recent first</div>
              </div>
              <div className="text-sm text-[#64748B]">{items.length} total</div>
            </div>

            {err && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="font-semibold">Couldn’t load purchases</div>
                <div className="mt-1 break-words">{err}</div>
              </div>
            )}

            {!err && busy && (
              <div className="mt-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F1F5F9]" />
                ))}
              </div>
            )}

            {!err && !busy && items.length === 0 && (
              <div className="mt-6 rounded-xl border bg-[#F8FAFC] p-6 text-sm text-[#475569]">No purchases yet.</div>
            )}

            {!err && !busy && items.length > 0 && (
              <div className="mt-6 divide-y">
                {items.map((r) => {
                  const ci = catalogById[r.catalog_item_id];
                  const title = (ci?.title ?? ci?.name ?? "Untitled item") as string;
                  const photo = photoByCatalogId[r.catalog_item_id] ?? null;

                  return (
                    <div key={r.id} className="flex items-center gap-4 py-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-[#F8FAFC]">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt={title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[#94A3B8]">No photo</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[#0F172A]">{title}</div>
                        <div className="mt-0.5 text-xs text-[#64748B]">Bought • {formatDate(r.sale_at)}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold text-[#0F172A]">{formatMoney(r.sale_price_cad)}</div>
                        <div className="text-xs text-[#64748B]">CAD</div>
                      </div>
