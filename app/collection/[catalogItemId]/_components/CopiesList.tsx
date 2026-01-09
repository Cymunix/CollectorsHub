"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import BuildingBlocksConditionCard from "./BuildingBlocksConditionCard";
import MinifigPanel from "./MinifigPanel";
import ConditionPill from "./ConditionPill";
import ListForSaleModal from "./ListForSaleModal";

type CollectionCopy = {
  id: string;
  created_at: string | null;

  condition_json?: any | null;
  grade?: string | null;
  notes?: string | null;

  price_paid_cad?: number | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString();
}

function pill(label: string, value: string) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default function CopiesList({
  copies,
  catalogItemId,
  itemName,
  worthCad,
}: {
  copies: CollectionCopy[];
  catalogItemId: string;
  itemName: string;
  worthCad: number | null;
}) {
  // ✅ Fail closed: only show LEGO panels if DB confirms building_blocks
  const [isBuildingBlocks, setIsBuildingBlocks] = useState(false);
  const [kindLoading, setKindLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadKind() {
      if (!catalogItemId) return;

      setKindLoading(true);
      setIsBuildingBlocks(false);

      const res = await supabase.from("catalog_items").select("kind").eq("id", catalogItemId).single();

      if (cancelled) return;

      if (res.error) {
        // if kind lookup fails, do NOT show LEGO-only UI
        setIsBuildingBlocks(false);
        setKindLoading(false);
        return;
      }

      const kind = String((res.data as any)?.kind ?? "").toLowerCase().trim();
      setIsBuildingBlocks(kind === "building_blocks");
      setKindLoading(false);
    }

    loadKind();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const suggestedPrice = useMemo(() => {
    if (worthCad == null) return 20;
    return Math.max(1, Math.round(worthCad * 0.95 * 100) / 100);
  }, [worthCad]);

  const [open, setOpen] = useState(false);
  const [activeCopyId, setActiveCopyId] = useState<string | null>(null);
  const activeCopy = useMemo(() => copies.find((c) => c.id === activeCopyId) ?? null, [copies, activeCopyId]);

  return (
    <div className="rounded-3xl border bg-white shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Your copies</div>
          <div className="text-xs text-gray-500">Each card below is one copy you own.</div>
        </div>
      </div>

      <div className="mt-5">
        {copies.length === 0 ? (
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
            No copies found for this item.
          </div>
        ) : (
          <div className="space-y-5">
            {copies.map((c, idx) => (
              <div key={c.id} className="rounded-3xl border bg-white shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900">Copy #{copies.length - idx}</div>
                      <ConditionPill userCollectionItemId={c.id} readOnly />
                    </div>

                    <div className="mt-1 text-xs text-gray-500">{fmtDate(c.created_at)}</div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.price_paid_cad != null ? pill("Paid", `$${Number(c.price_paid_cad).toFixed(2)} CAD`) : null}
                      {worthCad != null ? pill("Worth", `$${Number(worthCad).toFixed(2)} CAD`) : null}
                      {pill("Suggested list", `$${suggestedPrice.toFixed(2)} CAD`)}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90"
                    onClick={() => {
                      setActiveCopyId(c.id);
                      setOpen(true);
                    }}
                  >
                    List for sale
                  </button>
                </div>

                {/* ✅ Graded note is fine for all item types */}
                {c.grade ? (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                    Graded item — condition breakdown not shown.
                  </div>
                ) : null}

                {/* ✅ LEGO-only panels */}
                {!c.grade && isBuildingBlocks ? (
                  <div className="mt-4 space-y-4">
                    <BuildingBlocksConditionCard conditionJson={c.condition_json ?? null} />
                    <MinifigPanel userCollectionItemId={c.id} />
                  </div>
                ) : null}

                {/* Optional: explain why LEGO panels are missing (only after kind loaded) */}
                {!c.grade && !isBuildingBlocks && !kindLoading ? (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                    This item type doesn’t use set-condition or minifigs.
                  </div>
                ) : null}

                {c.notes ? (
                  <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{c.notes}</div>
                ) : (
                  <div className="mt-4 text-xs text-gray-500">No notes.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ListForSaleModal
        open={open}
        onClose={() => setOpen(false)}
        catalogItemId={catalogItemId}
        userCollectionItemId={activeCopy?.id ?? ""}
        itemName={itemName}
        defaultPriceCad={suggestedPrice}
      />
    </div>
  );
}
