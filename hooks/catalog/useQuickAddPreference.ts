// hooks/catalog/useQuickAddPreference.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { QuickAddDefault } from "@/lib/catalog/types";
import type { ConditionMeta } from "@/lib/pricingEngine";

type WishlistPriority = "low" | "medium" | "high";
type CollectionVisibility = "private" | "public";

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

function normalizeQuickAddDefault(vRaw: any): QuickAddDefault {
  const v = String(vRaw ?? "").trim();
  if (v === "wishlist" || v === "collection" || v === "both" || v === "ask") return v;
  return "collection";
}

function normalizeWishlistPriority(vRaw: any): WishlistPriority {
  const v = String(vRaw ?? "medium").trim().toLowerCase();
  return v === "low" || v === "high" ? (v as WishlistPriority) : "medium";
}

function normalizeVisibility(vRaw: any): CollectionVisibility {
  const v = String(vRaw ?? "private").trim().toLowerCase();
  return v === "public" ? "public" : "private";
}

/**
 * PATH 2: store "real-world" defaults (meta), not score.
 * We still expose a tier10 fallback for old UI paths / migration.
 */
function normalizeConditionMeta(v: any): ConditionMeta {
  const obj = safeJsonParse(v) ?? v;

  const stateRaw = String(obj?.state ?? "open_complete").trim();
  const gradeRaw = String(obj?.grade ?? "good").trim();
  const flagsRaw = obj?.flags;

  const state =
    stateRaw === "sealed" || stateRaw === "open_complete" || stateRaw === "open_incomplete" || stateRaw === "loose"
      ? stateRaw
      : "open_complete";

  const grade =
    gradeRaw === "mint" || gradeRaw === "excellent" || gradeRaw === "good" || gradeRaw === "fair" || gradeRaw === "poor"
      ? gradeRaw
      : "good";

  const flags = Array.isArray(flagsRaw) ? flagsRaw.map((x: any) => String(x)).filter(Boolean) : [];

  return { state, grade, flags };
}

/**
 * Display-only mapping (1–10) from meta.
 * Pricing should NOT depend on this.
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

export function useQuickAddPreference() {
  const [loading, setLoading] = useState(true);

  // Quick add mode
  const [value, setValue] = useState<QuickAddDefault>("collection");

  // ✅ NEW: real-world default condition meta (Path 2)
  const [defaultConditionMeta, setDefaultConditionMeta] = useState<ConditionMeta>({
    state: "open_complete",
    grade: "good",
    flags: [],
  });

  // ✅ Convenience outputs for legacy UI pieces that still want numbers
  const [defaultConditionTier10, setDefaultConditionTier10] = useState<number>(8);

  // ✅ Other defaults
  const [defaultQuantity, setDefaultQuantity] = useState<number>(1);
  const [defaultWishlistPriority, setDefaultWishlistPriority] = useState<WishlistPriority>("medium");
  const [defaultCollectionVisibility, setDefaultCollectionVisibility] = useState<CollectionVisibility>("private");

  useEffect(() => {
    let cancelled = false;

    const applyFallback = () => {
      setValue("collection");
      const meta: ConditionMeta = { state: "open_complete", grade: "good", flags: [] };
      setDefaultConditionMeta(meta);
      setDefaultConditionTier10(metaToTier10(meta));
      setDefaultQuantity(1);
      setDefaultWishlistPriority("medium");
      setDefaultCollectionVisibility("private");
      setLoading(false);
    };

    const load = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const userId = data.user?.id ?? null;

        if (!userId) {
          if (!cancelled) applyFallback();
          return;
        }

        /**
         * We try the newest preferences first:
         * - default_condition_meta (json/jsonb or text)
         * Then fallback to older:
         * - default_condition_score (tier10)
         */
        const res = await supabase
          .from("profiles")
          .select(
            "quick_add_default,default_condition_meta,default_condition_score,default_quantity,default_wishlist_priority,default_collection_visibility"
          )
          .eq("id", userId)
          .maybeSingle();

        if (cancelled) return;

        // quick add default
        setValue(normalizeQuickAddDefault((res.data as any)?.quick_add_default));

        // condition meta (preferred)
        const metaRaw = (res.data as any)?.default_condition_meta;
        const meta = metaRaw ? normalizeConditionMeta(metaRaw) : null;

        if (meta) {
          setDefaultConditionMeta(meta);
          setDefaultConditionTier10(metaToTier10(meta));
        } else {
          // fallback: old tier10 stored as default_condition_score
          const dcsRaw = Number((res.data as any)?.default_condition_score);
          const tier10 = Number.isFinite(dcsRaw) ? clamp(Math.round(dcsRaw), 1, 10) : 8;

          const fallbackMeta: ConditionMeta = { state: "open_complete", grade: "good", flags: [] };
          setDefaultConditionMeta(fallbackMeta);
          setDefaultConditionTier10(tier10);
        }

        // quantity
        const dqRaw = Number((res.data as any)?.default_quantity);
        setDefaultQuantity(Number.isFinite(dqRaw) ? clamp(Math.round(dqRaw), 1, 999) : 1);

        // wishlist priority
        setDefaultWishlistPriority(normalizeWishlistPriority((res.data as any)?.default_wishlist_priority));

        // visibility
        setDefaultCollectionVisibility(normalizeVisibility((res.data as any)?.default_collection_visibility));

        setLoading(false);
      } catch {
        if (!cancelled) applyFallback();
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

    // ✅ Path 2
    defaultConditionMeta,

    // ✅ legacy convenience
    defaultConditionTier10,
    defaultConditionScore100: defaultConditionTier10 * 10,

    defaultQuantity,
    defaultWishlistPriority,
    defaultCollectionVisibility,
  };
}
