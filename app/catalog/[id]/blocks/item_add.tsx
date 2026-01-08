// app/catalog/[id]/blocks/item_add.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ConditionMeta } from "@/lib/pricingEngine";

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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
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
    const id = normalizeMinifigId((m as any)?.minifig_id ?? (m as any)?.id ?? (m as any)?.instance_key);
    if (id) out.push(id);
  }

  return Array.from(new Set(out));
}

function normalizeCompany(raw: any) {
  return String(raw ?? "").trim().toUpperCase();
}

function numOrNull(v: any): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isAllTen(sub: { centering?: number | null; corners?: number | null; edges?: number | null; surface?: number | null }) {
  return (
    Number(sub.centering) === 10 &&
    Number(sub.corners) === 10 &&
    Number(sub.edges) === 10 &&
    Number(sub.surface) === 10
  );
}

function parseMoneyToCents(input: string): number {
  const s = String(input ?? "").trim();
  if (!s) return 0;

  // Allow "12", "12.3", "12.34", "$12.34", "12,34" (EU comma)
  const cleaned = s.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0;

  return Math.max(0, Math.round(n * 100));
}

/* =========================
   Price Prompt Modal
   ========================= */

function PricePromptModal({
  open,
  title,
  subtitle,
  label,
  value,
  onChange,
  onClose,
  onContinue,
  busy,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onContinue: () => void;
  busy?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[#E5E9F2] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EEF2F7]">
          <div className="text-base font-semibold text-[#0F172A]">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-[#64748B]">{subtitle}</div> : null}
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
            <div className="text-sm font-medium text-[#0F172A]">{label}</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="text-sm text-[#64748B]">$</div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={!!busy}
              />
            </div>
            <div className="mt-2 text-xs text-[#64748B]">Leave blank to save as $0.</div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#EEF2F7] flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            className="sm:flex-1 rounded-2xl px-4 py-3 text-sm font-semibold border border-[#E5E9F2] bg-white text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-60"
            onClick={onClose}
            disabled={!!busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sm:flex-1 rounded-2xl px-4 py-3 text-sm font-semibold bg-[#0F172A] text-white hover:bg-[#111C33] disabled:opacity-60"
            onClick={onContinue}
            disabled={!!busy}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Subgrade Modal
   ========================= */

function SubgradeModal({
  open,
  title,
  subtitle,
  initial,
  onClose,
  onSkip,
  onSave,
  busy,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  initial: {
    centering: number | null;
    corners: number | null;
    edges: number | null;
    surface: number | null;
  };
  onClose: () => void;
  onSkip: () => void;
  onSave: (next: { centering: number | null; corners: number | null; edges: number | null; surface: number | null }) => void;
  busy?: boolean;
}) {
  const [centering, setCentering] = useState<string>("");
  const [corners, setCorners] = useState<string>("");
  const [edges, setEdges] = useState<string>("");
  const [surface, setSurface] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setCentering(initial.centering == null ? "" : String(initial.centering));
    setCorners(initial.corners == null ? "" : String(initial.corners));
    setEdges(initial.edges == null ? "" : String(initial.edges));
    setSurface(initial.surface == null ? "" : String(initial.surface));
  }, [open, initial.centering, initial.corners, initial.edges, initial.surface]);

  if (!open) return null;

  const parsed = {
    centering: numOrNull(centering),
    corners: numOrNull(corners),
    edges: numOrNull(edges),
    surface: numOrNull(surface),
  };

  const showBlackNote = isAllTen(parsed);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[#E5E9F2] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EEF2F7]">
          <div className="text-base font-semibold text-[#0F172A]">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-[#64748B]">{subtitle}</div> : null}
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
              <div className="text-sm font-medium text-[#0F172A]">Centering</div>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                className="mt-2 w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm"
                value={centering}
                onChange={(e) => setCentering(e.target.value)}
                disabled={!!busy}
              />
            </div>

            <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
              <div className="text-sm font-medium text-[#0F172A]">Corners</div>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                className="mt-2 w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm"
                value={corners}
                onChange={(e) => setCorners(e.target.value)}
                disabled={!!busy}
              />
            </div>

            <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
              <div className="text-sm font-medium text-[#0F172A]">Edges</div>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                className="mt-2 w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm"
                value={edges}
                onChange={(e) => setEdges(e.target.value)}
                disabled={!!busy}
              />
            </div>

            <div className="rounded-xl border border-[#E5E9F2] bg-white px-3 py-2">
              <div className="text-sm font-medium text-[#0F172A]">Surface</div>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                className="mt-2 w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm"
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                disabled={!!busy}
              />
            </div>
          </div>

          <div className="text-xs text-[#64748B]">
            Optional — but if all four subgrades are <span className="font-semibold">10</span>, we’ll treat it as{" "}
            <span className="font-semibold">BGS Black Label 10</span> (worth more than a normal BGS 10 / PSA 10).
          </div>

          {showBlackNote ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              All subgrades are 10 → this will be recorded as <span className="font-semibold">BGS Black Label 10</span>.
            </div>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-[#EEF2F7] flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            className="sm:flex-1 rounded-2xl px-4 py-3 text-sm font-semibold border border-[#E5E9F2] bg-white text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-60"
            onClick={onClose}
            disabled={!!busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sm:flex-1 rounded-2xl px-4 py-3 text-sm font-semibold border border-[#E5E9F2] bg-white text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-60"
            onClick={onSkip}
            disabled={!!busy}
            title="Add without tracking subgrades"
          >
            Skip subgrades
          </button>
          <button
            type="button"
            className="sm:flex-1 rounded-2xl px-4 py-3 text-sm font-semibold bg-[#0F172A] text-white hover:bg-[#111C33] disabled:opacity-60"
            onClick={() => onSave(parsed)}
            disabled={!!busy}
          >
            Save & Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Component
   ========================= */

export default function ItemAddActions({
  catalogItemId,
  userId,
  onRequireAuth,
  conditionValues,
  onConditionValuesChange,
  conditionMeta,
  seedMinifigs,
}: {
  catalogItemId: string;
  userId: string | null;
  onRequireAuth: () => void;

  // Existing detailed condition blob (LEGO, minifigs, etc.)
  conditionValues: Record<string, any>;

  // allow parent page to be updated (so inserts use the same blob the UI shows)
  onConditionValuesChange?: (next: Record<string, any>) => void;

  // real-world condition meta
  conditionMeta?: ConditionMeta;

  seedMinifigs?: { minifig_id: string; instance_key?: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  // Price prompt state
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceMode, setPriceMode] = useState<"collection" | "wishlist">("collection");
  const [priceInput, setPriceInput] = useState("");
  const [pendingPriceCents, setPendingPriceCents] = useState<number>(0);

  // Subgrades prompt state
  const [subgradeOpen, setSubgradeOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<{
    values: Record<string, any>;
    meta: ConditionMeta;
    isSet: boolean;
    paidPriceCents: number; // NEW
  } | null>(null);

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

  // Detect LEGO Set mode from the condition JSON shape (back-compat friendly)
  const isBuildingBlocksSet = useMemo(() => {
    const v = conditionValues ?? {};
    const data = (v as any)?.data ?? {};
    const t =
      String(data?.type ?? "")
        .toLowerCase()
        .trim() ||
      String((v as any)?.building_blocks?.type ?? "")
        .toLowerCase()
        .trim();
    return t.includes("set");
  }, [conditionValues]);

  // Default meta if nothing provided yet (keeps DB rows valid)
  const resolvedMeta: ConditionMeta = useMemo(() => {
    const flags = Array.isArray(conditionMeta?.flags) ? conditionMeta?.flags : [];
    return {
      status: conditionMeta?.status ?? "complete",
      flags: flags ?? [],
    };
  }, [conditionMeta]);

  const grading = useMemo(() => {
    const data = (conditionValues as any)?.data ?? {};
    const isGraded = !!data?.is_graded;
    const company = normalizeCompany(data?.grading_company);
    const gv = data?.grade_value == null || data?.grade_value === "" ? null : Number(data?.grade_value);
    const sub = (data?.grading_subgrades ?? null) as any;
    const subObj =
      sub && typeof sub === "object"
        ? {
            centering: numOrNull(sub.centering),
            corners: numOrNull(sub.corners),
            edges: numOrNull(sub.edges),
            surface: numOrNull(sub.surface),
          }
        : null;

    const hasAnySub =
      !!subObj &&
      (subObj.centering != null || subObj.corners != null || subObj.edges != null || subObj.surface != null);

    return { isGraded, company, gradeValue: gv, subgrades: subObj, hasAnySub };
  }, [conditionValues]);

  const buildPatchedConditionValues = (base: Record<string, any>, patchData: Record<string, any>): Record<string, any> => {
    const v = base ?? {};
    const data = (v as any)?.data ?? {};
    const nextData = { ...data, ...patchData };

    return {
      ...(v as any),
      v: (v as any)?.v ?? 3,
      meta: (v as any)?.meta ?? null,
      data: nextData,
    };
  };

  const finalizeAdd = async (
    valuesToUse: Record<string, any>,
    metaToUse: ConditionMeta,
    isSet: boolean,
    paidPriceCents: number
  ) => {
    setBanner(null);

    if (!catalogItemId) return setBanner({ type: "err", msg: "Missing item id." });

    if (!userId) {
      onRequireAuth();
      return;
    }

    setAdding(true);
    try {
      if (isSet) {
        // 1) Create collection copy (include paid price)
        const ins = await supabase
          .from("user_collection_items")
          .insert([
            {
              user_id: userId,
              catalog_item_id: catalogItemId,
              condition_meta: metaToUse,
              condition_json: valuesToUse,
              paid_price_cents: paidPriceCents,
            },
          ])
          .select("id")
          .maybeSingle();

        if (ins.error) throw ins.error;

        const userCollectionItemId = ins.data?.id as string | undefined;
        if (!userCollectionItemId) throw new Error("Failed to create collection copy.");

        // 2) Aggregate UI selections
        const rawRows = (valuesToUse as any)?.data?.minifigs ?? (valuesToUse as any)?.building_blocks?.minifigs ?? [];

        const pickedById = new Map<string, { included_qty: number; notes: string | null }>();

        if (Array.isArray(rawRows)) {
          for (const m of rawRows) {
            const id = normalizeMinifigId(
              m?.minifig_id ??
                m?.minifigId ??
                m?.minifig?.id ??
                m?.minifig?.minifig_id ??
                m?.id ??
                m?.instance_key
            );
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
            const qty = hasQtyProp ? toNonNegInt(rawQty) : 1;

            const prev = pickedById.get(id);
            pickedById.set(id, {
              included_qty: (prev?.included_qty ?? 0) + qty,
              notes: (m?.notes ?? prev?.notes ?? null) as string | null,
            });
          }
        }

        // 3) Normalise seed list from page.tsx (bbMinifigs)
        const seededIds = pickSeedMinifigIds(seedMinifigs);

        // 4) Build one row per (user_collection_item_id, minifig_id)
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

        // 5) Single upsert
        const up = await supabase
          .from("user_collection_item_minifigs")
          .upsert(rows, { onConflict: "user_collection_item_id,minifig_id" });

        if (up.error) throw up.error;

        setBanner({ type: "ok", msg: "Added set to your collection." });
        return;
      }

      // Non-set (include paid price)
      const ins = await supabase
        .from("user_collection_items")
        .insert([
          {
            user_id: userId,
            catalog_item_id: catalogItemId,
            condition_meta: metaToUse,
            condition_json: valuesToUse,
            paid_price_cents: paidPriceCents,
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

  const addWishlistWithPrice = async (desiredPriceCents: number) => {
    setBanner(null);

    if (!catalogItemId) return setBanner({ type: "err", msg: "Missing item id." });

    if (!userId) {
      onRequireAuth();
      return;
    }

    setWishlistBusy(true);
    try {
      const ins = await supabase
        .from("user_wishlist_items")
        .insert([
          {
            user_id: userId,
            catalog_item_id: catalogItemId,
            condition_meta: resolvedMeta,
            condition_json: conditionValues ?? {},
            desired_price_cents: desiredPriceCents,
          },
        ])
        .select("id")
        .maybeSingle();

      if (ins.error) throw ins.error;

      setWishlisted(true);
      setBanner({ type: "ok", msg: "Added to your wishlist!" });
    } catch (e: any) {
      console.error(e);
      setBanner({ type: "err", msg: e?.message || "Wishlist update failed." });
    } finally {
      setWishlistBusy(false);
    }
  };

  const handleAddToCollection = async () => {
    setBanner(null);

    if (!catalogItemId) return setBanner({ type: "err", msg: "Missing item id." });

    if (!userId) {
      onRequireAuth();
      return;
    }

    // Always prompt for price first
    setPriceMode("collection");
    setPriceInput("");
    setPendingPriceCents(0);
    setPriceOpen(true);
  };

  const handleToggleWishlist = async () => {
    setBanner(null);

    if (!catalogItemId) return setBanner({ type: "err", msg: "Missing item id." });

    if (!userId) {
      onRequireAuth();
      return;
    }

    // If already wishlisted: remove immediately (no prompt)
    if (wishlisted) {
      setWishlistBusy(true);
      try {
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
      return;
    }

    // Otherwise: prompt for desired price
    setPriceMode("wishlist");
    setPriceInput("");
    setPendingPriceCents(0);
    setPriceOpen(true);
  };

  const modalInitial = useMemo(() => {
    const s = grading.subgrades;
    return {
      centering: s?.centering ?? null,
      corners: s?.corners ?? null,
      edges: s?.edges ?? null,
      surface: s?.surface ?? null,
    };
  }, [grading.subgrades]);

  const handlePriceContinue = async () => {
    const cents = parseMoneyToCents(priceInput);
    setPendingPriceCents(cents);
    setPriceOpen(false);

    if (priceMode === "wishlist") {
      await addWishlistWithPrice(cents);
      return;
    }

    // priceMode === "collection"
    // Subgrade prompt rule:
    // - graded
    // - company BGS
    // - grade value is 10
    // - and no subgrades recorded yet
    const shouldPromptBgsSubgrades =
      grading.isGraded && grading.company === "BGS" && grading.gradeValue === 10 && !grading.hasAnySub;

    if (shouldPromptBgsSubgrades) {
      setPendingAdd({
        values: conditionValues ?? {},
        meta: resolvedMeta,
        isSet: isBuildingBlocksSet,
        paidPriceCents: cents,
      });
      setSubgradeOpen(true);
      return;
    }

    await finalizeAdd(conditionValues ?? {}, resolvedMeta, isBuildingBlocksSet, cents);
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

      <PricePromptModal
        open={priceOpen}
        title={priceMode === "collection" ? "What did you pay?" : "What are you willing to pay?"}
        subtitle={priceMode === "collection" ? "Optional — leave blank to save as $0." : "Optional — leave blank to save as $0."}
        label={priceMode === "collection" ? "Paid price" : "Desired price"}
        value={priceInput}
        onChange={setPriceInput}
        busy={adding || wishlistBusy}
        onClose={() => {
          setPriceOpen(false);
          setPriceInput("");
          setPendingPriceCents(0);
        }}
        onContinue={handlePriceContinue}
      />

      <SubgradeModal
        open={subgradeOpen}
        title="Track Beckett subgrades?"
        subtitle="BGS 10 can be a normal 10 or Black Label 10 (all subgrades 10). Tracking these lets us price it correctly."
        initial={modalInitial}
        busy={adding}
        onClose={() => {
          setSubgradeOpen(false);
          setPendingAdd(null);
        }}
        onSkip={async () => {
          const p = pendingAdd;
          setSubgradeOpen(false);
          setPendingAdd(null);
          if (!p) return;
          await finalizeAdd(p.values, p.meta, p.isSet, p.paidPriceCents);
        }}
        onSave={async (sub) => {
          const p = pendingAdd;
          if (!p) {
            setSubgradeOpen(false);
            return;
          }

          const black = isAllTen(sub);

          const patched = buildPatchedConditionValues(p.values, {
            grading_subgrades: {
              centering: sub.centering,
              corners: sub.corners,
              edges: sub.edges,
              surface: sub.surface,
            },
            grading_label: black ? "bgs_black_10" : "bgs_gold_10",
            is_black_label: black,
          });

          // keep parent UI in sync (optional)
          onConditionValuesChange?.(patched);

          setSubgradeOpen(false);
          setPendingAdd(null);

          await finalizeAdd(patched, p.meta, p.isSet, p.paidPriceCents);
        }}
      />
    </div>
  );
}
