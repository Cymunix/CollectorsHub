// components/catalog/add-item/sections/kinds/BuildingBlocksSection.tsx
"use client";

import React, { useMemo } from "react";

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

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

function CreateLinkButton({
  onClick,
  disabled,
  label = "Create",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabled}
      className="text-xs font-semibold text-[#0F172A] underline disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export default function BuildingBlocksSection(p: {
  saving: boolean;

  bbThemes: any[];
  bbSubthemes: any[];

  bbThemeId: string;
  setBbThemeId: (v: string) => void;

  bbSubthemeId: string;
  setBbSubthemeId: (v: string) => void;

  bbSetNumber: string;
  setBbSetNumber: (v: string) => void;

  bbPieceCount: string;
  setBbPieceCount: (v: string) => void;

  bbRetailCad: string;
  setBbRetailCad: (v: string) => void;

  bbRetailUsd: string;
  setBbRetailUsd: (v: string) => void;

  onCreateBbTheme: () => void;
  onCreateBbSubtheme: () => void;

  minifigs: any;
}) {
  const filteredSubthemes = useMemo(() => {
    const themeId = String(p.bbThemeId ?? "");
    if (!themeId) return p.bbSubthemes ?? [];
    return (p.bbSubthemes ?? []).filter((s: any) => String(s.theme_id) === themeId);
  }, [p.bbSubthemes, p.bbThemeId]);

  return (
    <SectionShell title="Building Blocks" subtitle="Themes, set details, and minifigs.">
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#0F172A]">Theme</div>
            <CreateLinkButton onClick={p.onCreateBbTheme} disabled={p.saving} />
          </div>
          <select
            value={p.bbThemeId ?? ""}
            onChange={(e) => p.setBbThemeId(e.target.value)}
            disabled={p.saving}
            className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Select theme…</option>
            {(p.bbThemes ?? []).map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#0F172A]">Subtheme</div>
            <CreateLinkButton onClick={p.onCreateBbSubtheme} disabled={p.saving || !p.bbThemeId} />
          </div>
          <select
            value={p.bbSubthemeId ?? ""}
            onChange={(e) => p.setBbSubthemeId(e.target.value)}
            disabled={p.saving}
            className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Select subtheme…</option>
            {filteredSubthemes.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-[#0F172A]">Set Number</div>
            <input
              value={p.bbSetNumber ?? ""}
              onChange={(e) => p.setBbSetNumber(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
              placeholder="e.g., 75313"
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0F172A]">Piece Count</div>
            <input
              value={p.bbPieceCount ?? ""}
              onChange={(e) => p.setBbPieceCount(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
              placeholder="e.g., 1022"
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0F172A]">Retail CAD</div>
            <input
              value={p.bbRetailCad ?? ""}
              onChange={(e) => p.setBbRetailCad(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
              placeholder="e.g., 199.99"
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0F172A]">Retail USD</div>
            <input
              value={p.bbRetailUsd ?? ""}
              onChange={(e) => p.setBbRetailUsd(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
              placeholder="e.g., 159.99"
            />
          </div>
        </div>

        {/* Minifigs */}
        <div className="mt-2 rounded-2xl border border-[#E5E9F2] bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[#0F172A]">Minifigs</div>
            <CreateLinkButton
              label="Create Minifig"
              onClick={() => (p.minifigs as any).setMinifigCreateOpen?.(true)}
              disabled={p.saving}
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              value={(p.minifigs as any).minifigQuery ?? ""}
              onChange={(e) => (p.minifigs as any).setMinifigQuery?.(e.target.value)}
              placeholder="Search minifigs..."
              disabled={p.saving}
              className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => (p.minifigs as any).searchMinifigs?.()}
              disabled={p.saving || !!(p.minifigs as any).minifigSearching}
              className="rounded-xl bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-200 disabled:text-gray-600"
            >
              {(p.minifigs as any).minifigSearching ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {((p.minifigs as any).minifigResults ?? []).map((r: any) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E9F2] bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#0F172A]">{safeText(r.name)}</div>
                  <div className="text-[11px] text-[#64748B]">{safeText(r.minifig_number)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => (p.minifigs as any).addMinifig?.(r)}
                  disabled={p.saving}
                  className="rounded-lg border px-3 py-1 text-xs font-semibold hover:bg-[#F8FAFC]"
                >
                  Add
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-[#0F172A]">Selected</div>
            <div className="mt-2 space-y-2">
              {((p.minifigs as any).selectedMinifigs ?? []).length === 0 ? (
                <div className="rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">None selected.</div>
              ) : (
                ((p.minifigs as any).selectedMinifigs ?? []).map((m: any) => (
                  <div
                    key={m.instance_key ?? m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E9F2] bg-white p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#0F172A]">{safeText(m.name)}</div>
                      <div className="text-[11px] text-[#64748B]">{safeText(m.minifig_number)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={m.qty ?? 1}
                        onChange={(e) => (p.minifigs as any).updateMinifigQty?.(m, e.target.value)}
                        disabled={p.saving}
                        className="w-20 rounded-lg border border-[#E5E9F2] px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => (p.minifigs as any).removeMinifig?.(m)}
                        disabled={p.saving}
                        className="rounded-lg border px-2 py-1 text-xs font-semibold hover:bg-[#F8FAFC]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
