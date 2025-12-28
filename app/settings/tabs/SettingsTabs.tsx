// app/settings/tabs/SettingsTabs.tsx
"use client";

import React from "react";

export type TabKey = "profile" | "security" | "preferences" | "privacy";

export default function SettingsTabs({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (t: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "security", label: "Security" },
    { key: "preferences", label: "Preferences" },
    { key: "privacy", label: "Privacy & Data" },
  ];

  return (
    <div className="mb-6 border-b border-[#E5E9F2] dark:border-[#1F2937]">
      <div className="flex gap-4 text-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={[
              "pb-2 border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-[#2563EB] text-[#111827] dark:text-white font-semibold"
                : "border-transparent text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white",
            ].join(" ")}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
