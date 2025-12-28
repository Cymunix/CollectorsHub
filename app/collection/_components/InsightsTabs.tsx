"use client";

import React, { useState } from "react";

export type InsightsSubTab = "summary" | "breakdowns" | "duplicates" | "completeness" | "lego";

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-black text-white px-3 py-1.5 text-xs font-semibold"
          : "rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      }
    >
      {children}
    </button>
  );
}

export default function InsightsTabs({
  summary,
  breakdowns,
  duplicates,
  completeness,
  lego,
  defaultTab = "summary",
}: {
  summary: React.ReactNode;
  breakdowns: React.ReactNode;
  duplicates: React.ReactNode;
  completeness: React.ReactNode;
  lego: React.ReactNode;
  defaultTab?: InsightsSubTab;
}) {
  const [tab, setTab] = useState<InsightsSubTab>(defaultTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Pill active={tab === "summary"} onClick={() => setTab("summary")}>
          Summary
        </Pill>
        <Pill active={tab === "breakdowns"} onClick={() => setTab("breakdowns")}>
          Breakdowns
        </Pill>
        <Pill active={tab === "duplicates"} onClick={() => setTab("duplicates")}>
          Duplicates
        </Pill>
        <Pill active={tab === "completeness"} onClick={() => setTab("completeness")}>
          Completeness
        </Pill>
        <Pill active={tab === "lego"} onClick={() => setTab("lego")}>
          LEGO
        </Pill>
      </div>

      {tab === "summary" ? summary : null}
      {tab === "breakdowns" ? breakdowns : null}
      {tab === "duplicates" ? duplicates : null}
      {tab === "completeness" ? completeness : null}
      {tab === "lego" ? lego : null}
    </div>
  );
}
