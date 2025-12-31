"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { QuickAddDefault } from "@/lib/catalog/types";

type WishlistPriority = "low" | "medium" | "high";
type CollectionVisibility = "private" | "public";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function useQuickAddPreference() {
  const [loading, setLoading] = useState(true);

  // Quick add mode
  const [value, setValue] = useState<QuickAddDefault>("collection");

  // ✅ Defaults from PreferencesTab / profiles columns
  const [defaultConditionTier10, setDefaultConditionTier10] = useState<number>(8);
  const [defaultConditionScore100, setDefaultConditionScore100] = useState<number>(80); // tier10 * 10
  const [defaultQuantity, setDefaultQuantity] = useState<number>(1);
  const [defaultWishlistPriority, setDefaultWishlistPriority] = useState<WishlistPriority>("medium");
  const [defaultCollectionVisibility, setDefaultCollectionVisibility] = useState<CollectionVisibility>("private");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const userId = data.user?.id ?? null;

        if (!userId) {
          if (!cancelled) {
            // logged out fallback
            setValue("collection");
            setDefaultConditionTier10(8);
            setDefaultConditionScore100(80);
            setDefaultQuantity(1);
            setDefaultWishlistPriority("medium");
            setDefaultCollectionVisibility("private");
            setLoading(false);
          }
          return;
        }

        // Pull everything we need (some cols may not exist yet)
        const res = await supabase
          .from("profiles")
          .select(
            "quick_add_default,default_condition_score,default_quantity,default_wishlist_priority,default_collection_visibility"
          )
          .eq("id", userId)
          .maybeSingle();

        if (cancelled) return;

        // ----- quick add default -----
        const vRaw = (res.data as any)?.quick_add_default;
        const v = String(vRaw ?? "").trim();
        if (v === "wishlist" || v === "collection" || v === "both" || v === "ask") {
          setValue(v);
        } else {
          setValue("collection");
        }

        // ----- condition default (stored as 1–10 in profiles) -----
        const dcsRaw = Number((res.data as any)?.default_condition_score);
        const tier10 = Number.isFinite(dcsRaw) ? clamp(Math.round(dcsRaw), 1, 10) : 8;
        setDefaultConditionTier10(tier10);
        setDefaultConditionScore100(tier10 * 10);

        // ----- quantity default -----
        const dqRaw = Number((res.data as any)?.default_quantity);
        const qty = Number.isFinite(dqRaw) ? clamp(Math.round(dqRaw), 1, 999) : 1;
        setDefaultQuantity(qty);

        // ----- wishlist priority -----
        const pr = String((res.data as any)?.default_wishlist_priority ?? "medium").trim().toLowerCase();
        setDefaultWishlistPriority(pr === "low" || pr === "high" ? (pr as any) : "medium");

        // ----- collection visibility -----
        const vis = String((res.data as any)?.default_collection_visibility ?? "private").trim().toLowerCase();
        setDefaultCollectionVisibility(vis === "public" ? "public" : "private");

        setLoading(false);
      } catch {
        if (!cancelled) {
          // fallback if columns don't exist or query fails
          setValue("collection");
          setDefaultConditionTier10(8);
          setDefaultConditionScore100(80);
          setDefaultQuantity(1);
          setDefaultWishlistPriority("medium");
          setDefaultCollectionVisibility("private");
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading,
    value,

    // ✅ expose defaults for quick add
    defaultConditionTier10,
    defaultConditionScore100,
    defaultQuantity,
    defaultWishlistPriority,
    defaultCollectionVisibility,
  };
}
