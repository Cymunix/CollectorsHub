"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { loadItemWorthCad } from "../../_lib/worth";

import CopiesList from "./CopiesList";
import VariantsTab from "./VariantsTab";
import ReviewsTab from "./ReviewsTab";
import SalesHistoryTab from "./SalesHistoryTab";

type TabKey = "overview" | "copies" | "variants" | "reviews" | "sales";

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
  quantity: number | null;

  condition_meta: ConditionMeta | null;
  graded: boolean | null;
  grade: number | null;

  paid_price_cents: number | null;
  paid_currency: string | null;

  notes: string | null;
  created_at: string | null;

  catalog: CatalogLite | null;
};

type Props = {
  item: CollectionItemLite;
  onRequireAuth?: () => void;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function moneyCad(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

function conditionLabel(item: CollectionItemLite) {
  const s = String(item.condition_meta?.status ?? "").trim();
  return s || "Unknown";
}

export default function CollectionItemScreen({ item, onRequireAuth }: Props) {
  const router = useRouter();
  const catalogItemId = item.catalog_item_id;

  const [tab, setTab] = useState<TabKey>("overview");

  const [worthCad, setWorthCad] = useState<number | null>(null);
  const [worthLoading, setWorthLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!catalogItemId) return;
      setWorthLoading(true);
      try {
        const v = await loadItemWorthCad(catalogItemId);
        if (!cancelled) setWorthCad(v);
      } catch (e) {
        // Don't crash the page just because worth couldn't load.
        const msg = String(e ?? "").toLowerCase();
        if (msg.includes("auth") || msg.includes("jwt") || msg.includes("rls")) onRequireAuth?.();
      } finally {
        if (!cancelled) setWorthLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId, onRequireAuth]);

  const title = useMemo(() => item.catalog?.name?.trim() || "Untitled item", [item.catalog?.name]);

  const subtitle = useMemo(() => {
    const qty = item.quantity ?? 0;
    if (!qty) return "No copies yet";
    return `${qty} copy${qty === 1 ? "" : "ies"}`;
  }, [item.quantity]);

  const tabs = useMemo(
    () =>
      [
        { key: "overview" as const, label: "Overview" },
        { key: "copies" as const, label: "Copies" },
        { key: "variants" as const, label: "Variants" },
        { key: "reviews" as const, label: "Reviews" },
        { key: "sales" as const, label: "Sales History" },
      ] as const,
    []
  );

  const paidCad = useMemo(() => {
    if (item.paid_price_cents == null) return null;
    return item.paid_price_cents / 100;
  }, [item.paid_price_cents]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => router.push("/collection")}
        >
          ← Back
        </button>

        <button
          type="button"
          className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => router.push(`/catalog/${encodeURIComponent(catalogItemId)}`)}
          title="Open the catalogue page for this item"
        >
          Open catalogue item →
        </button>
      </div>

      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
          <div className="bg-slate-50">
            <div className="aspect-[4/3] flex items-center justify-center text-xs text-gray-400">No photo</div>
          </div>

          <div className="p-6">
            <div className="text-2xl font-semibold tracking-tight">{title}</div>
            <div className="mt-1 text-sm text-gray-500">{subtitle}</div>

            <div className="mt-2 text-xs text-gray-400">
              Collection row: <span className="font-mono">{item.id}</span>
              {item.catalog?.kind ? (
                <>
                  {" "}
                  • <span className="uppercase tracking-wide">{item.catalog.kind}</span>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Chip label="Qty" value={String(item.quantity ?? 0)} />
              <Chip label="Condition" value={conditionLabel(item)} />
              <Chip label="Paid" value={paidCad == null ? "—" : moneyCad(paidCad)} />
              <Chip label="Value" value={worthLoading ? "Loading…" : worthCad == null ? "—" : moneyCad(worthCad)} />
              {item.graded ? <Chip label="Grade" value={item.grade == null ? "—" : String(item.grade)} /> : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90"
                onClick={() => setTab("copies")}
              >
                View copies
              </button>

              <button
                type="button"
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => setTab("overview")}
              >
                Overview
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-white">
          <div className="p-4 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition",
                  tab === t.key ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === "overview" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded-2xl border bg-gray-50 p-4">
                <div className="text-lg font-semibold">At a glance</div>
                <div className="mt-1 text-sm text-gray-600">
                  This is your collection view: condition + what you paid + notes. Catalogue info stays in catalog.
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Stat label="Quantity" value={String(item.quantity ?? 0)} />
                  <Stat label="Condition" value={conditionLabel(item)} />
                  <Stat label="Paid" value={paidCad == null ? "—" : moneyCad(paidCad)} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Notes</div>
                  <div className="mt-2 text-sm text-gray-600">{item.notes?.trim() ? item.notes : "No notes yet."}</div>
                </div>
              </div>
            </div>
          )}

          {tab === "copies" && (
            <CopiesList
              catalogItemId={catalogItemId}
              itemName={title}
              // If your CopiesList expects real rows, change CopiesList to fetch internally by catalogItemId.
              copies={[] as any}
              worthCad={worthCad}
            />
          )}

          {tab === "variants" && <VariantsTab catalogItemId={catalogItemId} />}
          {tab === "reviews" && <ReviewsTab catalogItemId={catalogItemId} />}
          {tab === "sales" && <SalesHistoryTab catalogItemId={catalogItemId} />}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
