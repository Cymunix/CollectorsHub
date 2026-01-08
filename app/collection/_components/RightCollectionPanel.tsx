"use client";

import React, { useMemo } from "react";

type Summary = {
  uniqueItems: number;
  totalCopies: number;
  duplicates: number;
  unknownCondition: number;
  missingPaid: number;
  totalPaidCents: number;
};

type Props = {
  loading: boolean;
  err: string | null;

  summary: Summary;

  onAddItems?: () => void;
  onExportCsv?: () => void;
  onBulkEdit?: () => void;
  onReviewMissing?: () => void;
};

function moneyFromCents(cents: number) {
  const v = (cents ?? 0) / 100;
  // keep USD for now because your app seems USD; change to CAD later if you add currency setting
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function RightCollectionPanel(p: Props) {
  const totalPaid = useMemo(() => moneyFromCents(p.summary.totalPaidCents), [p.summary.totalPaidCents]);

  return (
    <div className="lg:sticky lg:top-6 space-y-4">
      {/* Quick actions */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#0F172A]">Quick actions</div>

        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={p.onAddItems}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Add items
          </button>

          <button
            type="button"
            onClick={p.onExportCsv}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-gray-50"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={p.onBulkEdit}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-gray-50"
          >
            Bulk edit
          </button>
        </div>

        {p.err ? <div className="mt-3 text-xs text-red-600">{p.err}</div> : null}
      </div>

      {/* Summary */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#0F172A]">Summary</div>

        {p.loading ? (
          <div className="mt-2 text-xs text-gray-500">Loading…</div>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Unique items</dt>
              <dd className="font-semibold">{p.summary.uniqueItems}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Total copies</dt>
              <dd className="font-semibold">{p.summary.totalCopies}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Duplicates</dt>
              <dd className="font-semibold">{p.summary.duplicates}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Unknown condition</dt>
              <dd className="font-semibold">{p.summary.unknownCondition}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Missing paid price</dt>
              <dd className="font-semibold">{p.summary.missingPaid}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Total paid</dt>
              <dd className="font-semibold">{totalPaid}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* To fix */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#0F172A]">To fix</div>

        {p.loading ? (
          <div className="mt-2 text-xs text-gray-500">Loading…</div>
        ) : (
          <>
            <div className="mt-2 text-sm text-gray-600">
              {p.summary.missingPaid} items missing paid price
              <br />
              {p.summary.unknownCondition} items missing condition
            </div>

            <button
              type="button"
              onClick={p.onReviewMissing}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-gray-50"
            >
              Review missing data
            </button>
          </>
        )}
      </div>
    </div>
  );
}
