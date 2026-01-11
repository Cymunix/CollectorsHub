"use client";

import React, { useMemo, useState } from "react";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";

import BuildingBlocksConditionCard from "./BuildingBlocksConditionCard";
import MinifigPanel from "./MinifigPanel";
import ConditionPill from "./ConditionPill";
import ListForSaleModal from "./ListForSaleModal";

// If you have these on your catalog page, reuse them:
import ItemImage from "@/app/catalog/[id]/blocks/item_image";
import ItemValueBlock from "@/app/catalog/[id]/blocks/item_value_block";
import ItemDescription from "@/app/catalog/[id]/blocks/item_description";
// ^ if paths differ, change them to wherever your catalog page imports from.

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
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function centsToCad(cents: number | null): number {
  if (cents == null) return 0;
  const n = cents / 100;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export default function CollectionItemScreen({ item }: Props) {
  const [sellModalOpen, setSellModalOpen] = useState(false);

  const kind = useMemo(
    () => String(item.catalog?.kind ?? "").toLowerCase().trim(),
    [item.catalog?.kind]
  );

  const isBuildingBlocks = kind === "building_blocks";
  const isMinifig = kind === "minifig";
  const graded = Boolean(item.graded);

  const itemName = item.catalog?.name?.trim() || "Untitled item";
  const defaultPriceCad = useMemo(
    () => centsToCad(item.paid_price_cents),
    [item.paid_price_cents]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <SecondaryNav />

      <main className="mx-auto max-w-6xl px-4 pb-12 pt-6">
        {/* Title row (catalog screen usually has a title section) */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-semibold text-gray-900 truncate">
              {itemName}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span className="inline-flex items-center gap-2">
                <ConditionPill userCollectionItemId={item.id} readOnly />
              </span>

              {isBuildingBlocks ? (
                <span className="rounded-full border bg-white px-2 py-1 text-xs text-gray-600">
                  LEGO set copy
                </span>
              ) : null}

              {isMinifig ? (
                <span className="rounded-full border bg-white px-2 py-1 text-xs text-gray-600">
                  Minifig
                </span>
              ) : null}

              {item.created_at ? (
                <span className="text-xs text-gray-500">
                  Added: {toLocalDateTime(item.created_at)}
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

        {/* Main grid — this is what makes it look like the catalog screen */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left column: image + description + condition panels */}
          <div className="space-y-6">
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              {/* Reuse the catalog image block if you have it */}
              <ItemImage />
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              {/* Reuse the catalog description block if you have it */}
              <ItemDescription />
            </div>

            {/* Your collection-specific condition area, styled like catalog blocks */}
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Condition</div>
              <div className="mt-1 text-xs text-gray-500">
                This is specific to your copy.
              </div>

              <div className="mt-4 space-y-4">
                {graded ? (
                  <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-700">
                    Graded item{item.grade != null ? ` • Grade ${item.grade}` : ""}.
                  </div>
                ) : null}

                {!graded && isBuildingBlocks ? (
                  <>
                    <BuildingBlocksConditionCard conditionJson={item.condition_meta} />
                    <MinifigPanel userCollectionItemId={item.id} />
                  </>
                ) : null}

                {!graded && !isBuildingBlocks ? (
                  <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-600">
                    Standard item condition applies.
                  </div>
                ) : null}

                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {item.notes?.trim() ? item.notes : "No notes."}
                </div>
              </div>
            </div>
          </div>

          {/* Right column: value/actions (catalog screen style sidebar) */}
          <aside className="space-y-6">
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              {/* Reuse catalog “value block” if you have it */}
              <ItemValueBlock />
            </div>

            {/* You can add other sidebar cards here to match catalog screen */}
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Your copy</div>
              <div className="mt-2 text-sm text-gray-700">
                Paid: ${defaultPriceCad.toFixed(2)} CAD
              </div>
              <div className="mt-3 text-xs text-gray-500">
                More copy-specific stats can live here (sale history, watchers, etc).
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
      </main>
    </div>
  );
}
