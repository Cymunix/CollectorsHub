// app/settings/tabs/PreferencesTab.tsx
"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/lib/theme";
import type { ConditionMeta } from "@/lib/pricingEngine";

type UserShape = { userId: string };

type ConditionState = "sealed" | "open_complete" | "open_incomplete" | "loose";
type ConditionGrade = "mint" | "excellent" | "good" | "fair" | "poor";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function safeJsonParse(v: any): any | null {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function normalizeConditionMeta(v: any): ConditionMeta {
  const obj = safeJsonParse(v) ?? v;

  const stateRaw = String(obj?.state ?? "open_complete").trim();
  const gradeRaw = String(obj?.grade ?? "good").trim();
  const flagsRaw = obj?.flags;

  const state: ConditionState =
    stateRaw === "sealed" || stateRaw === "open_complete" || stateRaw === "open_incomplete" || stateRaw === "loose"
      ? (stateRaw as ConditionState)
      : "open_complete";

  const grade: ConditionGrade =
    gradeRaw === "mint" || gradeRaw === "excellent" || gradeRaw === "good" || gradeRaw === "fair" || gradeRaw === "poor"
      ? (gradeRaw as ConditionGrade)
      : "good";

  const flags = Array.isArray(flagsRaw) ? flagsRaw.map((x: any) => String(x)).filter(Boolean) : [];

  return { state, grade, flags };
}

/**
 * Display-only mapping (1–10) from meta.
 * This is just to keep the old UI (dropdown) simple.
 */
function metaToTier10(meta: ConditionMeta): number {
  const baseByGrade: Record<string, number> = {
    mint: 10,
    excellent: 9,
    good: 8,
    fair: 6,
    poor: 4,
  };

  let t = baseByGrade[String(meta?.grade ?? "")] ?? 8;

  if (meta?.state === "sealed") t = Math.min(10, t + 1);
  if (meta?.state === "open_incomplete") t = Math.max(1, t - 1);
  if (meta?.state === "loose") t = Math.max(1, t - 1);

  return clamp(Math.round(t), 1, 10);
}

/**
 * Tier10 -> meta fallback (when only old column exists)
 */
function tier10ToMeta(tier10: number): ConditionMeta {
  const t = clamp(Math.round(Number(tier10) || 8), 1, 10);

  // Keep this conservative: default to open_complete
  // Only grade changes with tier.
  const grade: ConditionGrade =
    t >= 10 ? "mint" : t >= 9 ? "excellent" : t >= 7 ? "good" : t >= 5 ? "fair" : "poor";

  return { state: "open_complete", grade, flags: [] };
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

  // PATH 2 default condition (stored as meta JSON)
  const [defaultConditionMeta, setDefaultConditionMeta] = useState<ConditionMeta>({
    state: "open_complete",
    grade: "good",
    flags: [],
  });

  // Keep the old UI: 1–10 dropdown
  const defaultConditionTier10 = useMemo(() => metaToTier10(defaultConditionMeta), [defaultConditionMeta]);

  const [defaultQuantity, setDefaultQuantity] = useState<number>(1);
  const [defaultWishlistPriority, setDefaultWishlistPriority] = useState<"low" | "medium" | "high">("medium");
  const [defaultCollectionVisibility, setDefaultCollectionVisibility] = useState<"private" | "public">("private");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setStatus(null);

      // Try new column first; fallback to old.
      const res1 = await supabase
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
          default_condition_meta,
          default_quantity,
          default_wishlist_priority,
          default_collection_visibility
        `
        )
        .eq("id", user.userId)
        .maybeSingle();

      if (cancelled) return;

      if (res1.error) {
        console.error("Preferences load error:", res1.error);
        setStatus("Error: Could not load preferences.");
        setLoading(false);
        return;
      }

      const data: any = res1.data ?? {};

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

      // Preferred: meta
      if (data?.default_condition_meta) {
        setDefaultConditionMeta(normalizeConditionMeta(data.default_condition_meta));
      } else {
        // Fallback: old numeric tier
        const res2 = await supabase
          .from("profiles")
          .select("default_condition_score")
          .eq("id", user.userId)
          .maybeSingle();

        if (!res2.error) {
          const t = clamp(Math.round(Number((res2.data as any)?.default_condition_score) || 8), 1, 10);
          setDefaultConditionMeta(tier10ToMeta(t));
        }
      }

      const dq = Number(data?.default_quantity);
      setDefaultQuantity(Number.isFinite(dq) ? clamp(Math.round(dq), 1, 999) : 1);

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

        // ✅ PATH 2: store meta JSON, not score
        default_condition_meta: defaultConditionMeta,

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

        {/* Quick Add Defaults */}
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
                onChange={(e) => {
                  const tier = clamp(Math.round(Number(e.target.value) || 8), 1, 10);
                  // keep UI simple: selecting tier updates meta grade (and keeps state)
                  const grade: ConditionGrade =
                    tier >= 10 ? "mint" : tier >= 9 ? "excellent" : tier >= 7 ? "good" : tier >= 5 ? "fair" : "poor";
                  setDefaultConditionMeta((m) => ({
                    state: (m?.state ?? "open_complete") as ConditionState,
                    grade,
                    flags: Array.isArray(m?.flags) ? m.flags : [],
                  }));
                }}
                className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              <div className="mt-2 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                Stored as meta: <span className="font-semibold">{defaultConditionMeta.state}</span> •{" "}
                <span className="font-semibold">{defaultConditionMeta.grade}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">Default Quantity</label>
              <input
                type="number"
                min={1}
                max={999}
                value={defaultQuantity}
                onChange={(e) => setDefaultQuantity(clamp(Number(e.target.value) || 1, 1, 999))}
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
