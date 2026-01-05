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
        <img
          src={active.url}
          alt={active.alt ?? title}
          className="h-full w-full object-contain"
          draggable={false}
        />

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
                <img
                  src={p.url}
                  alt={p.alt ?? title}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   Tab visibility helpers
   ========================= */

async function safeCount(table: string, filters: { col: string; value: any }[]): Promise<number> {
  try {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    for (const f of filters) q = q.eq(f.col, f.value);
    const res = await q;
    if (res.error) return 0;
    return res.count ?? 0;
  } catch {
    return 0;
  }
}

async function safeCountAny(
  candidates: Array<{ table: string; filters: { col: string; value: any }[] }>
): Promise<number> {
  for (const c of candidates) {
    const n = await safeCount(c.table, c.filters);
    if (n > 0) return n;
  }
  return 0;
}

/**
 * ✅ Variants truth check aligned with ItemVariantsTab:
 * - Prefer catalog_items.variant_group_id on this item
 * - Else derive from child variants (base_catalog_item_id = this id)
 * - Variants exist if group has > 1 item OR children exist
 */
async function computeHasVariants(catalogItemId: string): Promise<boolean> {
  try {
    const baseRes = await supabase
      .from("catalog_items")
      .select("variant_group_id")
      .eq("id", catalogItemId)
      .maybeSingle();

    if (baseRes.error) return false;

    let vg: string | null =
      (baseRes.data as any)?.variant_group_id ? String((baseRes.data as any).variant_group_id) : null;

    if (!vg) {
      const childRes = await supabase
        .from("catalog_items")
        .select("variant_group_id")
        .eq("base_catalog_item_id", catalogItemId)
        .not("variant_group_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (!childRes.error) {
        vg = (childRes.data as any)?.variant_group_id ? String((childRes.data as any).variant_group_id) : null;
      }
    }

    if (vg) {
      const groupCountRes = await supabase
        .from("catalog_items")
        .select("id", { count: "exact", head: true })
        .eq("variant_group_id", vg);

      if (groupCountRes.error) return false;
      return (groupCountRes.count ?? 0) > 1;
    }

    const childCountRes = await supabase
      .from("catalog_items")
      .select("id", { count: "exact", head: true })
      .eq("base_catalog_item_id", catalogItemId);

    if (childCountRes.error) return false;
    return (childCountRes.count ?? 0) > 0;
  } catch {
    return false;
  }
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

  // ✅ admin flag (derived from profiles)
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

  // photos for carousel
  const [itemPhotos, setItemPhotos] = useState<Photo[]>([]);

  // Reviews summary
  const [reviewAvg, setReviewAvg] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);

  // Tab content flags
  const [hasVariants, setHasVariants] = useState(false);
  const [hasSalesHistory, setHasSalesHistory] = useState(false);
  const [listingsCount, setListingsCount] = useState(0);

  // Shared condition state
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

  // ✅ derive admin status from profiles.role
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
    return expanded
      .map((x) => {
        const mf = byId.get(x.id);
        if (!mf) return null;

        return {
          minifig_id: String(mf.minifig_id),
          instance_key: x.instance_key,
          minifig_number: String(mf.minifig_number ?? ""),
          name: mf.name ?? null,
          image_url: mf.image_url ?? null,
        } as Minifig;
      })
      .filter(Boolean) as Minifig[];
  };

  useEffect(() => {
    let cancelled = false;

    const loadHeader = async () => {
      setLoadingHeader(true);
      setHeaderErr(null);

      // reset bundle state
      setIsBundle(false);
      setBundleComponents([]);
      setIncludedInBundles([]);
      setBundleErr(null);

      // reset photos
      setItemPhotos([]);

      // reset tab flags
      setHasVariants(false);
      setHasSalesHistory(false);
      setListingsCount(0);

      try {
        setItem(null);
        setMinifigItem(null);

        // 1) MINIFIG-FIRST path (explicit kind=minifig)
        if (preferMinifig) {
          const mfRes = await supabase
            .from("catalog_minifigs")
            .select("minifig_id,name,minifig_number,image_url,subcategory_id,franchise_id")
            .eq("minifig_id", catalogItemId)
            .maybeSingle();

          if (mfRes.error) throw mfRes.error;
          if (!mfRes.data) throw new Error("Item not found.");

          const mf = mfRes.data as any;
          if (cancelled) return;

          setMinifigItem({
            id: String(mf.minifig_id),
            name: String(mf.name ?? "Minifig"),
            minifig_number: mf.minifig_number ?? null,
            image_url: mf.image_url ?? null,
            subcategory_id: mf.subcategory_id ?? null,
            franchise_id: mf.franchise_id ?? null,
          });

          setCategory({ id: "building_blocks", name: "Building Blocks" });

          const [sRes, fRes] = await Promise.all([
            mf.subcategory_id
              ? supabase.from("subcategories").select("id,name").eq("id", mf.subcategory_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
            mf.franchise_id
              ? supabase.from("franchises").select("id,name").eq("id", mf.franchise_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
          ]);

          if (cancelled) return;

          setSubcategory((sRes.data as any) ?? null);
          setFranchise((fRes.data as any) ?? null);

          setReviewAvg(0);
          setReviewCount(0);

          setBbIsSet(false);
          setBbIsMinifig(true);
          setBbMinifigs([]);

          // Minifig pages: default no variants/sales-history; listings tab still visible but count unknown
          setHasVariants(false);
          setHasSalesHistory(false);
          setListingsCount(0);

          return;
        }

        // 2) Normal catalog_item path
        const itemRes = await supabase
          .from("catalog_items")
          .select("id,name,category_id,subcategory_id,franchise_id,upc,release_year,version,is_bundle")
          .eq("id", catalogItemId)
          .maybeSingle();

        if (itemRes.error) throw itemRes.error;

        if (itemRes.data) {
          const it = itemRes.data as CatalogItem;
          if (cancelled) return;

          setItem(it);

          // ✅ photos (carousel)
          try {
            const photosRes = await supabase
              .from("catalog_item_photos")
              .select("url, alt, sort_order, is_primary, created_at")
              .eq("catalog_item_id", it.id)
              .order("is_primary", { ascending: false })
              .order("sort_order", { ascending: true })
              .order("created_at", { ascending: true });

            if (!photosRes.error) {
              const rows = (photosRes.data ?? []) as any[];
              const normalized: Photo[] = rows
                .map((r) => ({
                  url: String(r?.url ?? "").trim(),
                  alt: r?.alt ?? null,
                }))
                .filter((p) => !!p.url);

              if (!cancelled) setItemPhotos(normalized);
            }
          } catch (e) {
            console.error("Failed to load item photos:", e);
            if (!cancelled) setItemPhotos([]);
          }

          // ✅ Tab probes
          const [variantsOk, shCount, lCount] = await Promise.all([
            computeHasVariants(it.id),
            safeCountAny([
              { table: "catalog_item_sales_history", filters: [{ col: "catalog_item_id", value: it.id }] },
              { table: "catalog_sales_history", filters: [{ col: "catalog_item_id", value: it.id }] },
              { table: "item_sales_history", filters: [{ col: "catalog_item_id", value: it.id }] },
            ]),
            safeCountAny([
              { table: "marketplace_listings", filters: [{ col: "catalog_item_id", value: it.id }] },
              { table: "catalog_item_listings", filters: [{ col: "catalog_item_id", value: it.id }] },
              { table: "listings", filters: [{ col: "catalog_item_id", value: it.id }] },
            ]),
          ]);

          if (!cancelled) {
            setHasVariants(variantsOk);
            setHasSalesHistory(shCount > 0);
            setListingsCount(lCount);
          }

          // Bundles load
          try {
            const bundleFlag = !!it?.is_bundle;
            setIsBundle(bundleFlag);

            const [comps, included] = await Promise.all([
              bundleFlag ? fetchBundleComponents(it.id) : Promise.resolve([] as BundleComponentsState),
              fetchBundlesIncludingItem(it.id),
            ]);

            if (!cancelled) {
              setBundleComponents(comps);
              setIncludedInBundles(included);
            }
          } catch (e: any) {
            if (!cancelled) setBundleErr(e?.message ?? "Failed to load bundle data.");
          }

          // Reviews summary
          try {
            const reviewsRes = await supabase
              .from("catalog_item_reviews")
              .select("rating", { count: "exact" })
              .eq("catalog_item_id", it.id);

            if (!reviewsRes.error) {
              const rows = reviewsRes.data ?? [];
              const count = reviewsRes.count ?? rows.length;

              if (count > 0) {
                const rawAvg =
                  rows.reduce((sum: number, r: any) => sum + Number(r?.rating ?? 0), 0) / count;
                const avg = Math.round(rawAvg * 10) / 10;

                if (!cancelled) {
                  setReviewAvg(avg);
                  setReviewCount(count);
                }
              } else {
                if (!cancelled) {
                  setReviewAvg(0);
                  setReviewCount(0);
                }
              }
            } else {
              if (!cancelled) {
                setReviewAvg(0);
                setReviewCount(0);
              }
            }
          } catch {
            if (!cancelled) {
              setReviewAvg(0);
              setReviewCount(0);
            }
          }

          const [cRes, sRes, fRes] = await Promise.all([
            it.category_id
              ? supabase.from("categories").select("id,name").eq("id", it.category_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
            it.subcategory_id
              ? supabase.from("subcategories").select("id,name").eq("id", it.subcategory_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
            it.franchise_id
              ? supabase.from("franchises").select("id,name").eq("id", it.franchise_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
          ]);

          if (cancelled) return;

          const catObj = (cRes.data as any) ?? null;
          const subObj = (sRes.data as any) ?? null;

          setCategory(catObj);
          setSubcategory(subObj);
          setFranchise((fRes.data as any) ?? null);

          // Building Blocks detection
          const catName = String(catObj?.name ?? "").toLowerCase();
          const subName = String(subObj?.name ?? "").toLowerCase();
          const isBB = catName.includes("building") || catName.includes("block") || catName.includes("lego");

          if (isBB) {
            const bbRowRes = await supabase
              .from("catalog_building_blocks")
              .select("catalog_item_id")
              .eq("catalog_item_id", it.id)
              .maybeSingle();

            const isSetByRow = !!bbRowRes.data?.catalog_item_id && !bbRowRes.error;

            let linked: Minifig[] = [];
            try {
              linked = await loadSetMinifigs(it.id);
            } catch (e) {
              console.error("Failed to load linked minifigs:", e);
              linked = [];
            }

            const isSetByLinks = linked.length > 0;
            const finalIsSet = isSetByRow || isSetByLinks;
            const finalIsMinifig = !finalIsSet && (subName.includes("minifig") || subName.includes("minifigure"));

            if (!cancelled) {
              setBbIsSet(finalIsSet);
              setBbIsMinifig(finalIsMinifig);
              setBbMinifigs(linked);
            }
          } else {
            if (!cancelled) {
              setBbIsSet(false);
              setBbIsMinifig(false);
              setBbMinifigs([]);
            }
          }

          return;
        }

        // 3) Fallback to minifig if catalog_items didn’t have it
        const mfRes = await supabase
          .from("catalog_minifigs")
          .select("minifig_id,name,minifig_number,image_url,subcategory_id,franchise_id")
          .eq("minifig_id", catalogItemId)
          .maybeSingle();

        if (mfRes.error) throw mfRes.error;
        if (!mfRes.data) throw new Error("Item not found.");

        const mf = mfRes.data as any;
        if (cancelled) return;

        setMinifigItem({
          id: String(mf.minifig_id),
          name: String(mf.name ?? "Minifig"),
          minifig_number: mf.minifig_number ?? null,
          image_url: mf.image_url ?? null,
          subcategory_id: mf.subcategory_id ?? null,
          franchise_id: mf.franchise_id ?? null,
        });

        setCategory({ id: "building_blocks", name: "Building Blocks" });

        const [sRes, fRes] = await Promise.all([
          mf.subcategory_id
            ? supabase.from("subcategories").select("id,name").eq("id", mf.subcategory_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
          mf.franchise_id
            ? supabase.from("franchises").select("id,name").eq("id", mf.franchise_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
        ]);

        if (cancelled) return;

        setSubcategory((sRes.data as any) ?? null);
        setFranchise((fRes.data as any) ?? null);

        setReviewAvg(0);
        setReviewCount(0);

        setBbIsSet(false);
        setBbIsMinifig(true);
        setBbMinifigs([]);

        // Minifig pages: default no variants/sales-history; listings tab still visible but count unknown
        setHasVariants(false);
        setHasSalesHistory(false);
        setListingsCount(0);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setHeaderErr(e?.message || "Failed to load item.");
      } finally {
        if (!cancelled) setLoadingHeader(false);
      }
    };

    if (catalogItemId) loadHeader();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId, preferMinifig]);

  const isBuildingBlocks = useMemo(() => {
    const c = (category?.name ?? "").toLowerCase();
    return c.includes("building") || c.includes("block") || c.includes("lego");
  }, [category?.name]);

  const isGradableCategory = useMemo(() => {
    if (isBuildingBlocks) return false;
    const c = (category?.name ?? "").toLowerCase();
    return c.includes("comic") || c.includes("trading") || c.includes("sports card") || c.includes("cards");
  }, [category?.name, isBuildingBlocks]);

  const reviewText = useMemo(() => {
    if (reviewCount > 0) {
      const avgStr = reviewAvg.toFixed(1);
      return `${avgStr}/5 (${reviewCount})`;
    }
    return "No reviews yet";
  }, [reviewAvg, reviewCount]);

  const displayName = loadingHeader ? "Loading..." : safeText(isMinifigPage ? minifigItem?.name : item?.name);

  // ✅ Decide BB mode WITHOUT relying on bbIsSet
  const bbMode: "set" | "minifig" = isBuildingBlocks && (isMinifigPage || bbIsMinifig) ? "minifig" : "set";

  const showIncludedItemsTab = !isMinifigPage && !!item?.id && isBundle;
  const showIncludedInTab =
    !isMinifigPage && !!item?.id && !isBundle && (includedInBundles?.length ?? 0) > 0;

  /* =========================
     Conditional tabs registry
     Hide if empty EXCEPT: Reviews + Listings
     Admin can always see Variants
     ========================= */

  type VisibilityMode = "always" | "hide_if_empty" | "show_even_if_empty";
  type TabDef = {
    key: TabKey;
    label: string;
    visibility: VisibilityMode;
    hasContent: () => boolean;
  };

  const tabDefs: TabDef[] = useMemo(() => {
    const defs: TabDef[] = [
      { key: "Item Information", label: "Information", visibility: "always", hasContent: () => true },
    ];

    if (showIncludedItemsTab) {
      defs.push({
        key: "included_items",
        label: "Included Items",
        visibility: "hide_if_empty",
        hasContent: () => bundleComponents.length > 0,
      });
    }

    if (showIncludedInTab) {
      defs.push({
        key: "included_in",
        label: "Included In",
        visibility: "hide_if_empty",
        hasContent: () => includedInBundles.length > 0,
      });
    }

    defs.push(
      {
        key: "variants",
        label: "Variants",
        visibility: isAdmin ? "show_even_if_empty" : "hide_if_empty",
        hasContent: () => hasVariants,
      },
      {
        key: "reviews",
        label: "Reviews",
        visibility: "show_even_if_empty", // ✅ exception
        hasContent: () => reviewCount > 0,
      },
      {
        key: "sales_history",
        label: "Sales History",
        visibility: "hide_if_empty",
        hasContent: () => hasSalesHistory,
      },
      {
        key: "listings",
        label: "Listings",
        visibility: "show_even_if_empty", // ✅ exception
        hasContent: () => true,
      }
    );

    return defs;
  }, [
    showIncludedItemsTab,
    showIncludedInTab,
    bundleComponents.length,
    includedInBundles.length,
    hasVariants,
    hasSalesHistory,
    reviewCount,
    isAdmin, // ✅ IMPORTANT
  ]);

  const visibleTabs = useMemo(() => {
    return tabDefs.filter((t) => {
      if (t.visibility === "always") return true;
      if (t.visibility === "show_even_if_empty") return true;
      return t.hasContent(); // hide_if_empty
    });
  }, [tabDefs]);

  // ✅ If current tab becomes hidden after async loads, force fallback
  useEffect(() => {
    if (!visibleTabs.find((t) => t.key === tab)) {
      setTab(visibleTabs[0]?.key ?? "Item Information");
    }
  }, [tab, visibleTabs]);

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A]">
      <Header />
      <SecondaryNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <div className="px-6 py-6">
        <div className="mb-3">
          <button
            type="button"
            onClick={() => router.push("/catalog")}
            className="text-xs text-[#2563EB] hover:underline"
          >
            ← Back to Catalog
          </button>
        </div>

        {headerErr ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {headerErr}
          </div>
        ) : null}

        <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm p-5">
          {/* Title */}
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold truncate">{displayName}</h1>

              {/* ✅ Version badge (ONLY once, here) */}
              {!isMinifigPage && item?.version ? (
                <span className="inline-flex items-center rounded-full border bg-[#0F172A] px-3 py-1 text-xs font-semibold text-white border-[#0F172A]">
                  Version: {item.version}
                </span>
              ) : null}

              {!isMinifigPage && isBundle ? (
                <span className="inline-flex items-center rounded-full border bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#0F172A] border-[#E5E9F2]">
                  Bundle
                </span>
              ) : null}

              {/* ✅ Reviews beside title */}
              <button
                type="button"
                onClick={() => setTab("reviews")}
                className="flex items-center gap-2 rounded-full border border-[#E5E9F2] bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#0F172A] hover:bg-white transition"
                aria-label="View reviews"
              >
                <Stars avg={reviewCount > 0 ? reviewAvg : 0} />
                <span className="text-[11px] text-[#64748B]">{reviewText}</span>
              </button>
            </div>

            {/* Subtitle */}
            <div className="mt-1 text-xs text-[#6B7280]">
              {safeText(category?.name)}
              {subcategory?.name ? ` • ${subcategory.name}` : ""}
              {franchise?.name ? ` • ${franchise.name}` : ""}
              {isMinifigPage && minifigItem?.minifig_number ? ` • Fig # ${minifigItem.minifig_number}` : ""}
              {!isMinifigPage && item?.upc ? ` • UPC: ${item.upc}` : ""}
            </div>
          </div>

          {/* Layout */}
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[340px_1fr_360px] gap-5 items-start">
            {/* Left: Image */}
            <div className="min-w-0">
              {isMinifigPage ? (
                <div className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFF] p-4">
                  <div className="aspect-square w-full rounded-xl bg-white border border-[#E5E9F2] overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {minifigItem?.image_url ? (
                      <img
                        src={minifigItem.image_url}
                        alt={safeText(minifigItem?.name)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-xs text-[#94A3B8]">No image</div>
                    )}
                  </div>
                </div>
              ) : itemPhotos.length > 0 ? (
                <PhotoCarousel photos={itemPhotos} title={item?.name ?? "Item"} />
              ) : (
                <ItemImage catalogItemId={catalogItemId} itemName={item?.name ?? "Item"} />
              )}
            </div>

            {/* Middle: Value + Condition */}
            <div className="min-w-0 space-y-3">
              <ItemValueBlock
                catalogItemId={catalogItemId}
                categoryName={category?.name ?? null}
                isBuildingBlocks={isBuildingBlocks}
                isGradableCategory={isGradableCategory}
                conditionValues={conditionValues}
                conditionMeta={conditionMeta ?? undefined}
              />

              {isBuildingBlocks ? (
                <ItemConditionBuildingBlocks
                  mode={bbMode}
                  catalogItemId={catalogItemId}
                  expectedMinifigs={bbMode === "set" ? bbMinifigs : []}
                  conditionValues={conditionValues}
                  conditionMeta={conditionMeta ?? undefined}
                  onChange={(nextValues, nextMeta) => {
                    setConditionValues(nextValues);
                    setConditionMeta(nextMeta);
                  }}
                />
              ) : (
                <ItemConditionSelector
                  catalogItemId={catalogItemId}
                  categoryName={category?.name ?? null}
                  isBuildingBlocks={isBuildingBlocks}
                  isGradableCategory={isGradableCategory}
                  conditionValues={conditionValues}
                  conditionMeta={conditionMeta ?? undefined}
                  onChange={(nextValues, nextMeta) => {
                    setConditionValues(nextValues);
                    setConditionMeta(nextMeta);
                  }}
                />
              )}
            </div>

            {/* Right: Actions */}
            <div className="min-w-0">
              <ItemAddActions
                catalogItemId={catalogItemId}
                userId={userId}
                onRequireAuth={() => setAuthOpen(true)}
                conditionValues={conditionValues}
                onConditionValuesChange={(next) => setConditionValues(next)}
                seedMinifigs={bbMode === "set" ? bbMinifigs : []}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex items-center gap-2 flex-wrap">
            {visibleTabs.map((t) => (
              <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
                {t.key === "listings" && listingsCount > 0 ? ` (${listingsCount})` : ""}
              </TabButton>
            ))}
          </div>

          {/* Bundle errors */}
          {bundleErr ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {bundleErr}
            </div>
          ) : null}

          {/* Tab Content */}
          <div className="mt-4 space-y-4">
            {tab === "Item Information" ? (
              <ItemDescription
                catalogItemId={catalogItemId}
                isAdmin={isAdmin}
                categoryName={category?.name ?? null}
              />
            ) : null}

            {tab === "included_items" && showIncludedItemsTab ? (
              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A]">Included Items</div>
                    <div className="text-xs text-[#64748B]">Items included in this bundle.</div>
                  </div>
                  <div className="text-xs text-[#64748B]">{bundleComponents.length} item(s)</div>
                </div>

                <div className="mt-3 space-y-2">
                  {bundleComponents.length === 0 ? (
                    <div className="rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">
                      No components set yet.
                    </div>
                  ) : (
                    bundleComponents.map((c: any) => {
                      const comp = c.component;
                      const compName = safeText(comp?.name);
                      const subtitle = `Qty: ${c.qty}${comp?.release_year ? ` • ${comp.release_year}` : ""}${
                        comp?.version ? ` • ${comp.version}` : ""
                      }`;

                      return (
                        <BundleListCard
                          key={c.component_item_id}
                          id={c.component_item_id}
                          name={compName}
                          image_url={(comp as any)?.image_url ?? null}
                          subtitle={subtitle}
                          onClick={() => router.push(`/catalog/${c.component_item_id}`)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            {tab === "included_in" && showIncludedInTab ? (
              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A]">Included In</div>
                    <div className="text-xs text-[#64748B]">Bundles that include this item.</div>
                  </div>
                  <div className="text-xs text-[#64748B]">{includedInBundles.length} bundle(s)</div>
                </div>

                <div className="mt-3 space-y-2">
                  {includedInBundles.length === 0 ? (
                    <div className="rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">No bundles found.</div>
                  ) : (
                    includedInBundles.map((b) => (
                      <BundleListCard
                        key={b.id}
                        id={b.id}
                        name={safeText(b.name)}
                        image_url={b.image_url ?? null}
                        subtitle="Bundle"
                        onClick={() => router.push(`/catalog/${b.id}`)}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {/* ✅ FIX: pass isAdmin */}
            {tab === "variants" ? <ItemVariantsTab catalogItemId={catalogItemId} isAdmin={isAdmin} /> : null}
            {tab === "reviews" ? <ItemReviewsTab catalogItemId={catalogItemId} /> : null}
            {tab === "sales_history" ? (
              <ItemSalesHistoryTab catalogItemId={catalogItemId} selectedConditionJson={conditionValues} />
            ) : null}
            {tab === "listings" ? (
              <ItemListingsTab
                catalogItemId={catalogItemId}
                categoryName={category?.name ?? null}
                itemName={isMinifigPage ? (minifigItem?.name ?? "Minifig") : item?.name ?? "Item"}
                userId={userId}
                onRequireAuth={() => setAuthOpen(true)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
