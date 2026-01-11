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
        // Robust check: handles "building_blocks", "LEGO", etc.
        const kind = String((res.data as any)?.kind ?? "")
          .toLowerCase()
          .trim();
        setIsBuildingBlocks(kind === "building_blocks");
      }

      setKindLoaded(true);
    }

    if (catalogItemId) loadKind();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  // FIX: Return null instead of 20 to avoid fake pricing
  const suggestedPrice = useMemo(() => {
    if (worthCad == null || worthCad === 0) return null;
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
      <div className="text-xs text-gray-500">
        Each card below is one copy you own.
      </div>

      <div className="mt-5 space-y-5">
        {copies.length === 0 ? (
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
            No copies found for this item.
          </div>
        ) : (
          copies.map((c, idx) => {
            const copyNumber = copies.length - idx;

            return (
              <div
                key={c.id}
                className="rounded-3xl border bg-white shadow-sm p-5"
              >
                {/* Header row */}
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        Copy #{copyNumber}
                      </div>
                      <ConditionPill userCollectionItemId={c.id} readOnly />

                      {/* ONLY show badge if confirmed LEGO */}
                      {isBuildingBlocks && (
                        <span className="rounded-full border bg-white px-2 py-1 text-xs text-gray-600">
                          LEGO set copy
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {fmtDate(c.created_at)}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.price_paid_cad != null
                        ? pill(
                            "Paid",
                            `$${Number(c.price_paid_cad).toFixed(2)} CAD`
                          )
                        : null}
                      {worthCad != null
                        ? pill("Worth", `$${Number(worthCad).toFixed(2)} CAD`)
                        : null}

                      {/* Handles N/A cleanly */}
                      {pill(
                        "Suggested list",
                        suggestedPrice
                          ? `$${suggestedPrice.toFixed(2)} CAD`
                          : "N/A"
                      )}
                    </div>
                  </div>

                  {/* Button Section */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      onClick={() => {
                        setActiveCopyId(c.id);
                        setOpen(true);
                      }}
                    >
                      List for sale
                    </button>
                  </div>
                </div>

                {/* Body Section */}
                <div className="mt-4 space-y-4">
                  {c.grade ? (
                    <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                      Graded item — detailed condition not applicable.
                    </div>
                  ) : null}

                  {/* STRICT CHECK: Must be not graded AND confirmed LEGO */}
                  {!c.grade && isBuildingBlocks ? (
                    <>
                      <BuildingBlocksConditionCard
                        conditionJson={c.condition_json ?? null}
                      />
                      <MinifigPanel userCollectionItemId={c.id} />
                    </>
                  ) : null}

                  {/* Non-LEGO Message */}
                  {!c.grade && kindLoaded && !isBuildingBlocks ? (
                    <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-600">
                      Standard item condition applies.
                    </div>
                  ) : null}

                  {c.notes ? (
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {c.notes}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">No notes.</div>
                  )}
                </div>
              </div>
            );
          })
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
