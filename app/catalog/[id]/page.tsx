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

type TabKey = "Item Information" | "variants" | "reviews" | "sales_history" | "listings";

type CatalogItem = {
  id: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;
  upc: string | null;
  release_year: number | null;
  version?: string | null;
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

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

// Renders stars based on avg. Always returns 5 glyphs.
// Uses ★ for filled and ☆ for empty. No half-star; we round to nearest 0.1 for text.
function Stars({ avg }: { avg: number }) {
  const clamped = Math.max(0, Math.min(5, avg));
  const filled = Math.round(clamped); // visual: nearest whole star
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

export default function Page({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const kindParam = (sp.get("kind") || "").toLowerCase();
  const preferMinifig = kindParam === "minifig";

  const catalogItemId = params?.id;

  const [tab, setTab] = useState<TabKey>("Item Information");

  const [authOpen, setAuthOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Minimal header data only
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [headerErr, setHeaderErr] = useState<string | null>(null);

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [minifigItem, setMinifigItem] = useState<MinifigItem | null>(null);
  const isMinifigPage = !!minifigItem;

  const [category, setCategory] = useState<Category | null>(null);
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [franchise, setFranchise] = useState<Franchise | null>(null);

  // Reviews summary for stars beside name
  const [reviewAvg, setReviewAvg] = useState<number>(0); // 0 when none
  const [reviewCount, setReviewCount] = useState<number>(0);

  // Shared condition state
  const [conditionValues, setConditionValues] = useState<Record<string, any>>({});
  const [conditionScore, setConditionScore] = useState<number>(8);

  // Building Blocks extras
  const [bbIsSet, setBbIsSet] = useState<boolean>(false);
  const [bbIsMinifig, setBbIsMinifig] = useState<boolean>(false);
  const [bbMinifigs, setBbMinifigs] = useState<Minifig[]>([]);

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
          return;
        }

        // 2) Normal catalog_item path
        const itemRes = await supabase
          .from("catalog_items")
          .select("id,name,category_id,subcategory_id,franchise_id,upc,release_year,version")
          .eq("id", catalogItemId)
          .maybeSingle();

        if (itemRes.error) throw itemRes.error;

        if (itemRes.data) {
          const it = itemRes.data as CatalogItem;
          if (cancelled) return;

          setItem(it);

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
                const rawAvg = rows.reduce((sum: number, r: any) => sum + Number(r?.rating ?? 0), 0) / count;
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

  // ✅ IMPORTANT: Decide BB mode WITHOUT relying on bbIsSet
  // If it’s not a minifig, treat it as a SET.
  const bbMode: "set" | "minifig" = isBuildingBlocks && (isMinifigPage || bbIsMinifig) ? "minifig" : "set";

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
              {isMinifigPage && minifigItem?.minifig_number ? ` • Fig # ${minifigItem.minifig_number}` : ""}
              {!isMinifigPage && item?.upc ? ` • UPC: ${item.upc}` : ""}
              {!isMinifigPage && item?.version ? ` • ${item.version}` : ""}
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
                conditionScore={conditionScore}
              />

              {isBuildingBlocks ? (
                <ItemConditionBuildingBlocks
                  mode={bbMode}
                  catalogItemId={catalogItemId}
                  expectedMinifigs={bbMode === "set" ? bbMinifigs : []}
                  conditionValues={conditionValues}
                  conditionScore={conditionScore}
                  onChange={(nextValues, nextScore) => {
                    setConditionValues(nextValues);
                    setConditionScore(nextScore);
                  }}
                />
              ) : (
                <ItemConditionSelector
                  catalogItemId={catalogItemId}
                  categoryName={category?.name ?? null}
                  isBuildingBlocks={isBuildingBlocks}
                  isGradableCategory={isGradableCategory}
                  conditionValues={conditionValues}
                  conditionScore={conditionScore}
                  onChange={(nextValues, nextScore) => {
                    setConditionValues(nextValues);
                    setConditionScore(nextScore);
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
                seedMinifigs={bbMode === "set" ? bbMinifigs : []} // ✅ seed from bbMinifigs, not conditionValues
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex items-center gap-2 flex-wrap">
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

          {/* Tab Content */}
          <div className="mt-4 space-y-4">
            {tab === "Item Information" ? <ItemDescription catalogItemId={catalogItemId} /> : null}
            {tab === "variants" ? <ItemVariantsTab catalogItemId={catalogItemId} /> : null}
            {tab === "reviews" ? <ItemReviewsTab catalogItemId={catalogItemId} /> : null}
            {tab === "sales_history" ? (
              <ItemSalesHistoryTab
                catalogItemId={catalogItemId}
                selectedCondition={conditionValues}
                selectedConditionScore={conditionScore}
              />
            ) : null}
            {tab === "listings" ? (
              <ItemListingsTab
                catalogItemId={catalogItemId}
                categoryName={category?.name ?? null}
                itemName={isMinifigPage ? (minifigItem?.name ?? "Minifig") : (item?.name ?? "Item")}
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
