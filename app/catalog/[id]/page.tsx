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
      .then((r) => setIsAdmin(r.data?.role === "admin"));
  }, [userId]);

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
          <h1 className="text-2xl font-semibold">{displayName}</h1>

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
              <ItemSalesHistoryTab
                catalogItemId={catalogItemId}
                selectedConditionJson={conditionValues}
              />
            )}
            {tab === "listings" && (
              <ItemListingsTab
                catalogItemId={catalogItemId}
                categoryName={category?.name ?? null}
                itemName={displayName}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
