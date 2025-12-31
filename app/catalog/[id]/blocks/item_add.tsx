// app/catalog/[id]/blocks/item_add.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
        ${disabled ? "bg-[#0F172A]/60 text-white cursor-not-allowed" : "bg-[#0F172A] text-white hover:bg-[#111C33]"}`}
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

function isUuid(v: any) {
  const s = String(v ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

// Accept "uuid#1" and normalize to "uuid"
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

function pickSeedMinifigIds(seedMinifigs: { minifig_id: string; instance_key?: string }[] | undefined): string[] {
  const rows = Array.isArray(seedMinifigs) ? seedMinifigs : [];
  const out: string[] = [];

  for (const m of rows) {
    const id = normalizeMinifigId((m as any)?.minifig_id ?? (m as any)?.id ?? (m as any)?.instance_key);
    if (id) out.push(id);
  }

  return Array.from(new Set(out));
}

function clampScore100(n: any, fallback = 80) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

export default function ItemAddActions({
  catalogItemId,
  userId,
  onRequireAuth,
  conditionValues,
  conditionScore,
  seedMinifigs,
}: {
  catalogItemId: string;
  userId: string | null;
  onRequireAuth: () => void;
  conditionValues: Record<string, any>;
  conditionScore: number; // ✅ REQUIRED: 0–100
  seedMinifigs?: { minifig_id: string; instance_key?: string }[]; // from page.tsx expected set minifigs (can be instance keys)
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

  // ✅ NEW condition system: LEGO set if item_type=lego AND data.type=set
  const isBuildingBlocksSet = useMemo(() => {
    const itemType = String(conditionValues?.item_type ?? "").toLowerCase().trim();
    const t = String(conditionValues?.data?.type ?? "").toLowerCase().trim();
    return itemType === "lego" && t === "set";
  }, [conditionValues]);

  const handleAddToCollection = async () => {
    setBanner(null);

    if (!catalogItemId) return setBanner({ type: "err", msg: "Missing item id." });

    if (!userId) {
      onRequireAuth();
      return;
    }

    setAdding(true);
    try {
      const score100 = clampScore100(conditionScore, 80);

      if (isBuildingBlocksSet) {
        // 1) Create collection copy (SAVE BOTH condition_json + condition_score)
        const ins = await supabase
          .from("user_collection_items")
          .insert([
            {
              user_id: userId,
              catalog_item_id: catalogItemId,
              condition_json: conditionValues,
              condition_score: score100,
            },
          ])
          .select("id")
          .maybeSingle();

        if (ins.error) throw ins.error;

        const userCollectionItemId = ins.data?.id as string | undefined;
        if (!userCollectionItemId) throw new Error("Failed to create collection copy (missing id).");

        // 2) Aggregate UI selections by base minifig UUID
        // NEW shape: conditionValues.data.minifigs = [{ instance_key, included, ... }]
        // Legacy fallback: conditionValues.building_blocks.minifigs
        const rawRows =
          (conditionValues as any)?.data?.minifigs ??
          (conditionValues as any)?.building_blocks?.minifigs ??
          [];

        const pickedById = new Map<string, { included_qty: number; notes: string | null }>();

        if (Array.isArray(rawRows)) {
          for (const m of rawRows) {
            // NEW preferred keys:
            const idCandidate =
              m?.instance_key ??
              m?.minifig_id ??
              m?.id ??
              m?.minifigId ??
              m?.minifig?.id;

            const id = normalizeMinifigId(idCandidate);
            if (!id) continue;

            const checked = !!m?.included || !!m?.checked || !!m?.selected || !!m?.isChecked;
            if (!checked) continue;

            // If qty exists (future), honor it. Otherwise each checked instance counts as 1.
            const hasQtyProp =
              Object.prototype.hasOwnProperty.call(m, "included_qty") ||
              Object.prototype.hasOwnProperty.call(m, "includedQty") ||
              Object.prototype.hasOwnProperty.call(m, "qty") ||
              Object.prototype.hasOwnProperty.call(m, "quantity") ||
              Object.prototype.hasOwnProperty.call(m, "count");

            const rawQty = m?.included_qty ?? m?.includedQty ?? m?.qty ?? m?.quantity ?? m?.count;
            const qty = hasQtyProp ? toNonNegInt(rawQty) : 1;

            const prev = pickedById.get(id);
            pickedById.set(id, {
              included_qty: (prev?.included_qty ?? 0) + qty,
              notes: (m?.notes ?? prev?.notes ?? null) as string | null,
            });
          }
        }

        // 3) Normalize seed list (expected minifigs for this set)
        const seededIds = pickSeedMinifigIds(seedMinifigs);

        // 4) Build ONE row per (user_collection_item_id, minifig_id)
        const rows = seededIds.map((minifigId) => {
          const picked = pickedById.get(minifigId);
          return {
            user_collection_item_id: userCollectionItemId,
            minifig_id: minifigId,
            included: !!picked,
            included_qty: picked ? picked.included_qty : 0, // ALWAYS int
            notes: picked ? picked.notes : null,
          };
        });

        // 5) Single upsert with correct conflict target
        const up = await supabase
          .from("user_collection_item_minifigs")
          .upsert(rows, { onConflict: "user_collection_item_id,minifig_id" })
          .select("user_collection_item_id,minifig_id,included,included_qty,notes");

        if (up.error) throw up.error;

        setBanner({
          type: "ok",
          msg: `Added set copy. copyId=${userCollectionItemId}. minifigsSaved=${up.data?.length ?? 0}.`,
        });

        return;
      }

      // Non-set: just add item copy (SAVE BOTH condition_json + condition_score)
      const ins = await supabase
        .from("user_collection_items")
        .insert([
          {
            user_id: userId,
            catalog_item_id: catalogItemId,
            condition_json: conditionValues,
            condition_score: score100,
          },
        ])
        .select("id")
        .maybeSingle();

      if (ins.error) throw ins.error;

      setBanner({ type: "ok", msg: `Added to your collection! id=${ins.data?.id ?? "?"}` });
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
