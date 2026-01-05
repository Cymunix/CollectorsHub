// components/catalog/add-item/sections/kinds/CardsSection.tsx
"use client";

import React, { useMemo } from "react";

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

export default function CardsSection(p: {
  saving: boolean;

  cardManufacturers: any[];
  cardSets: any[];
  cardTypes: any[];

  cardManufacturerId: string;
  setCardManufacturerId: (v: string) => void;

  cardSetId: string;
  setCardSetId: (v: string) => void;

  cardTypeId: string;
  setCardTypeId: (v: string) => void;

  cardNumber: string;
  setCardNumber: (v: string) => void;

  cardYear: string;
  setCardYear: (v: string) => void;

  onCreateCardManufacturer: () => void;
  onCreateCardSet: () => void;
  onCreateCardType: () => void;
}) {
  const filteredCardSets = useMemo(() => {
    const manId = String(p.cardManufacturerId ?? "");
    if (!manId) return p.cardSets ?? [];
    return (p.cardSets ?? []).filter((s: any) => String(s.manufacturer_id) === manId);
  }, [p.cardSets, p.cardManufacturerId]);

  return (
    <SectionShell title="Cards" subtitle="Manufacturer, set, and type.">
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#0F172A]">Manufacturer</div>
            <CreateLinkButton onClick={p.onCreateCardManufacturer} disabled={p.saving} />
          </div>
          <select
            value={p.cardManufacturerId ?? ""}
            onChange={(e) => p.setCardManufacturerId(e.target.value)}
            disabled={p.saving}
            className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Select manufacturer…</option>
            {(p.cardManufacturers ?? []).map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#0F172A]">Set</div>
            <CreateLinkButton onClick={p.onCreateCardSet} disabled={p.saving || !p.cardManufacturerId} />
          </div>
          <select
            value={p.cardSetId ?? ""}
            onChange={(e) => p.setCardSetId(e.target.value)}
            disabled={p.saving}
            className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Select set…</option>
            {filteredCardSets.map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#0F172A]">Type</div>
            <CreateLinkButton onClick={p.onCreateCardType} disabled={p.saving} />
          </div>
          <select
            value={p.cardTypeId ?? ""}
            onChange={(e) => p.setCardTypeId(e.target.value)}
            disabled={p.saving}
            className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
          >
            <option value="">Select type…</option>
            {(p.cardTypes ?? []).map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-[#0F172A]">Card Number</div>
            <input
              value={p.cardNumber ?? ""}
              onChange={(e) => p.setCardNumber(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
              placeholder="e.g., XH-3"
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0F172A]">Card Year</div>
            <input
              value={p.cardYear ?? ""}
              onChange={(e) => p.setCardYear(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
              placeholder="e.g., 1992"
            />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
