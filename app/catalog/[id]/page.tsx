// app/catalog/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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

/* =========================
   Types
   ========================= */

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
  is_bundle?: boolean | null;
};

type MinifigItem = {
  id: string;
  name: string;
  minifig_number: string | null;
  image_url: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;
};

type Category = { id: string; name: string };
type Subcategory = { id: string; name: string };
type Franchise = { id: string; name: string };

type Minifig = {
  minifig_id: string;
  instance_key: string;
  minifig_number: string;
  name: string | null;
  image_url: string | null;
};

/* =========================
   Helpers
   ========================= */

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function Stars({ avg }: { avg: number }) {
  const filled = Math.round(Math.max(0, Math.min(5, avg)));
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

/* =========================
   Page
   ========================= */

export default function Page({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sp = useSearchParams();

  const catalogItemId = params.id;
  const preferMinifig = (sp.get("kind") || "").toLowerCase() === "minifig";

  const [tab, setTab] = useState<TabKey>("Item Information");
  const [authOpen, setAuthOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [minifigItem, setMinifigItem] = useState<MinifigItem | null>(null);
  const isMinifigPage = !!minifigItem;

  const [category, setCategory] = useState<Category | null>(null);
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [franchise, setFranchise] = useState<Franchise | null>(null);

  const [reviewAvg, setReviewAvg] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  const [conditionValues, setConditionValues] = useState<Record<string, any>>({});
  const [conditionMeta, setConditionMeta] = useState<ConditionMeta | null>(null);

  const [bbMinifigs, setBbMinifigs] = useState<Minifig[]>([]);

  const [isBundle, setIsBundle] = useState(false);
  const [bundleComponents, setBundleComponents] = useState<BundleComponentsState>([]);
  const [includedInBundles, setIncludedInBundles] = useState<IncludedInBundleLite[]>([]);

  /* =========================
     Auth
     ========================= */

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUserId(s?.user?.id ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return setIsAdmin(false);
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then((r) => setIsAdmin(String(r.data?.role ?? "").toLowerCase() === "admin"));
  }, [userId]);

  /* =========================
     Header Loader (minimal)
     ========================= */

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // reset
      setItem(null);
      setMinifigItem(null);
      setCategory(null);
      setSubcategory(null);
      setFranchise(null);
      setBbMinifigs([]);
      setIsBundle(false);
      setBundleComponents([]);
      setIncludedInBundles([]);
      setReviewAvg(0);
      setReviewCount(0);

      try {
        // Prefer minifig path if explicit
        if (preferMinifig) {
          const mfRes = await supabase
            .from("catalog_minifigs")
            .select("minifig_id,name,minifig_number,image_url,subcategory_id,franchise_id")
            .eq("minifig_id", catalogItemId)
            .maybeSingle();

          if (mfRes.error) throw mfRes.error;
          if (!mfRes.data) throw new Error("Item not found.");

          if (cancelled) return;

          const mf: any = mfRes.data;

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
          return;
        }

        // Normal catalog item path
        const itemRes = await supabase
          .from("catalog_items")
          .select("id,name,category_id,subcategory_id,franchise_id,upc,release_year,version,is_bundle")
          .eq("id", catalogItemId)
          .maybeSingle();

        if (itemRes.error) throw itemRes.error;

        if (itemRes.data) {
          if (cancelled) return;

          const it = itemRes.data as CatalogItem;
          setItem(it);

          // category/sub/franchise
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

          setCategory((cRes.data as any) ?? null);
          setSubcategory((sRes.data as any) ?? null);
          setFranchise((fRes.data as any) ?? null);

          // bundle state
          const bundleFlag = !!it.is_bundle;
          setIsBundle(bundleFlag);

          try {
            const [comps, included] = await Promise.all([
              bundleFlag ? fetchBundleComponents(it.id) : Promise.resolve([] as BundleComponentsState),
              fetchBundlesIncludingItem(it.id),
            ]);
            if (!cancelled) {
              setBundleComponents(comps);
              setIncludedInBundles(included);
            }
          } catch {
            // non-fatal
          }

          // reviews summary
          try {
            const reviewsRes = await supabase
              .from("catalog_item_reviews")
              .select("rating", { count: "exact" })
              .eq("catalog_item_id", it.id);

            if (!cancelled && !reviewsRes.error) {
              const rows = reviewsRes.data ?? [];
              const count = reviewsRes.count ?? rows.length;
              setReviewCount(count);
              if (count > 0) {
                const avg =
                  rows.reduce((sum: number, r: any) => sum + Number(r?.rating ?? 0), 0) / count;
                setReviewAvg(Math.round(avg * 10) / 10);
              } else {
                setReviewAvg(0);
              }
            }
          } catch {
            if (!cancelled) {
              setReviewAvg(0);
              setReviewCount(0);
            }
          }

          return;
        }

        // fallback: treat as minifig if not found in catalog_items
        const mfRes = await supabase
          .from("catalog_minifigs")
          .select("minifig_id,name,minifig_number,image_url,subcategory_id,franchise_id")
          .eq("minifig_id", catalogItemId)
          .maybeSingle();

        if (mfRes.error) throw mfRes.error;
        if (!mfRes.data) throw new Error("Item not found.");

        if (cancelled) return;

        const mf: any = mfRes.data;

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
      } catch (e) {
        console.error(e);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId, preferMinifig]);

  /* =========================
     Derived
     ========================= */

  const isBuildingBlocks = useMemo(() => {
    const c = (category?.name ?? "").toLowerCase();
    return c.includes("building") || c.includes("block") || c.includes("lego");
  }, [category?.name]);

  const isGradableCategory = useMemo(() => {
    if (isBuildingBlocks) return false;
    const c = (category?.name ?? "").toLowerCase();
    return c.includes("comic") || c.includes("trading") || c.includes("card");
  }, [category?.name, isBuildingBlocks]);

  const reviewText = reviewCount
    ? `${reviewAvg.toFixed(1)}/5 (${reviewCount})`
    : "No reviews yet";

  const displayName = safeText(isMinifigPage ? minifigItem?.name : item?.name);

  const showIncludedItemsTab = !isMinifigPage && !!item?.id && isBundle;
  const showIncludedInTab = !isMinifigPage && !!item?.id && !isBundle && (includedInBundles?.length ?? 0) > 0;

  /* =========================
     Render
     ========================= */

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A]">
      <Header />
      <SecondaryNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <div className="px-6 py-6">
        <button
          type="button"
          onClick={() => router.push("/catalog")}
          className="mb-3 text-xs text-[#2563EB] hover:underline"
        >
          ← Back to Catalog
        </button>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold truncate">{displayName}</h1>

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

          <div className="mt-1 text-xs text-[#6B7280]">
            {safeText(category?.name)}
            {subcategory?.name ? ` • ${subcategory.name}` : ""}
            {franchise?.name ? ` • ${franchise.name}` : ""}
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[340px_1fr_360px] gap-5">
            <ItemImage catalogItemId={catalogItemId} itemName={displayName} />

            <div className="space-y-3">
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
                  mode="set"
                  catalogItemId={catalogItemId}
                  expectedMinifigs={bbMinifigs}
                  conditionValues={conditionValues}
                  conditionMeta={conditionMeta ?? undefined}
                  onChange={(v, m) => {
                    setConditionValues(v);
                    setConditionMeta(m);
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
                  onChange={(v, m) => {
                    setConditionValues(v);
                    setConditionMeta(m);
                  }}
                />
              )}
            </div>

            <ItemAddActions
              catalogItemId={catalogItemId}
              userId={userId}
              onRequireAuth={() => setAuthOpen(true)}
              conditionValues={conditionValues}
              onConditionValuesChange={setConditionValues}
              seedMinifigs={bbMinifigs}
            />
          </div>

          <div className="mt-6 flex gap-2 flex-wrap">
            <TabButton active={tab === "Item Information"} onClick={() => setTab("Item Information")}>
              Information
            </TabButton>

            {showIncludedItemsTab ? (
              <TabButton active={tab === "included_items"} onClick={() => setTab("included_items")}>
                Included Items
              </TabButton>
            ) : null}

            {showIncludedInTab ? (
              <TabButton active={tab === "included_in"} onClick={() => setTab("included_in")}>
                Included In
              </TabButton>
            ) : null}

            <TabButton active={tab === "variants"} onClick={() => setTab("variants")}>
              Variants
            </TabButton>
            <TabButton active={tab === "reviews"} onClick={() => setTab("reviews")}>
              Reviews
            </TabButton>
            <TabButton active={tab === "sales_history"} onClick={() => setTab("sales_history")}>
              Sales History
            </TabButton>
            <TabButton active={tab === "listings"} onClick={() => setTab("listings")}>
              Listings
            </TabButton>
          </div>

          <div className="mt-4">
            {tab === "Item Information" && (
              <ItemDescription catalogItemId={catalogItemId} isAdmin={isAdmin} />
            )}

            {tab === "variants" && <ItemVariantsTab catalogItemId={catalogItemId} />}
            {tab === "reviews" && <ItemReviewsTab catalogItemId={catalogItemId} />}
            {tab === "sales_history" && (
              <ItemSalesHistoryTab catalogItemId={catalogItemId} selectedConditionJson={conditionValues} />
            )}

            {tab === "listings" && (
              <ItemListingsTab
                catalogItemId={catalogItemId}
                categoryName={category?.name ?? null}
                itemName={displayName}
                userId={userId}
                onRequireAuth={() => setAuthOpen(true)}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
