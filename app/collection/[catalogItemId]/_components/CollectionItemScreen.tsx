// app/collection/[catalogItemId]/_components/CollectionItemScreen.tsx
"use client";

import React, { useMemo } from "react";
import BuildingBlocksConditionCard from "@/components/BuildingBlocksConditionCard"; // Adjust import path as needed
import MinifigPanel from "@/components/MinifigPanel"; // Adjust import path
import ConditionPill from "@/components/ConditionPill"; // Adjust import path
import ListForSaleModal from "@/components/ListForSaleModal"; // Adjust import path

// Match the Type from the parent
type CollectionItemLite = {
  id: string;
  catalog_item_id: string;
  // ... other fields matching parent ...
  condition_meta: any | null;
  graded: boolean | null;
  grade: number | null;
  paid_price_cents: number | null;
  notes: string | null;
  created_at: string | null;
  catalog: {
    id: string;
    name: string | null;
    kind: string | null;
  } | null;
};

export default function CollectionItemScreen({
  item,
  onRequireAuth,
}: {
  item: CollectionItemLite;
  onRequireAuth: () => void;
}) {
  const [sellModalOpen, setSellModalOpen] = React.useState(false);

  // ✅ FIX 1: Determine if it's LEGO immediately. No async fetch needed.
  const isBuildingBlocks = useMemo(() => {
    const k = (item.catalog?.kind ?? "").toLowerCase().trim();
    return k === "building_blocks";
  }, [item.catalog]);

  // ✅ FIX 2: Handle Price Logic (Assuming worthCad passed or calculated)
  // If you are passing worth via props, use that. 
  // If worth is not passed, default to null. DO NOT default to 20.
  const suggestedPrice = null; // Update this if you have worth data

  return (
    <div className="rounded-3xl border bg-white shadow-sm p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
           <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-gray-900">Copy #1</div>
              <ConditionPill userCollectionItemId={item.id} readOnly />
              
              {/* ✅ Only show this if confirmed LEGO */}
              {isBuildingBlocks && (
                <span className="rounded-full border bg-white px-2 py-1 text-xs text-gray-600">
                  LEGO set copy
                </span>
              )}
           </div>
           <div className="mt-1 text-xs text-gray-500">
              {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
           </div>
        </div>
        
        <button
           onClick={() => setSellModalOpen(true)}
           className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
           List for sale
        </button>
      </div>

      <div className="mt-4 space-y-4">
         {/* ✅ FIX 3: Strict Logic for Minifig Panel */}
         {!item.graded && isBuildingBlocks ? (
            <>
              <BuildingBlocksConditionCard conditionJson={item.condition_meta} />
              <MinifigPanel userCollectionItemId={item.id} />
            </>
         ) : null}

         {/* Standard Note for Non-LEGO */}
         {!item.graded && !isBuildingBlocks && (
            <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-600">
               Standard item condition applies.
            </div>
         )}

         {/* Notes */}
         <div className="text-sm text-gray-700 whitespace-pre-wrap">
            {item.notes || "No notes."}
         </div>
      </div>
      
      <ListForSaleModal 
        open={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        // ... pass other props ...
      />
    </div>
  );
}
