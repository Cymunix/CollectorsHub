"use client";

import React, { useMemo, useState } from "react";
import VariantsTab from "./VariantsTab";
import ReviewsTab from "./ReviewsTab";
import SalesHistoryTab from "./SalesHistoryTab";

type TabKey = "overview" | "variants" | "reviews" | "sales";

export default function ItemTabs({ catalogItemId, itemName }: { catalogItemId: string; itemName: string }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs = useMemo(
    () =>
      [
        { key: "overview" as const, label: "Overview" },
        { key: "variants" as const, label: "Variants" },
        { key: "reviews" as const, label: "Reviews" },
        { key: "sales" as const, label: "Sales History" },
      ] as const,
    []
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              "rounded-full border px-4 py-2 text-sm transition",
              tab === t.key ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "overview" && <Overview itemName={itemName} />}
        {tab === "variants" && <VariantsTab catalogItemId={catalogItemId} />}
        {tab === "reviews" && <ReviewsTab catalogItemId={catalogItemId} />}
        {tab === "sales" && <SalesHistoryTab catalogItemId={catalogItemId} />}
      </div>
    </div>
  );
}

function Overview({ itemName }: { itemName: string }) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="text-lg font-semibold">{itemName}</div>
      <div className="mt-1 text-sm text-gray-600">
        This is the quick summary area. Keep it clean: basic info, a short description, maybe key stats later.
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Stat label="Avg Sale" value="—" />
        <Stat label="Last Sale" value="—" />
        <Stat label="Reviews" value="—" />
      </div>
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
