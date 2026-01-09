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
  /** FAIL CLOSED: LEGO panels OFF unless DB confirms building_blocks */
  const [isBuildingBlocks, setIsBuildingBlocks] = useState(false);
  const [kindLoaded, setKindLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadKind() {
      setIsBuildingBlocks(false);
      setKindLoaded(false);

      const res = await supabase
        .from("catalog_items")
        .select("kind")
        .eq("id", catalogItemId)
        .single();

      if (cancelled) return;

      if (!res.error) {
        const kind = String((res.data as any)?.kind ?? "").toLowerCase().trim();
        setIsBuildingBlocks(kind === "building_blocks");
      }

      setKindLoaded(true);
    }

    if (catalogItemId) loadKind();
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
  const activeCopy = useMemo(
    () => copies.find((c) => c.id === activeCopyId) ?? null,
    [copies, activeCopyId]
  );

  return (
    <div className="rounded-3xl border bg-white shadow-sm p-5">
      <div className="text-sm font-semibold text-gray-900">Your copies</div>
      <div className="text-xs text-gray-500">Each card below is one copy you own.</div>

      <div className="mt-5 space-y-5">
        {copies.map((c, idx) => (
          <div key={c.id} className="rounded-3xl border bg-white shadow-sm p-5">
            <div className="flex justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">Copy #{copies.length - idx}</div>
                  <ConditionPill userCollectionItemId={c.id} readOnly />
                </div>

                <div className="mt-1 text-xs text-gray-500">{fmtDate(c.created_at)}</div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  {c.price_paid_cad != null && pill("Paid", `$${c.price_paid_cad.toFixed(2)} CAD`)}
                  {worthCad != null && pill("Worth", `$${worthCad.toFixed(2)} CAD`)}
                  {pill("Suggested list", `$${suggestedPrice.toFixed(2)} CAD`)}
                </div>
              </div>

              <button
                className="rounded-xl bg-black text-white px-4 py-2 text-sm"
                onClick={() => {
                  setActiveCopyId(c.id);
                  setOpen(true);
                }}
              >
                List for sale
              </button>
            </div>

            {/* Graded note (all types) */}
            {c.grade && (
              <div className="mt-4 rounded-xl border bg-slate-50 p-4 text-sm">
                Graded item — detailed condition not applicable.
              </div>
            )}

            {/* LEGO ONLY */}
            {!c.grade && isBuildingBlocks && (
              <div className="mt-4 space-y-4">
                <BuildingBlocksConditionCard conditionJson={c.condition_json ?? null} />
                <MinifigPanel userCollectionItemId={c.id} />
              </div>
            )}

            {/* Non-LEGO explanation */}
            {!c.grade && kindLoaded && !isBuildingBlocks && (
              <div className="mt-4 rounded-xl border bg-slate-50 p-4 text-sm text-gray-600">
                This item type does not use set conditions or minifigs.
              </div>
            )}

            {c.notes ? (
              <div className="mt-4 text-sm">{c.notes}</div>
            ) : (
              <div className="mt-4 text-xs text-gray-400">No notes.</div>
            )}
          </div>
        ))}
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
