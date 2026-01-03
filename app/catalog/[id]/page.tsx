// app/catalog/[id]/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";

import ItemImage from "./blocks/item_image";
import ItemValueBlock from "./blocks/item_value_block";
import ItemAddActions from "./blocks/item_add";
import ItemConditionSelector from "./blocks/item_condition_selector";
import ItemConditionBuildingBlocks from "./blocks/item_condition_building_blocks";
import ItemDescription from "./blocks/item_description";

import ItemListingsTab from "./tabs/item_listings";
import ItemVariantsTab from "./tabs/item_variants";
import ItemReviewsTab from "./tabs/item_reviews";
import ItemSalesHistoryTab from "./tabs/item_sales_history";

import type { ConditionMeta } from "@/lib/pricingEngine";
import {
  fetchBundleComponents,
  fetchBundlesIncludingItem,
  type IncludedInBundleLite,
} from "@/lib/catalog/queries";

// ✅ IMPORTANT: derive state type from the actual function return to avoid cross-module BundleComponent clashes
type BundleComponentsState = Awaited<ReturnType<typeof fetchBundleComponents>>;

type TabKey =
  | "Item Information"
  | "variants"
  | "reviews"
  | "sales_history"
  | "listings"
  | "included_items"
  | "included_in";

type CatalogItem = {
  id: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;
  upc: string | null;
  release_year: number | null;
  version?: string | null;

  // Bundles
  is_bundle?: boolean | null;
};

type MinifigItem = {
  id: string; // we store minifig_id into this for rendering consistency
  name: string;
  minifig_number: string | null;
  image_url: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;
};

type Category = { id: string; name: string };
type Subcategory = { id: string; name: string };
type Franchise = { id: string; name: string };

// ✅ IMPORTANT: instance_key makes duplicates independently selectable
type Minifig = {
  minifig_id: string;
  instance_key: string; // unique per duplicate
  minifig_number: string;
  name: string | null;
  image_url: string | null;
};

type Photo = { url: string; alt?: string | null };

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

// Renders stars based on avg. Always returns 5 glyphs.
function Stars({ avg }: { avg: number }) {
  const clamped = Math.max(0, Math.min(5, avg));
  const filled = Math.round(clamped);
  const empty = 5 - filled;

  return (
    <span className="flex items-center gap-[2px] leading-none">
      <span className="text-[#F59E0B]">
        {Array.from({ length: filled }).map((_, i) => (
          <span key={`f${i}`}>★</span>
        ))}
      </span>
      <span className="text-[#CBD5E1]">
        {Array.from({ length: empty }).map((_, i) => (
          <span key={`e${i}`}>☆</span>
        ))}
      </span>
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold border transition ${
        active
          ? "bg-[#0F172A] text-white border-[#0F172A]"
          : "bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F8FAFC]"
      }`}
    >
      {children}
    </button>
  );
}

function BundleListCard({
  id,
  name,
  image_url,
  subtitle,
  onClick,
}: {
  id: string;
  name: string;
  image_url: string | null;
  subtitle?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-[#E5E9F2] bg-white hover:bg-[#F8FAFC] transition p-3 flex items-center gap-3"
    >
      <div className="h-14 w-14 rounded-xl border border-[#E5E9F2] bg-[#F8FAFF] overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image_url ? (
          <img src={image_url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-[#94A3B8]">No image</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#0F172A] truncate">{name}</div>
        <div className="text-[11px] text-[#64748B] truncate">{subtitle ? subtitle : id}</div>
      </div>
    </button>
  );
}

function PhotoCarousel({ photos, title }: { photos: Photo[]; title: string }) {
  const safe = useMemo(() => (photos ?? []).filter((p) => !!p?.url), [photos]);
  const [idx, setIdx] = useState(0);
  const hasMany = safe.length > 1;

  useEffect(() => {
    // if photo list changes, clamp index
    setIdx((cur) => Math.min(cur, Math.max(0, safe.length - 1)));
  }, [safe.length]);

  const go = useCallback(
    (dir: -1 | 1) => {
      setIdx((cur) => {
        const next = cur + dir;
        if (next < 0) return safe.length - 1;
        if (next >= safe.length) return 0;
        return next;
      });
    },
    [safe.length]
  );

  if (safe.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-[#E5E9F2] bg-[#F8FAFF] p-4">
        <div className="aspect-square w-full rounded-xl bg-white border border-[#E5E9F2] overflow-hidden flex items-center justify-center">
          <div className="text-xs text-[#94A3B8]">No image</div>
        </div>
      </div>
    );
  }

  const active = safe[idx] ?? safe[0];

  return (
    <div className="w-full rounded-2xl border border-[#E5E9F2] bg-[#F8FAFF] p-4">
      <div className="relative aspect-square w-full rounded-xl bg-white border border-[#E5E9F2] overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.url} alt={active.alt ?? title} className="h-full w-full object-contain" draggable={false} />

        {hasMany ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 border border-[#E5E9F2] px-3 py-2 shadow-sm hover:bg-white"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 border border-[#E5E9F2] px-3 py-2 shadow-sm hover:bg-white"
              aria-label="Next photo"
            >
              ›
            </button>

            <div className="absolute right-2 bottom-2 rounded-full bg-black/70 text-white text-xs px-2 py-1">
              {idx + 1}/{safe.length}
            </div>
          </>
        ) : null}
      </div>

      {hasMany ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {safe.map((p, i) => {
            const activeThumb = i === idx;
            return (
              <button
                key={p.url + i}
                type="button"
                onClick={() => setIdx(i)}
                className={`shrink-0 h-16 w-16 rounded-xl border border-[#E5E9F2] overflow-hidden bg-white ${
                  activeThumb ? "ring-2 ring-[#0F172A]" : "opacity-80 hover:opacity-100"
                }`}
                aria-label={`Photo ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.alt ?? title} className="h-full w-full object-contain" draggable={false} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const kindParam = (sp.get("kind") || "").toLowerCase();
  const preferMinifig = kindParam === "minifig";

  const catalogItemId = params?.id;

  const [tab, setTab] = useState<TabKey>("Item Information");

  const [authOpen, setAuthOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // ✅ NEW: admin flag (derived from profiles)
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Minimal header data only
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [headerErr, setHeaderErr] = useState<string | null>(null);

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [minifigItem, setMinifigItem] = useState<MinifigItem | null>(null);
  const isMinifigPage = !!minifigItem;

  const [category, setCategory] = useState<Category | null>(null);
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [franchise, setFranchise] = useState<Franchise | null>(null);

  // ✅ NEW: catalog item photos for carousel
  const [itemPhotos, setItemPhotos] = useState<Photo[]>([]);

  // Reviews summary for stars beside name
  const [reviewAvg, setReviewAvg] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);

  // ✅ Shared condition state (meta-first)
  const [conditionValues, setConditionValues] = useState<Record<string, any>>({});
  const [conditionMeta, setConditionMeta] = useState<ConditionMeta | null>(null);

  // Building Blocks extras
  const [bbIsSet, setBbIsSet] = useState<boolean>(false);
  const [bbIsMinifig, setBbIsMinifig] = useState<boolean>(false);
  const [bbMinifigs, setBbMinifigs] = useState<Minifig[]>([]);

  // Bundles
  const [isBundle, setIsBundle] = useState<boolean>(false);
  const [bundleComponents, setBundleComponents] = useState<BundleComponentsState>([]);
  const [includedInBundles, setIncludedInBundles] = useState<IncludedInBundleLite[]>([]);
  const [bundleErr, setBundleErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(data.user?.id ?? null);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ✅ NEW: derive admin status from profiles.role
  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      if (!userId) {
        setIsAdmin(false);
        return;
      }

      const res = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

      if (cancelled) return;

      if (res.error) {
        console.error("Failed to load profile role:", res.error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(String(res.data?.role ?? "").toLowerCase() === "admin");
    };

    loadRole();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ✅ Reliable 2-step loader for set → connected minifigs (with quantity support + instance_key)
  const loadSetMinifigs = async (setCatalogItemId: string): Promise<Minifig[]> => {
    // Step 1: link rows (JOIN TABLE)
    const linksRes = await supabase
      .from("catalog_building_block_set_minifigs")
      .select("minifig_id, quantity, sort_order")
      .eq("catalog_item_id", setCatalogItemId)
      .order("sort_order", { ascending: true });

    if (linksRes.error) throw linksRes.error;

    const linkRows = (linksRes.data ?? []) as any[];

    // Expand into per-instance items so duplicates can be selected independently
    const expanded: { id: string; instance_key: string }[] = [];
    for (const r of linkRows) {
      const id = String(r?.minifig_id ?? "").trim();
      if (!id) continue;

      const qRaw = r?.quantity ?? r?.qty;
      const qty = Number.isFinite(Number(qRaw)) ? Math.max(1, Math.floor(Number(qRaw))) : 1;

      for (let i = 0; i < qty; i++) {
        expanded.push({ id, instance_key: `${id}#${i + 1}` });
      }
    }

    if (expanded.length === 0) return [];

    // Step 2: fetch unique minifig rows once
    const uniqueIds = Array.from(new Set(expanded.map((x) => x.id)));

    const figsRes = await supabase
      .from("catalog_minifigs")
      .select("minifig_id,minifig_number,name,image_url")
      .in("minifig_id", uniqueIds);

    if (figsRes.error) throw figsRes.error;

    const byId = new Map<string, any>((figsRes.data ?? []).map((f: any) => [String(f.minifig_id), f]));

    // Expand back out in join-table order including duplicates, but with per-instance keys
    return expan
