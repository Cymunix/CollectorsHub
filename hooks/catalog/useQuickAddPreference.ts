"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { QuickAddDefault } from "@/lib/catalog/types";

type WishlistPriority = "low" | "medium" | "high";
type CollectionVisibility = "private" | "public";

function clampScore100(n: any, fallback = 80) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function score100ToTier10(score100: number) {
  const t = Math.round(clampScore100(score100, 80) / 10);
  return Math.max(1, Math.min(10, t));
}

function clampInt(n: any, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.round(x)));
}

export function useQuickAddPreference() {
  const [loading, setLoading] = useState(true);

  // Where Quick Add goes (collection/wishlist/both/ask)
  const [value, setValue] = useState<QuickAddDefault>("collection");

  // ✅ NEW: defaults used by Quick Add
  // IMPORTANT: this is now 0–100 (stored in profiles.default_condition_score)
  const [defaultConditionScore100, setDefaultConditionScore100] = useState<number>(80);
  const [defaultQuantity, setDefaultQuantity] = useState<number>(1);
  const [defaultWishlistPriority, setDefaultWishlistPriority] = useState<WishlistPriority>("medium");
  const [defaultCollectionVisibility, setDefaultCollectionVisibility] = useState<CollectionVisibility>("private");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id ?? null;

        if (!userId) {
          if (!cancelled) {
            setValue("collection");
            setDefaultConditionScore100(80);
            setDefaultQuantity(1);
            setDefaultWishlistPriority("medium");
            setDefaultCollectionVisibility("private");
            setLoading(false);
          }
          return;
        }

        // Pull everything Quick Add needs.
        // If some columns don't exist yet, Supabase will error. In that case we fall back.
        const res = await supabase
          .from("profiles")
          .select(
            "quick_add_default,default_condition_score,default_quantity,default_wishlist_priority,default_collection_visibility"
          )
          .eq("id", userId)
          .maybeSingle();

        if (cancelled) return;

        // If the select fails due to missing cols, res.error will exist.
        if ((res as any).error) {
          // fallback
          setValue("collection");
          setDefaultConditionScore100(80);
          setDefaultQuantity(1);
          setDefaultWishlistPriority("medium");
          setDefaultCollectionVisibility("private");
          setLoading(false);
          return;
        }

        const vRaw = (res.data as any)?.quick_add_default;
        const v = String(vRaw ?? "").trim();
        if (v === "wishlist" || v === "collection" || v === "both" || v === "ask") setValue(v);
        else setValue("collection");

        // ✅ default_condition_score is now 0–100
        setDefaultConditionScore100(clampScore100((res.data as any)?.default_condition_score, 80));

        setDefaultQuantity(clampInt((res.data as any)?.default_quantity, 1, 999, 1));

        const pr = String((res.data as any)?.default_wishlist_priority ?? "medium").trim();
        setDefaultWishlistPriority(pr === "low" || pr === "high" ? (pr as any) : "medium");

        const vis = String((res.data as any)?.default_collection_visibility ?? "private").trim();
        setDefaultCollectionVisibility(vis === "public" ? "public" : "private");

        setLoading(false);
      } catch {
        if (!cancelled) {
          setValue("collection");
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

  // Handy UI tier (1–10) derived from score100
  const defaultConditionTier10 = useMemo(
    () => score100ToTier10(defaultConditionScore100),
    [defaultConditionScore100]
  );

  return {
    loading,

    // Back-compat: keep returning value
    value,

    // ✅ NEW outputs
    defaultConditionScore100,
    defaultConditionTier10,
    defaultQuantity,
    defaultWishlistPriority,
    defaultCollectionVisibility,
  };
}
