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

export default function ItemAddActions({
  catalogItemId,
  userId,
  onRequireAuth,
  conditionValues,
  seedMinifigs,
}: {
  catalogItemId: string;
  userId: string | null;
  onRequireAuth: () => void;
  conditionValues: Record<string, any>;
  seedMinifigs?: { minifig_id: string; instance_key?: string }[]; // from page.tsx bbMinifigs
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
        // ✅ Logs show in BROWSER DevTools console, not terminal
        console.log(
          "[add set] raw condition minifigs sample:",
          (conditionValues as any)?.building_blocks?.minifigs?.slice?.(0, 5)
        );

        // 1) Create collection copy
        const ins = await supabase
          .from("user_collection_items")
          .insert([{ user_id: userId, catalog_item_id: catalogItemId, condition_json: conditionValues }])
          .select("id")
          .maybeSingle();

        console.log("[add set] INSERT user_collection_items:", ins);
        if (ins.error) throw ins.error;

        const userCollectionItemId = ins.data?.id as string | undefined;
        if (!userCollectionItemId) throw new Error("Failed to create collection copy (missing id).");

        // 2) Aggregate UI selections by base minifig UUID
        const rawRows = (conditionValues as any)?.building_blocks?.minifigs;
        const pickedById = new Map<string, { included_qty: number; notes: string | null }>();

        if (Array.isArray(rawRows)) {
          for (const m of rawRows) {
            const idCandidate =
              m?.minifig_id ??
              m?.minifigId ??
              m?.minifig?.id ??
              m?.minifig?.minifig_id ??
              m?.id ??
              m?.instance_key;

            const id = normalizeMinifigId(idCandidate);
            if (!id) continue;

            const checked = !!m?.included || !!m?.checked || !!m?.selected || !!m?.isChecked;
            if (!checked) continue;

            const hasQtyProp =
              Object.prototype.hasOwnProperty.call(m, "included_qty") ||
              Object.prototype.hasOwnProperty.call(m, "includedQty") ||
              Object.prototype.hasOwnProperty.call(m, "qty") ||
              Object.prototype.hasOwnProperty.call(m, "quantity") ||
              Object.prototype.hasOwnProperty.call(m, "count");

            const rawQty = m?.included_qty ?? m?.includedQty ?? m?.qty ?? m?.quantity ?? m?.count;

            // If qty prop exists but blank => 0 (your rule)
            // If qty prop does NOT exist (per-instance checkbox), count this checked instance as 1
            const qty = hasQtyProp ? toNonNegInt(rawQty) : 1;

            const prev = pickedById.get(id);
            pickedById.set(id, {
              included_qty: (prev?.included_qty ?? 0) + qty,
              notes: (m?.notes ?? prev?.notes ?? null) as string | null,
            });
          }
        }

        console.log("[add set] pickedById (aggregated):", Array.from(pickedById.entries()).slice(0, 20));

        // 3) Normalize seed list from page.tsx (bbMinifigs)
        const seededIds = pickSeedMinifigIds(seedMinifigs);

        console.log("[add set] seededIds count:", seededIds.length, seededIds.slice(0, 10));

        const matched = seededIds.filter((id) => pickedById.has(id)).length;
        console.log("[add set] match count (seed ∩ picked):", matched);

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

        console.log("[add set] UPSERT PAYLOAD sample:", rows.slice(0, 10));

        // 5) Single upsert with correct conflict target
        const up = await supabase
          .from("user_collection_item_minifigs")
          .upsert(rows, { onConflict: "user_collection_item_id,minifig_id" })
          .select("user_collection_item_id,minifig_id,included,included_qty,notes");

        console.log("[add set] UPSERT RESULT:", up);
        if (up.error) throw up.error;

        setBanner({
          type: "ok",
          msg: `Added set copy. copyId=${userCollectionItemId}. minifigsSaved=${up.data?.length ?? 0}. matched=${matched}`,
        });

        return;
      }

      // Non-set: just add item copy
      const ins = await supabase
        .from("user_collection_items")
        .insert([{ user_id: userId, catalog_item_id: catalogItemId, condition_json: conditionValues }])
        .select("id")
        .maybeSingle();

      console.log("INSERT RESULT:", ins);
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
