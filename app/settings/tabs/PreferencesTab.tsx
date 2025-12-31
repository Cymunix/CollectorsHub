// app/settings/tabs/PreferencesTab.tsx
"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/lib/theme";

type UserShape = { userId: string };

// UI = tier10 (1–10). DB = score100 (0–100).
function clampTier10(n: any, fallback = 8) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(10, Math.round(x)));
}

function clampScore100(n: any, fallback = 80) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function tier10ToScore100(tier10: number) {
  return clampScore100(tier10 * 10, 80);
}

function score100ToTier10(score100: number) {
  return clampTier10(Math.round(score100 / 10), 8);
}

export default function PreferencesTab({ user }: { user: UserShape }) {
  const { setTheme: setAppTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [themePreference, setThemePreference] = useState<"light" | "dark">("light");
  const [currency, setCurrency] = useState<"CAD" | "USD">("CAD");

  const [emailPromotional, setEmailPromotional] = useState(false);
  const [emailMarketNews, setEmailMarketNews] = useState(false);
  const [emailSecurityAlerts, setEmailSecurityAlerts] = useState(false);
  const [emailWishlistAlerts, setEmailWishlistAlerts] = useState(false);

  const [pushPriceDrops, setPushPriceDrops] = useState(false);
  const [pushTradeOffers, setPushTradeOffers] = useState(false);
  const [pushNewFollowers, setPushNewFollowers] = useState(false);
  const [pushWishlistAlerts, setPushWishlistAlerts] = useState(false);

  // RAW-only quick add defaults (graded is NEVER defaulted)
  // UI shows 1–10, DB stores 0–100 in default_condition_score.
  const [defaultConditionTier10, setDefaultConditionTier10] = useState<number>(8);

  const [defaultQuantity, setDefaultQuantity] = useState<number>(1);
  const [defaultWishlistPriority, setDefaultWishlistPriority] = useState<"low" | "medium" | "high">("medium");
  const [defaultCollectionVisibility, setDefaultCollectionVisibility] = useState<"private" | "public">("private");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setStatus(null);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          theme,
          currency,
          email_promotional,
          email_market_news,
          email_security_alerts,
          email_wishlist_alerts,
          push_price_drops,
          push_trade_offers,
          push_new_followers,
          push_wishlist_alerts,
          default_condition_score,
          default_quantity,
          default_wishlist_priority,
          default_collection_visibility
        `
        )
        .eq("id", user.userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Preferences load error:", error);
        setStatus("Error: Could not load preferences.");
        setLoading(false);
        return;
      }

      const dbTheme = (data?.theme as string | null) ?? "light";
      const normalizedTheme: "light" | "dark" = dbTheme === "dark" ? "dark" : "light";
      setThemePreference(normalizedTheme);
      setAppTheme(normalizedTheme);

      const dbCurrency = (data?.currency as string | null) ?? "CAD";
      setCurrency(dbCurrency === "USD" ? "USD" : "CAD");

      setEmailPromotional(!!data?.email_promotional);
      setEmailMarketNews(!!data?.email_market_news);
      setEmailSecurityAlerts(!!data?.email_security_alerts);
      setEmailWishlistAlerts(!!data?.email_wishlist_alerts);

      setPushPriceDrops(!!data?.push_price_drops);
      setPushTradeOffers(!!data?.push_trade_offers);
      setPushNewFollowers(!!data?.push_new_followers);
      setPushWishlistAlerts(!!data?.push_wishlist_alerts);

      // ✅ default_condition_score in DB is now score100 (0–100)
      const dcs100 = clampScore100(data?.default_condition_score, 80);
      setDefaultConditionTier10(score100ToTier10(dcs100));

      const dq = Number(data?.default_quantity);
      setDefaultQuantity(Number.isFinite(dq) ? Math.min(999, Math.max(1, dq)) : 1);

      const pr = (data?.default_wishlist_priority as string | null) ?? "medium";
      setDefaultWishlistPriority(pr === "low" || pr === "high" ? pr : "medium");

      const vis = (data?.default_collection_visibility as string | null) ?? "private";
      setDefaultCollectionVisibility(vis === "public" ? "public" : "private");

      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user.userId, setAppTheme]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const score100 = tier10ToScore100(clampTier10(defaultConditionTier10, 8));

    const { error } = await supabase
      .from("profiles")
      .update({
        theme: themePreference,
        currency,

        email_promotional: emailPromotional,
        email_market_news: emailMarketNews,
        email_security_alerts: emailSecurityAlerts,
        email_wishlist_alerts: emailWishlistAlerts,

        push_price_drops: pushPriceDrops,
        push_trade_offers: pushTradeOffers,
        push_new_followers: pushNewFollowers,
        push_wishlist_alerts: pushWishlistAlerts,

        // ✅ store 0–100 in DB
        default_condition_score: score100,
        default_quantity: defaultQuantity,
        default_wishlist_priority: defaultWishlistPriority,
        default_collection_visibility: defaultCollectionVisibility,
      })
      .eq("id", user.userId);

    if (error) {
      console.error("Preferences save error:", error);
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus("Preferences updated.");
    }

    setSaving(false);
  };

  if (loading) {
    return <div className="mt-10 text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading preferences…</div>;
  }

  return (
    <section className="space-y-6">
      <form onSubmit={save} className="space-y-6 max-w-3xl">
        {/* Theme */}
        <div className="rounded-2xl bg-white dark:bg-[#020617] border border-[#E5E9F2] dark:border-[#1F2937] p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-2">Theme</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">Choose how CollectorsHub looks on your device.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setThemePreference("light");
                setAppTheme("light");
              }}
              className={`px-4 py-2 rounded-full text-xs font-medium border ${
                themePreference === "light"
                  ? "bg-[#2563EB] text-white border-[#2563EB]"
                  : "bg-white dark:bg-[#020617] text-[#111827] dark:text-[#E5E7EB] border-[#E5E9F2] dark:border-[#1F2937]"
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => {
                setThemePreference("dark");
                setAppTheme("dark");
              }}
              className={`px-4 py-2 rounded-full text-xs font-medium border ${
                themePreference === "dark"
                  ? "bg-[#2563EB] text-white border-[#2563EB]"
                  : "bg-white dark:bg-[#020617] text-[#111827] dark:text-[#E5E7EB] border-[#E5E9F2] dark:border-[#1F2937]"
              }`}
            >
              Dark
            </button>
          </div>
        </div>

        {/* Currency */}
        <div className="rounded-2xl bg-white dark:bg-[#020617] border border-[#E5E9F2] dark:border-[#1F2937] p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-2">Currency</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">Set your preferred currency for prices and totals.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCurrency("CAD")}
              className={`px-4 py-2 rounded-full text-xs font-medium border ${
                currency === "CAD"
                  ? "bg-[#2563EB] text-white border-[#2563EB]"
                  : "bg-white dark:bg-[#020617] text-[#111827] dark:text-[#E5E7EB] border-[#E5E9F2] dark:border-[#1F2937]"
              }`}
            >
              CAD $
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-4 py-2 rounded-full text-xs font-medium border ${
                currency === "USD"
                  ? "bg-[#2563EB] text-white border-[#2563EB]"
                  : "bg-white dark:bg-[#020617] text-[#111827] dark:text-[#E5E7EB] border-[#E5E9F2] dark:border-[#1F2937]"
              }`}
            >
              USD $
            </button>
          </div>
        </div>

        {/* Quick Add Defaults (RAW only) */}
        <div className="rounded-2xl bg-white dark:bg-[#020617] border border-[#E5E9F2] dark:border-[#1F2937] p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-2">Quick Add Defaults</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">
            These defaults apply to raw items only. Graded is never auto-selected.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
                Default Condition (1–10)
              </label>
              <select
                value={defaultConditionTier10}
                onChange={(e) => setDefaultConditionTier10(clampTier10(e.target.value, 8))}
                className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                Stored as <span className="font-semibold">0–100</span> internally ({tier10ToScore100(defaultConditionTier10)}).
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">Default Quantity</label>
              <input
                type="number"
                min={1}
                max={999}
                value={defaultQuantity}
                onChange={(e) => setDefaultQuantity(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
                Default Wishlist Priority
              </label>
              <select
                value={defaultWishlistPriority}
                onChange={(e) => setDefaultWishlistPriority(e.target.value as any)}
                className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
                Default Collection Visibility
              </label>
              <select
                value={defaultCollectionVisibility}
                onChange={(e) => setDefaultCollectionVisibility(e.target.value as any)}
                className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
        </div>

        {/* Email Preferences */}
        <div className="rounded-2xl bg-white dark:bg-[#020617] border border-[#E5E9F2] dark:border-[#1F2937] p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-2">Email Preferences</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">Choose which emails you want to receive.</p>

          <div className="space-y-2 text-sm text-[#111827] dark:text-[#E5E7EB]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailPromotional}
                onChange={(e) => setEmailPromotional(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB]"
              />
              <span>Promotional Emails</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailMarketNews}
                onChange={(e) => setEmailMarketNews(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB]"
              />
              <span>Market Newsletters</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailSecurityAlerts}
                onChange={(e) => setEmailSecurityAlerts(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB]"
              />
              <span>Security Alerts</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailWishlistAlerts}
                onChange={(e) => setEmailWishlistAlerts(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB]"
              />
              <span>Wishlist Alerts</span>
            </label>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="rounded-2xl bg-white dark:bg-[#020617] border border-[#E5E9F2] dark:border-[#1F2937] p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-2">Push Notifications</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">Control push notifications.</p>

          <div className="space-y-2 text-sm text-[#111827] dark:text-[#E5E7EB]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pushPriceDrops}
                onChange={(e) => setPushPriceDrops(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB]"
              />
              <span>Price Drops</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pushTradeOffers}
                onChange={(e) => setPushTradeOffers(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB]"
              />
              <span>Trade Offers</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pushNewFollowers}
                onChange={(e) => setPushNewFollowers(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB]"
              />
              <span>New Followers</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pushWishlistAlerts}
                onChange={(e) => setPushWishlistAlerts(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB]"
              />
              <span>Wishlist Alerts</span>
            </label>
          </div>
        </div>

        {status && (
          <div
            className={`text-xs rounded-lg px-3 py-2 border ${
              status.startsWith("Error:")
                ? "text-red-700 bg-red-50 border-red-200"
                : "text-[#065F46] bg-emerald-50 border-emerald-100"
            }`}
          >
            {status}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </form>
    </section>
  );
}
