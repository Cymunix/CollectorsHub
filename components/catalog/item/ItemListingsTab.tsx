// components/catalog/item/ItemListingsTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  deriveConditionMeta,
  getDealBadge,
  getFairValue,
  type DealBadge,
  type ConditionMeta,
} from "@/lib/pricingEngine";

type MarketplaceListing = {
  id: string;
  created_at: string;
  seller_user_id: string | null;
  catalog_item_id: string;
  user_collection_item_id: string | null;
  title: string | null;
  description: string | null;
  price_cad: number | null;
  photo_url: string | null;
  condition_json: Record<string, any> | null;
  status: string | null;
};

type CartItem = {
  listing_id: string;
  catalog_item_id: string;
  title: string;
  price_cad: number | null;
  photo_url: string | null;
  qty: number;
  added_at: string;
};

const CART_KEY = "collectorshub_cart_v1";
const readCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const writeCart = (items: CartItem[]) => localStorage.setItem(CART_KEY, JSON.stringify(items));

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function money(value: number | string | null | undefined, currency: string = "CAD") {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function normalizeFairValueResult(raw: any): { value: number | null } {
  if (typeof raw === "number" && Number.isFinite(raw)) return { value: raw };
  if (raw && typeof raw === "object" && typeof raw.value === "number" && Number.isFinite(raw.value))
    return { value: raw.value };
  return { value: null };
}

/**
 * Local replacement for removed pricingEngine.formatCondition(meta)
 * Returns { title, chips } for UI.
 */
function formatConditionView(meta: ConditionMeta | null | undefined): { title: string; chips: string[] } {
  const m: any = meta ?? {};
  const chips: string[] = [];

  // New meta model (status/flags) — preferred
  const statusRaw = String(m.status ?? m.state ?? "").trim(); // tolerate older "state"
  const flagsRaw = Array.isArray(m.flags) ? m.flags : [];

  const status =
    statusRaw === "sealed" ||
    statusRaw === "complete" ||
    statusRaw === "incomplete" ||
    statusRaw === "for_parts" ||
    statusRaw === "open_complete" ||
    statusRaw === "open_incomplete" ||
    statusRaw === "loose"
      ? statusRaw
      : "";

  const title =
    status === "sealed"
      ? "New & Sealed"
      : status === "complete" || status === "open_complete"
      ? "Complete"
      : status === "incomplete" || status === "open_incomplete"
      ? "Incomplete"
      : status === "for_parts"
      ? "For Parts"
      : status === "loose"
      ? "Loose"
      : "Unknown";

  for (const f of flagsRaw) {
    const s = String(f).trim();
    if (!s) continue;
    if (s === "for_parts") continue;
    chips.push(s.replaceAll("_", " "));
  }

  // Some metas also include a grade (mint/good/etc). Show it as a chip.
  const gradeRaw = String(m.grade ?? "").trim();
  if (gradeRaw) chips.unshift(gradeRaw.replaceAll("_", " "));

  // Dedupe
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of chips) {
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }

  return { title, chips: out };
}

function DealBadgePill({ badge }: { badge: DealBadge }) {
  const tooltip = "Compared to recent condition-adjusted market value.";

  // If DealBadge.color is not a literal union, TS can complain. This keeps it safe.
  const color = String((badge as any)?.color ?? "gray") as "green" | "blue" | "red" | "gray";

  const stylesByColor: Record<"green" | "blue" | "red" | "gray", string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    red: "border-red-200 bg-red-50 text-red-700",
    gray: "border-[#E5E9F2] bg-[#F8FAFC] text-[#475569]",
  };

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        stylesByColor[color]
      }`}
    >
      {String((badge as any)?.label ?? "Deal")}
    </span>
  );
}

function MiniTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition ${
        active
          ? "bg-[#0F172A] text-white border-[#0F172A]"
          : "bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F8FAFC]"
      }`}
    >
      {children}
    </button>
  );
}

function buildQueries(itemName: string) {
  const q = (itemName || "").trim();
  const query = q.length ? q : "collectible";
  const enc = encodeURIComponent(query);

  return {
    ebay: `https://www.ebay.ca/sch/i.html?_nkw=${enc}`,
    bricklink: `https://www.bricklink.com/v2/search.page?q=${enc}`,
    google: `https://www.google.com/search?q=${enc}`,
    facebook: `https://www.facebook.com/marketplace/search/?query=${enc}`,
  };
}

function LinkRow({ label, href, sub }: { label: string; href: string; sub?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 hover:bg-[#F8FAFC]"
    >
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-[#0F172A]">{label}</div>
        {sub ? <div className="text-[11px] text-[#64748B] truncate">{sub}</div> : null}
      </div>
      <div className="text-[12px] text-[#64748B]">↗</div>
    </a>
  );
}

function ConditionLine({ condition_json }: { condition_json: Record<string, any> | null }) {
  const meta: ConditionMeta = useMemo(() => deriveConditionMeta(condition_json), [condition_json]);
  const view = useMemo(() => formatConditionView(meta), [meta]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-[#64748B]">Condition •</span>
      <span className="text-[11px] font-semibold text-[#0F172A]">{view.title}</span>
      {view.chips.slice(0, 3).map((c) => (
        <span
          key={c}
          className="inline-flex items-center rounded-full border border-[#E5E9F2] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-semibold text-[#475569]"
        >
          {c}
        </span>
      ))}
      {view.chips.length > 3 ? (
        <span className="text-[10px] font-semibold text-[#94A3B8]">+{view.chips.length - 3}</span>
      ) : null}
    </div>
  );
}

export default function ItemListingsTab({
  catalogItemId,
  categoryName,
  itemName,
  userId,
  onRequireAuth,
}: {
  catalogItemId: string;
  categoryName: string | null;
  itemName: string;
  userId: string | null;
  onRequireAuth: () => void;
}) {
  const [listingsTab, setListingsTab] = useState<"ch" | "external" | "local">("ch");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc">("newest");

  const [marketCurrent, setMarketCurrent] = useState<number | null>(null);
  const [market30DayAvg, setMarket30DayAvg] = useState<number | null>(null);
  const [avgCH, setAvgCH] = useState<number | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);

      const { data } = await supabase
        .from("marketplace_sales")
        .select("sale_price_cad, sale_at")
        .eq("catalog_item_id", catalogItemId)
        .not("sale_price_cad", "is", null)
        .order("sale_at", { ascending: false });

      if (cancelled) return;

      if (!data || data.length === 0) {
        setMarketCurrent(null);
        setMarket30DayAvg(null);
        setAvgCH(null);
        return;
      }

      const rows = data
        .map((r: any) => ({
          price: typeof r.sale_price_cad === "number" ? r.sale_price_cad : Number(r.sale_price_cad),
          at: r.sale_at ? new Date(r.sale_at) : null,
        }))
        .filter((r: any) => Number.isFinite(r.price) && r.at instanceof Date && !isNaN(r.at.getTime()));

      if (!rows.length) {
        setMarketCurrent(null);
        setMarket30DayAvg(null);
        setAvgCH(null);
        return;
      }

      const prices = rows.map((r: any) => r.price);
      setMarketCurrent(rows[0].price);

      const last30 = rows.filter((r: any) => r.at >= since30).map((r: any) => r.price);
      const avg30 = last30.length ? last30.reduce((a: number, b: number) => a + b, 0) / last30.length : null;
      const avgAll = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;

      setMarket30DayAvg(avg30);
      setAvgCH(avgAll);
    };

    if (catalogItemId) loadStats();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const baseMarketPrice = useMemo(() => {
    const v = market30DayAvg ?? avgCH ?? marketCurrent ?? null;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }, [market30DayAvg, avgCH, marketCurrent]);

  const load = async () => {
    if (!catalogItemId) return;
    setLoading(true);
    setErr(null);

    try {
      let q = supabase
        .from("marketplace_listings")
        .select(
          "id,created_at,seller_user_id,catalog_item_id,user_collection_item_id,title,description,price_cad,photo_url,condition_json,status"
        )
        .eq("catalog_item_id", catalogItemId)
        .eq("status", "active");

      if (sort === "newest") q = q.order("created_at", { ascending: false });
      if (sort === "price_asc") q = q.order("price_cad", { ascending: true, nullsFirst: false });
      if (sort === "price_desc") q = q.order("price_cad", { ascending: false, nullsFirst: false });

      const res = await q.limit(50);
      if (res.error) throw res.error;
      setListings((res.data ?? []) as MarketplaceListing[]);
    } catch (e: any) {
      console.error(e);
      setListings([]);
      setErr(e?.message || "Could not load marketplace listings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (listingsTab !== "ch") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId, sort, listingsTab]);

  const handleBuyNow = (l: MarketplaceListing) => {
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (l.seller_user_id && l.seller_user_id === userId) {
      setToast("You can’t purchase your own listing.");
      return;
    }

    const cart = readCart();
    const idx = cart.findIndex((x) => x.listing_id === l.id);

    if (idx >= 0) cart[idx].qty += 1;
    else
      cart.push({
        listing_id: l.id,
        catalog_item_id: l.catalog_item_id,
        title: l.title ?? itemName ?? "Item",
        price_cad: l.price_cad ?? null,
        photo_url: l.photo_url ?? null,
        qty: 1,
        added_at: new Date().toISOString(),
      });

    writeCart(cart);
    setToast(`Added to cart: ${l.title ?? itemName}`);
  };

  const q = useMemo(() => buildQueries(itemName), [itemName]);

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden flex flex-col flex-1 min-h-[420px]">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Available Listings</div>
        <div className="flex items-center gap-2">
          <MiniTab active={listingsTab === "ch"} onClick={() => setListingsTab("ch")}>
            CollectorsHub
          </MiniTab>
          <MiniTab active={listingsTab === "external"} onClick={() => setListingsTab("external")}>
            External
          </MiniTab>
          <MiniTab active={listingsTab === "local"} onClick={() => setListingsTab("local")}>
            Local
          </MiniTab>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-auto">
        {toast ? (
          <div className="mb-3 rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A]">
            {toast}
          </div>
        ) : null}

        {listingsTab === "external" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#E5E9F2] bg-white p-3">
              <div className="text-sm font-semibold text-[#0F172A]">Buy externally</div>
              <div className="mt-1 text-[11px] text-[#64748B]">
                These links search the web for <span className="font-semibold text-[#0F172A]">{safeText(itemName)}</span>.
              </div>
            </div>

            <LinkRow label="eBay" href={q.ebay} sub="Search listings on eBay" />
            <LinkRow label="BrickLink" href={q.bricklink} sub="Search on BrickLink marketplace" />
            <LinkRow label="Facebook Marketplace" href={q.facebook} sub="Search locally on Facebook Marketplace" />
            <LinkRow label="Google" href={q.google} sub="General web search" />
          </div>
        ) : listingsTab === "local" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#E5E9F2] bg-white p-4">
              <div className="text-sm font-semibold text-[#0F172A]">Local listings</div>
              <div className="mt-1 text-[11px] text-[#64748B]">
                Local results will show nearby store inventory and events once store locations + radius filtering are wired.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[#0F172A] text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-black"
                  onClick={() => (window.location.href = "/stores")}
                >
                  Browse Stores
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[#E5E9F2] bg-white px-3 py-1.5 text-[11px] font-semibold hover:bg-[#F8FAFC]"
                  onClick={() => setToast("Tip: follow stores to see their posts in your feed (coming next).")}
                >
                  How this will work
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-[#E5E9F2] bg-white p-8 text-center text-[12px] text-[#64748B]">
              No local inventory sources connected yet.
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-[11px] text-[#64748B]">Showing active listings for this item.</div>

              <div className="flex items-center gap-2">
                <select
                  className="rounded-lg border border-[#E5E9F2] bg-white px-2 py-1.5 text-[11px]"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                </select>

                <button
                  type="button"
                  onClick={load}
                  className="rounded-lg border border-[#E5E9F2] bg-white px-3 py-1.5 text-[11px] font-semibold hover:bg-[#F8FAFC]"
                >
                  Refresh
                </button>
              </div>
            </div>

            {err ? <div className="mb-3 text-xs text-red-600">{err}</div> : null}

            {loading ? (
              <div className="text-xs text-[#64748B]">Loading…</div>
            ) : listings.length === 0 ? (
              <div className="text-xs text-[#64748B]">No active listings yet.</div>
            ) : (
              <div className="space-y-3">
                {listings.map((l) => {
                  const listingPrice =
                    typeof l.price_cad === "number" ? l.price_cad : l.price_cad === null ? null : Number(l.price_cad);

                  const fairRaw =
                    baseMarketPrice == null
                      ? null
                      : getFairValue({
                          baseMarketPrice,
                          condition_json: l.condition_json,
                        });

                  const fair = normalizeFairValueResult(fairRaw);

                  const badge =
                    listingPrice != null && fair.value != null
                      ? getDealBadge({ listingPrice, fairValue: fair.value })
                      : null;

                  return (
                    <div key={l.id} className="rounded-xl border border-[#E5E9F2] bg-white p-3">
                      <div className="flex items-start gap-3">
                        <div className="h-14 w-14 rounded-lg border border-[#E5E9F2] bg-[#F8FAFC] overflow-hidden flex items-center justify-center shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {l.photo_url ? (
                            <img
                              src={l.photo_url}
                              alt={safeText(l.title ?? itemName)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="text-[10px] text-[#94A3B8]">No photo</div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#0F172A] truncate">
                                {safeText(l.title ?? itemName)}
                              </div>

                              <div className="mt-1 flex items-center gap-2">
                                <ConditionLine condition_json={l.condition_json} />
                                {badge ? <DealBadgePill badge={badge} /> : null}
                              </div>
                            </div>

                            <div className="text-sm font-bold text-[#0F172A] shrink-0">{money(l.price_cad)}</div>
                          </div>

                          <div className="mt-0.5 text-[11px] text-[#94A3B8]">
                            {l.created_at ? `listed • ${new Date(l.created_at).toLocaleDateString()}` : ""}
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-[#0F172A] text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-black"
                              onClick={() => handleBuyNow(l)}
                            >
                              Buy Now
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-[#E5E9F2] bg-white px-3 py-1.5 text-[11px] font-semibold hover:bg-[#F8FAFC]"
                              onClick={() => setToast("Messaging isn’t wired yet.")}
                            >
                              Message Seller
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
