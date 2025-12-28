"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";

/* ============================== Types ============================== */

type CartItem = {
  listing_id: string;
  catalog_item_id: string;
  title: string;
  price_cad: number | null;
  photo_url: string | null;
  added_at: string;
  qty: number;
};

const CART_KEY = "collectorshub_cart_v1";

/* ============================== Storage Helpers ============================== */

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function moneyCad(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  if (!Number.isFinite(n)) return "—";

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(n);
}

/* ============================== Page ============================== */

export default function CartPage() {
  const router = useRouter();

  const [authOpen, setAuthOpen] = useState(false);

  const [items, setItems] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    setItems(readCart());
  }, []);

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const price = typeof it.price_cad === "number" ? it.price_cad : Number(it.price_cad ?? 0);
      const safePrice = Number.isFinite(price) ? price : 0;
      const qty = typeof it.qty === "number" ? it.qty : 1;
      return sum + safePrice * qty;
    }, 0);
  }, [items]);

  const totalQty = useMemo(() => {
    return items.reduce((a, it) => a + (typeof it.qty === "number" ? it.qty : 1), 0);
  }, [items]);

  const updateQty = (listingId: string, qty: number) => {
    const next = items.map((it) => {
      if (it.listing_id !== listingId) return it;
      const safeQty = Math.max(1, Math.min(99, Math.trunc(Number(qty) || 1)));
      return { ...it, qty: safeQty };
    });

    setItems(next);
    writeCart(next);
  };

  const removeItem = (listingId: string) => {
    const next = items.filter((it) => it.listing_id !== listingId);
    setItems(next);
    writeCart(next);
  };

  const clearCart = () => {
    setItems([]);
    writeCart([]);
  };

  const handleCheckout = async () => {
    setBanner(null);

    try {
      if (items.length === 0) return;

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr) throw authErr;

      if (!user) {
        setAuthOpen(true);
        return;
      }

      setCheckingOut(true);

      // NOTE: For now, qty is ignored; each listing_id is purchased once.
      const listingIds = items
        .map((it) => it.listing_id)
        .filter((id) => typeof id === "string" && id.length > 0);

      if (listingIds.length === 0) {
        setBanner({ type: "err", msg: "Your cart items are missing listing ids." });
        return;
      }

      // ✅ One server-side call that:
      // - validates listing is active
      // - blocks buying your own listing
      // - inserts marketplace_sales (price stats update)
      // - deletes seller’s collection row
      // - inserts buyer collection row
      // - deletes listing
      const { error: rpcErr } = await supabase.rpc("checkout_cart", {
        listing_ids: listingIds,
      });

      if (rpcErr) {
        console.error("checkout_cart failed:", rpcErr);
        setBanner({ type: "err", msg: rpcErr.message || "Checkout failed." });
        return;
      }

      clearCart();

      setBanner({
        type: "ok",
        msg: `Checkout complete. Purchased ${listingIds.length} listing(s).`,
      });

      router.push("/collection");
    } catch (e: any) {
      console.error(e);
      setBanner({
        type: "err",
        msg: e?.message || "Checkout failed.",
      });
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A]">
      <Header />
      <SecondaryNav />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <div className="px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Cart</h1>
            <div className="mt-1 text-xs text-[#64748B]">
              {items.length ? `${totalQty} item(s) • Subtotal ${moneyCad(subtotal)}` : "Your cart is empty."}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/catalog")}
              className="rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC]"
            >
              Continue Shopping
            </button>

            <button
              type="button"
              onClick={clearCart}
              className="rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC] disabled:opacity-60"
              disabled={items.length === 0}
            >
              Clear Cart
            </button>
          </div>
        </div>

        {banner ? (
          <div
            className={`mt-4 rounded-2xl border p-4 text-sm ${
              banner.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {banner.msg}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-8 text-center text-sm text-[#64748B]">
            Your cart is empty.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Items */}
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.listing_id} className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
                  <div className="flex gap-3">
                    <div className="h-20 w-20 rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] overflow-hidden flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.photo_url ? (
                        <img src={it.photo_url} alt={it.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-[10px] text-[#94A3B8]">No photo</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{it.title}</div>
                      <div className="mt-1 text-xs text-[#64748B]">Listing: {it.listing_id}</div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-bold">{moneyCad(it.price_cad)}</div>

                        <div className="flex items-center gap-2">
                          <div className="text-xs text-[#64748B]">Qty</div>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={it.qty ?? 1}
                            onChange={(e) => updateQty(it.listing_id, Number(e.target.value))}
                            className="w-20 rounded-lg border border-[#E5E9F2] bg-white px-2 py-1 text-xs"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeItem(it.listing_id)}
                          className="rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4 h-fit">
              <div className="text-sm font-semibold">Summary</div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Subtotal</span>
                  <span className="font-semibold">{moneyCad(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Shipping</span>
                  <span className="text-[#94A3B8]">Simulated</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Tax</span>
                  <span className="text-[#94A3B8]">Simulated</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={checkingOut || items.length === 0}
                className="mt-4 w-full rounded-xl bg-[#16A34A] px-4 py-3 text-xs font-semibold text-white hover:bg-[#15803D] disabled:opacity-60"
              >
                {checkingOut ? "Checking out…" : "Checkout"}
              </button>

              <div className="mt-2 text-[11px] text-[#94A3B8]">
                Checkout uses a server-side function to record the sale (price stats), remove the seller’s copy, add it
                to your collection, and delete the listing.
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
