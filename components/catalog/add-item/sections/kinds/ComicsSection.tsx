// components/catalog/add-item/sections/kinds/ComicsSection.tsx
"use client";

import React from "react";

function SectionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-[#0F172A]">{title}</div>
      {subtitle ? <div className="mt-1 text-xs text-[#64748B]">{subtitle}</div> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function ComicsSection(p: {
  saving: boolean;

  comicPublishers: any[];
  comicPublisherId: string;
  setComicPublisherId: (v: string) => void;

  comicSeries: string;
  setComicSeries: (v: string) => void;

  comicIssueNumber: string;
  setComicIssueNumber: (v: string) => void;

  comicVariant: string;
  setComicVariant: (v: string) => void;
}) {
  return (
    <SectionShell title="Comics" subtitle="Publisher and issue details.">
      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold text-[#0F172A]">Publisher</div>
          <select
            value={p.comicPublisherId ?? ""}
            onChange={(e) => p.setComicPublisherId(e.target.value)}
            disabled={p.saving}
            className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Select publisher…</option>
            {(p.comicPublishers ?? []).map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs font-semibold text-[#0F172A]">Series</div>
            <input
              value={p.comicSeries ?? ""}
              onChange={(e) => p.setComicSeries(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
              placeholder="e.g., Amazing Spider-Man"
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0F172A]">Issue #</div>
            <input
              value={p.comicIssueNumber ?? ""}
              onChange={(e) => p.setComicIssueNumber(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
              placeholder="e.g., 129"
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0F172A]">Variant</div>
            <input
              value={p.comicVariant ?? ""}
              onChange={(e) => p.setComicVariant(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
              placeholder="e.g., Cover B"
            />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
