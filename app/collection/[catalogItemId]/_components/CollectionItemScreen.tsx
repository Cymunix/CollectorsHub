"use client";

import React, { useMemo, useState } from "react";

import BuildingBlocksConditionCard from "./BuildingBlocksConditionCard";
import MinifigPanel from "./MinifigPanel";
import ConditionPill from "./ConditionPill";
import ListForSaleModal from "./ListForSaleModal";

type CatalogLite = {
  id: string;
  name: string | null;
  kind: string | null;
};

type ConditionMeta = {
  status?: string;
  flags?: string[];
  [k: string]: any;
};

export type CollectionItemLite = {
  id: string;
  catalog_item_id: string;

  condition_meta: ConditionMeta | null;

  graded: boolean | null;
  grade: number | null;

  paid_price_cents: number | null;
  notes: string | null;
  created_at: string | null;

  catalog: CatalogLite | null;
};

type Props = {
  item: CollectionItemLite;
  onRequireAuth?: () => void;
};

function toLocalDateTime(s: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return "";
  }
}

export default function CollectionItemScreen({ item, onRequireAuth }: Props) {
  const [sellModalOpen, setSellModalOpen] = useState(false);

  const kind = useMemo(() => (item.catalog?.kind ?? "").toLowerCase().trim(), [item.catalog?.kind]);
  const isBuildingBlocks = kind === "building_blocks";
  const isMinifig = kind === "minifig";

  // Strict: no default/fake price
  const suggestedPriceCad: number | null = null;

  return (
    <div className="rounded-3xl border bg-white shadow-sm p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-gray-900">Copy</div>

            <ConditionPill userCollectionItemId={item.id} readOnly />

            {isBuildingBlocks ? (
              <span className="rounded-full border bg-white px-2 py-1 text-xs text-gray-600">LEGO set copy</span>
            ) : null}

            {isMinifig ? (
              <span className="rounded-full border bg-white px-2 py-1 text-xs text-gray-600">Minifig</span>
            ) : null}
          </div>

          <div className="mt-1 text-xs text-gray-500">{toLocalDateTime(item.created_at)}</div>
        </div>

        <button
          type="button"
          onClick={() => setSellModalOpen(true)}
          className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          List for sale
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {/* Only show BB condition + minifigs when (a) building blocks, (b) not graded */}
        {!item.graded && isBuildingBlocks ? (
          <>
            <BuildingBlocksConditionCard conditionJson={item.condition_meta} />
            <MinifigPanel userCollectionItemId={item.id} />
          </>
        ) : null}

        {/* If graded, show graded info only */}
        {item.graded ? (
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-700">
            Graded item{item.grade != null ? ` • Grade ${item.grade}` : ""}.
          </div>
        ) : null}

        {/* Non-building-blocks and not graded: generic message */}
        {!item.graded && !isBuildingBlocks ? (
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-600">Standard item condition applies.</div>
        ) : null}

        {/* Notes */}
        <div className="text-sm text-gray-700 whitespace-pre-wrap">{item.notes?.trim() ? item.notes : "No notes."}</div>
      </div>

      <ListForSaleModal
  open={sellModalOpen}
  onClose={() => setSellModalOpen(false)}
  catalogItemId={item.catalog_item_id}
  userCollectionItemId={item.id}
  itemName={item.catalog?.name ?? "Untitled item"}
  defaultPriceCad={0}
/>
    </div>
  );
}

