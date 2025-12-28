// app/stores/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/lib/useUserProfile";

type StoreType = "pawn" | "retail";
type TabKey = "all" | "followed";

type StoreRow = {
  id: string; // profiles.id
  username: string;
  role: "store" | "pawn";
  profile_picture_url: string | null;
};

function StoreBadge({ role }: { role: "store" | "pawn" }) {
  const label = role === "pawn" ? "Pawn Store" : "Store";
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700">
      {label}
    </span>
  );
}

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

function getUserKey(user: any) {
  const id = user?.userId ?? user?.id ?? user?.uid ?? null;
  return id ? String(id) : "anon";
}

export default function StoresPage() {
  const router = useRouter();

  const { user, loading: profileLoading } = useUserProfile() as any;
  const userKey = getUserKey(user);

  const [tab, setTab] = useState<TabKey>("all");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<StoreRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | StoreType>("all");

  // NEW: dedicated store search (not tied to header search)
  const [storeSearch, setStoreSearch] = useState("");

  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const LS_KEY = `ch_followed_stores_${userKey}`;

  const loadFollowed = () => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
      if (!raw) return setFollowedIds([]);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setFollowedIds(parsed.map(String));
      else setFollowedIds([]);
    } catch {
      setFollowedIds([]);
    }
  };

  const saveFollowed = (ids: string[]) => {
    setFollowedIds(ids);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, JSON.stringify(ids));
    } catch {
      // ignore
    }
  };

  const toggleFollow = (storeId: string) => {
    const exists = followedIds.includes(storeId);
    const next = exists ? followedIds.filter((id) => id !== storeId) : [storeId, ...followedIds];
    saveFollowed(next);
  };

  const loadStores = async () => {
    setLoading(true);
    setErr(null);

    try {
      const res = await supabase
        .from("profiles")
        .select("id,username,role,profile_picture_url")
        .in("role", ["store", "pawn"])
        .order("username");

      if (res.error) throw res.error;

      const raw = (res.data ?? []) as any[];

      const stores: StoreRow[] = raw
        .map((r) => ({
          id: String(r.id),
          username: String(r.username ?? "Store").trim() || "Store",
          role: r.role === "pawn" ? "pawn" : "store",
          profile_picture_url: r.profile_picture_url ? String(r.profile_picture_url) : null,
        }))
        .filter((s) => Boolean(s.id));

      setRows(stores);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Failed to load stores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profileLoading && !user) router.push("/");
  }, [profileLoading, user, router]);

  useEffect(() => {
    loadFollowed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LS_KEY]);

  useEffect(() => {
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();

    let list = rows ?? [];

    if (tab === "followed") {
      list = list.filter((s) => followedIds.includes(s.id));
    }

    return list.filter((s) => {
      const mappedType: StoreType = s.role === "pawn" ? "pawn" : "retail";
      if (typeFilter !== "all" && mappedType !== typeFilter) return false;

      if (q) {
        const hay = [s.username, s.role].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [rows, typeFilter, tab, followedIds, storeSearch]);

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A]">
      <Header />
      <SecondaryNav />

      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">Stores</h1>
            <p className="text-xs text-gray-500">Browse shops and pawn stores on the marketplace.</p>

            <div className="mt-3 flex items-center gap-2">
              <TabButton active={tab === "all"} label="All Stores" onClick={() => setTab("all")} />
              <TabButton
                active={tab === "followed"}
                label={`Followed (${followedIds.length})`}
                onClick={() => setTab("followed")}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              placeholder="Search stores…"
              className="w-56 rounded-full border bg-white px-4 py-2 text-xs text-gray-700 placeholder-gray-400"
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-full border bg-white px-3 py-2 text-xs text-gray-700"
            >
              <option value="all">All</option>
              <option value="retail">Stores</option>
              <option value="pawn">Pawn Stores</option>
            </select>

            <button
              type="button"
              onClick={loadStores}
              className="rounded-full border bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Loading stores…</p>
          </div>
        ) : err ? (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-red-600">{err}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
              {tab === "followed"
                ? storeSearch
                  ? "No followed stores match your search."
                  : "You aren’t following any stores yet."
                : storeSearch
                  ? "No stores match your search."
                  : "No stores found."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map((s) => {
              const isFollowing = followedIds.includes(s.id);

              return (
                <div
                  key={s.id}
                  className="rounded-2xl border bg-white shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/stores/${s.id}`)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3 p-4">
                      <div className="h-12 w-12 rounded-xl bg-[#EEF2F7] overflow-hidden flex items-center justify-center">
                        {s.profile_picture_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.profile_picture_url} alt={s.username} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-500">Logo</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold truncate">{s.username}</p>
                          <StoreBadge role={s.role} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">View listings</p>
                      </div>
                    </div>
                  </button>

                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation(); // critical: don't open store
                        toggleFollow(s.id);
                      }}
                      className={[
                        "w-full rounded-xl border px-3 py-2 text-[11px] font-semibold",
                        isFollowing
                          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-[#E5E9F2] bg-white text-gray-700 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
