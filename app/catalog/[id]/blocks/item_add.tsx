// app/catalog/[id]/blocks/item_add.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* =========================
   Condition Meta (REAL WORLD)
   ========================= */

type ConditionState = "sealed" | "open_complete" | "open_incomplete" | "loose";
type ConditionGrade = "mint" | "excellent" | "good" | "fair" | "poor";
type ConditionFlag = string;

type ConditionMeta = {
  state: ConditionState;
  grade: ConditionGrade;
  flags: ConditionFlag[];
};

/* =========================
   UI Buttons
   ========================= */

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabled}
      className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition shadow-sm
        ${
          disabled
            ? "bg-[#0F172A]/60 text-white cursor-not-allowed"
            : "bg-[#0F172A] text-white hover:bg-[#111C33]"
        }`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabled}
      className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition border shadow-sm
        ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : danger
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-[#E5E9F2] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
        }`}
    >
      {children}
    </button>
  );
}

/* =========================
   Helpers
   ========================= */

function isUuid(v: any) {
  const s = String(v ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function normalizeMinifigId(v: any): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const base = s.split("#")[0].trim();
  return isUuid(base) ? base : null;
}

function toNonNegInt(v: any) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number.parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0;
  return Math.max(0, n);
}

function pickSeedMinifigIds(
  seedMinifigs: { minifig_id: string; instance_key?: string }[] | undefined
): string[] {
  const rows = Array.isArray(seedMinifigs) ? seedMinifigs : [];
  const out: string[] = [];

  for (const m of rows) {
    const id = normalizeMinifigId(
      (m as any)?.minifig_id ?? (m as any)?.id ?? (m as any)?.instance_key
    );
    if (id) out.push(id);
  }

  return Array.from(new Set(out));
}

/* =========================
   Component
   ========================= */

export default function ItemAddActions({
  catalogItemId,
  userId,
  onRequireAuth,
  conditionValues,
  conditionMeta,
  seedMinifigs,
}: {
  catalogItemId: string;
  userId: string | null;
  onRequireAuth: () => void;

  // Existing detailed condition blob (LEGO, minifigs, etc.)
  conditionValues: Record<string, any>;

  // NEW: real-world condition
  conditionMeta?: ConditionMeta;

  seedMinifigs?: { minifig_id: string; instance_key?: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      setWishlisted(false);
      if (!userId || !catalogItemId) return;

      const res = await supabase
        .from("user_wishlist_items")
        .select("id")
        .eq("user_id", userId)
        .eq("catalog_item_id", catalogItemId)
        .limit(1);

      if (cancelled) return;
      setWishlisted((res.data ?? []).length > 0);
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [userId, catalogItemId]);

  const isBuildingBlocksSet = useMemo(() => {
    const t = String(conditionValues?.building_blocks?.type ?? "").toLowerCase().trim();
    return t.includes("set");
  }, [conditionValues]);

  const resolvedCondition = {
    state: conditionMeta?.state ?? "open_complete",
    grade: conditionMeta?.grade ?? "good",
    flags: conditionMeta?.flags ?? [],
  };

  const handleAddToCollection = async () => {
    setBanner(null);

    if (!catalogItemId) return setBanner({ type: "err", msg: "Missing item id." });

    if (!userId) {
      onRequireAuth();
      return;
    }

    setAdding(true);
    try {
      if (isBuildingBlocksSet) {
        // 1) Create collection copy
        const ins = await supabase
          .from("user_collection_items")
          .insert([
            {
              user_id: userId,
              catalog_item_id: catalogItemId,
              condition_state: resolvedCondition.state,
              condition_grade: resolvedCondition.grade,
              condition_flags: resolvedCondition.flags,
              condition_json: conditionValues,
            },
          ])
          .select("id")
          .maybeSingle();

        if (ins.error) throw ins.error;

        const userCollectionItemId = ins.data?.id as string | undefined;
        if (!userCollectionItemId) throw new Error("Failed to create collection copy.");

        // 2) Aggregate minifigs
        const rawRows = (conditionValues as any)?.building_blocks?.minifigs;
        const pickedById = new Map<string, { included_qty: number; notes: string | null }>();

        if (Array.isArray(rawRows)) {
          for (const m of rawRows) {
            const id = normalizeMinifigId(
              m?.minifig_id ??
                m?.minifigId ??
                m?.minifig?.id ??
                m?.id ??
                m?.instance_key
            );
            if (!id) continue;

            const checked = !!m?.included || !!m?.checked || !!m?.selected;
            if (!checked) continue;

            const qty = toNonNegInt(
              m?.included_qty ?? m?.includedQty ?? m?.qty ?? m?.quantity ?? 1
            );

            const prev = pickedById.get(id);
            pickedById.set(id, {
              included_qty: (prev?.included_qty ?? 0) + qty,
              notes: (m?.notes ?? prev?.notes ?? null) as string | null,
            });
          }
        }

        const seededIds = pickSeedMinifigIds(seedMinifigs);

        const rows = seededIds.map((minifigId) => {
          const picked = pickedById.get(minifigId);
          return {
            user_collection_item_id: userCollectionItemId,
            minifig_id: minifigId,
            included: !!picked,
            included_qty: picked ? picked.included_qty : 0,
            notes: picked ? picked.notes : null,
          };
        });

        const up = await supabase
          .from("user_collection_item_minifigs")
          .upsert(rows, { onConflict: "user_collection_item_id,minifig_id" });

        if (up.error) throw up.error;

        setBanner({ type: "ok", msg: "Added set to your collection." });
        return;
      }

      // Non-set
      const ins = await supabase
        .from("user_collection_items")
        .insert([
          {
            user_id: userId,
            catalog_item_id: catalogItemId,
            condition_state: resolvedCondition.state,
            condition_grade: resolvedCondition.grade,
            condition_flags: resolvedCondition.flags,
            condition_json: conditionValues,
          },
        ])
        .select("id")
        .maybeSingle();

      if (ins.error) throw ins.error;

      setBanner({ type: "ok", msg: "Added to your collection!" });
    } catch (e: any) {
      console.error("ADD ERROR:", e);
      setBanner({ type: "err", msg: e?.message || "Add failed." });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleWishlist = async () => {
    setBanner(null);

    if (!catalogItemId) return setBanner({ type: "err", msg: "Missing item id." });

    if (!userId) {
      onRequireAuth();
      return;
    }

    setWishlistBusy(true);
    try {
      if (!wishlisted) {
        const ins = await supabase
          .from("user_wishlist_items")
          .insert([{ user_id: userId, catalog_item_id: catalogItemId }])
          .select("id")
          .maybeSingle();

        if (ins.error) throw ins.error;

        setWishlisted(true);
        setBanner({ type: "ok", msg: "Added to your wishlist!" });
        return;
      }

      const del = await supabase
        .from("user_wishlist_items")
        .delete()
        .eq("user_id", userId)
        .eq("catalog_item_id", catalogItemId);

      if (del.error) throw del.error;

      setWishlisted(false);
      setBanner({ type: "ok", msg: "Removed from your wishlist." });
    } catch (e: any) {
      console.error(e);
      setBanner({ type: "err", msg: e?.message || "Wishlist update failed." });
    } finally {
      setWishlistBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {banner ? (
        <div
          className={`rounded-2xl border p-3 text-xs ${
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {banner.msg}
        </div>
      ) : null}

      <div className="space-y-2">
        <PrimaryButton disabled={adding} onClick={handleAddToCollection}>
          {adding ? "Adding..." : "Add to My Collection"}
        </PrimaryButton>

        <SecondaryButton disabled={wishlistBusy} onClick={handleToggleWishlist} danger={wishlisted}>
          {wishlistBusy ? "Working..." : wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
        </SecondaryButton>
      </div>
    </div>
  );
}
