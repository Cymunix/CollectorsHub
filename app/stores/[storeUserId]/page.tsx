// app/stores/[storeUserId]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/lib/useUserProfile";

type StoreTab = "listings" | "inventory" | "insights" | "about";

type StoreProfile = {
  id: string;
  username: string | null;
  role: string | null;
  profile_picture_url: string | null;
};

type ListingCard = {
  id: string;
  catalog_item_id: string;
  title: string;
  price_cad: number | null;
  photo_url: string | null;
  status: string | null;
  created_at: string | null;
};

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-full border text-[12px] font-semibold transition",
        active ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-gray-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function StoreBadge({ role }: { role: string }) {
  const label = role === "pawn" ? "Pawn Store" : "Store";
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700">
      {label}
    </span>
  );
}

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();

  // ✅ FIX: folder is [storeUserId], so params key is storeUserId
  const storeId = String((params as any)?.storeUserId ?? "");

  const { user, loading: profileLoading } = useUserProfile() as any;

  const [tab, setTab] = useState<StoreTab>("listings");

  const [storeLoading, setStoreLoading] = useState(true);
  const [storeErr, setStoreErr] = useState<string | null>(null);
  const [store, setStore] = useState<StoreProfile | null>(null);

  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsErr, setListingsErr] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingCard[]>([]);

  // ✅ NEW: search query for Listings tab
  const [listingQuery, setListingQuery] = useState("");

  const loadStore = async () => {
    if (!storeId) {
      setStoreLoading(false);
      setStoreErr("Missing store id in route.");
      return;
    }

    setStoreLoading(true);
    setStoreErr(null);

    try {
      const res = await supabase
        .from("profiles")
        .select("id,username,role,profile_picture_url")
        .eq("id", storeId)
        .maybeSingle();

      if (res.error) throw res.error;

      const d = res.data as any;
      if (!d?.id) {
        setStore(null);
        setStoreErr("Store not found.");
        return;
      }

      setStore({
        id: String(d.id),
        username: d.username ?? null,
        role: d.role ?? null,
        profile_picture_url: d.profile_picture_url ?? null,
      });
    } catch (e: any) {
      console.error(e);
      setStoreErr(e?.message || "Failed to load store profile.");
      setStore(null);
    } finally {
      setStoreLoading(false);
    }
  };

  const loadListings = async () => {
    if (!storeId) {
      setListingsLoading(false);
      setListingsErr("Missing store id in route.");
      return;
    }

    setListingsLoading(true);
    setListingsErr(null);

    try {
      // marketplace_listings uses seller_user_id
      const res = await supabase
        .from("marketplace_listings")
        .select("id,catalog_item_id,title,price_cad,photo_url,status,created_at")
        .eq("seller_user_id", storeId)
        .order("created_at", { ascending: false });

      if (res.error) throw res.error;

      setListings((res.data ?? []) as ListingCard[]);
    } catch (e: any) {
      console.error(e);
      setListingsErr(e?.message || "Failed to load store listings.");
      setListings([]);
    } finally {
      setListingsLoading(false);
    }
  };

  useEffect(() => {
    if (!profileLoading && !user) router.push("/");
  }, [profileLoading, user, router]);

  useEffect(() => {
    loadStore();
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const storeName = useMemo(() => {
    return String(store?.username ?? "Store").trim() || "Store";
  }, [store]);

  const storeRole = useMemo(() => {
    return String(store?.role ?? "store");
  }, [store]);

  const storeLogo = useMemo(() => {
    const v = store?.profile_picture_url ?? null;
    return v ? String(v) : null;
  }, [store]);

  // ✅ NEW: filtered listings based on search query
  const filteredListings = useMemo(() => {
    const q = listingQuery.trim().toLowerCase();
    if (!q) return listings;

    return listings.filter((l) => {
      const title = String(l.title ?? "").toLowerCase();
      return title.includes(q);
    });
  }, [listings, listingQuery]);

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A]">
      <Header />
      <SecondaryNav />

      <div className="px-6 py-6">
        <button
          type="button"
          onClick={() => router.push("/stores")}
          className="text-xs text-blue-600 hover:underline mb-3"
        >
          ← Back to stores
        </button>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          {storeLoading ? (
            <p className="text-sm text-gray-500">Loading store…</p>
          ) : storeErr ? (
            <p className="text-sm text-red-600">{storeErr}</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#EEF2F7] overflow-hidden flex items-center justify-center">
                {storeLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storeLogo} alt={storeName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-500">Logo</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold truncate">{storeName}</h1>
                  <StoreBadge role={storeRole} />
                </div>

                <p className="text-[11px] text-gray-500 mt-1 truncate">Store ID: {storeId}</p>
              </div>

              <div className="text-right">
                <p className="text-[11px] text-gray-500">Listings</p>
                <p className="text-lg font-semibold">{listings.length}</p>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <TabButton active={tab === "listings"} label="Listings" onClick={() => setTab("listings")} />
            <TabButton active={tab === "inventory"} label="Inventory" onClick={() => setTab("inventory")} />
            <TabButton active={tab === "insights"} label="Insights" onClick={() => setTab("insights")} />
            <TabButton active={tab === "about"} label="About" onClick={() => setTab("about")} />
          </div>
        </div>

        <div className="mt-6">
          {tab === "listings" ? (
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              {/* ✅ NEW: Search bar for Listings tab */}
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                  <input
                    value={listingQuery}
                    onChange={(e) => setListingQuery(e.target.value)}
                    placeholder="Search listings…"
                    className="w-full rounded-2xl border bg-white px-4 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#0F172A]/10"
                  />
                  {listingQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => setListingQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-gray-500 hover:text-gray-800"
                      title="Clear"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                <div className="text-[11px] text-gray-500">
                  {listingsLoading
                    ? "Loading…"
                    : listingQuery.trim()
                      ? `Showing ${filteredListings.length} of ${listings.length}`
                      : `${listings.length} total`}
                </div>
              </div>

              {listingsLoading ? (
                <p className="text-sm text-gray-500">Loading listings…</p>
              ) : listingsErr ? (
                <p className="text-sm text-red-600">{listingsErr}</p>
              ) : listings.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
                  No listings found for this store.
                  <div className="mt-2 text-[11px] text-gray-400">
                    If you JUST created one, confirm the Store ID above matches the listing’s seller_user_id.
                  </div>
                  <button
                    type="button"
                    onClick={loadListings}
                    className="mt-4 rounded-full border bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Refresh listings
                  </button>
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
                  No listings match “{listingQuery.trim()}”.
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setListingQuery("")}
                      className="rounded-full border bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Clear search
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredListings.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => router.push(`/catalog/${l.catalog_item_id}`)}
                      className="text-left rounded-2xl border border-[#E5E9F2] bg-white shadow-sm hover:shadow-md transition overflow-hidden"
                    >
                      <div className="aspect-[4/3] bg-[#EEF2F7] flex items-center justify-center">
                        {l.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.photo_url} alt={l.title} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-500">No image</span>
                        )}
                      </div>

                      <div className="p-3">
                        <p className="text-sm font-semibold leading-tight line-clamp-2">{l.title}</p>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-gray-600">
                            {typeof l.price_cad === "number" ? `$${l.price_cad.toFixed(2)} CAD` : "—"}
                          </span>
                          <span className="text-[10px] text-gray-400">{l.status ?? ""}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : tab === "inventory" ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold">Inventory</h2>
              <div className="mt-4 rounded-xl border border-dashed p-6 text-sm text-gray-500">
                Coming soon. This section will show in-store items that may not be listed for online purchase.
              </div>
            </div>
          ) : tab === "insights" ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold">Insights</h2>
              <div className="mt-4 rounded-xl border border-dashed p-6 text-sm text-gray-500">Coming soon.</div>
            </div>
          ) : (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold">About</h2>
              <div className="mt-4 rounded-xl border border-dashed p-6 text-sm text-gray-500">Coming soon.</div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
