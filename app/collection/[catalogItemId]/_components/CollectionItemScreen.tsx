"use client";

import React, { useMemo, useState } from "react";

import ItemImage from "@/app/catalog/[id]/blocks/item_image";

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
  // We keep 'item' as the primary data source
  item: CollectionItemLite;
  // Added to satisfy the parent component's call in page.tsx
  catalogItemId?: string; 
  onRequireAuth?: () => void;
};

function toLocalDateTime(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function centsToCad(cents: number | null): number {
  if (cents == null) return 0;
  const n = cents / 100;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export default function CollectionItemScreen({ item, onRequireAuth }: Props) {
  const [sellModalOpen, setSellModalOpen] = useState(false);

  const itemName = item.catalog?.name?.trim() || "Untitled item";

  const kind = useMemo(
    () => String(item.catalog?.kind ?? "").toLowerCase().trim(),
    [item.catalog?.kind]
  );

  const isBuildingBlocks = kind === "building_blocks";
  const graded = Boolean(item.graded);

  const defaultPriceCad = useMemo(
    () => centsToCad(item.paid_price_cents),
    [item.paid_price_cents]
  );

  const notes = item.notes?.trim() ? item.notes : "No notes.";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
      {/* Title row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-gray-900">
            {itemName}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <ConditionPill userCollectionItemId={item.id} readOnly />

            {isBuildingBlocks ? (
              <span className="rounded-full border bg-white px-2 py-1 text-xs text-gray-600">
                LEGO set copy
              </span>
            ) : null}

            {item.created_at ? (
              <span className="text-xs text-gray-500">
                Added {toLocalDateTime(item.created_at)}
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSellModalOpen(true)}
          className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          List for sale
        </button>
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="space-y-6">
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <ItemImage catalogItemId={item.catalog_item_id} itemName={itemName} />
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Condition</div>

            <div className="mt-4 space-y-4">
              {graded ? (
                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-700">
                  Graded item{item.grade != null ? ` • Grade ${item.grade}` : ""}.
                </div>
              ) : null}

              {!graded && isBuildingBlocks ? (
                <>
                  <BuildingBlocksConditionCard
                    conditionJson={item.condition_meta}
                  />
                  <MinifigPanel
                    userCollectionItemId={item.id}
                    hideIfEmpty
                  />
                </>
              ) : null}

              {!graded && !isBuildingBlocks ? (
                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-600">
                  Standard item condition applies.
                </div>
              ) : null}

              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {notes}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <aside className="space-y-6">
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Your copy</div>
            <div className="mt-2 text-sm text-gray-700">
              Paid: ${defaultPriceCad.toFixed(2)} CAD
            </div>
          </div>
        </aside>
      </div>

      <ListForSaleModal
        open={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        catalogItemId={item.catalog_item_id}
        userCollectionItemId={item.id}
        itemName={itemName}
        defaultPriceCad={defaultPriceCad}
      />
    </div>
  );
}
