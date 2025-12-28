// components/catalog/add-item/sections/kinds/CardsSection.tsx
"use client";

import React from "react";
import FieldLabel from "../../blocks/FieldLabel";
import Select from "../../blocks/Select";
import TextInput from "../../blocks/TextInput";
import InlineCreateButton from "../../blocks/InlineCreateButton";
import type { CardManufacturer, CardSet, CardType, ItemKind } from "@/lib/catalog/types";

const RARITY_OPTIONS = [
  "",
  "Common",
  "Uncommon",
  "Rare",
  "Ultra Rare",
  "Secret Rare",
  "Chase",
  "Promo",
  "Parallel",
  "Holofoil",
];

export default function CardsSection({
  itemKind,

  cardManufacturers,
  cardSets,
  cardTypes,

  cardManufacturerId,
  setCardManufacturerId,
  cardSetId,
  setCardSetId,
  cardTypeId,
  setCardTypeId,
  cardNumber,
  setCardNumber,
  cardYear,
  setCardYear,

  // ✅ rarity
  cardRarityDropdown,
  setCardRarityDropdown,
  cardRarityCustom,
  setCardRarityCustom,

  cardSetOptions,

  onCreateCardManufacturer,
  onCreateCardSet,
  onCreateCardType,
}: {
  itemKind: ItemKind;

  cardManufacturers: CardManufacturer[];
  cardSets: CardSet[];
  cardTypes: CardType[];

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

  cardRarityDropdown: string;
  setCardRarityDropdown: (v: string) => void;
  cardRarityCustom: string;
  setCardRarityCustom: (v: string) => void;

  cardSetOptions: CardSet[];

  onCreateCardManufacturer: () => void;
  onCreateCardSet: () => void;
  onCreateCardType: () => void;
}) {
  const title = itemKind === "sports_card" ? "Sports Cards" : "Trading Cards";

  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold">{title}</h3>
        <span className="text-[11px] text-gray-500">Required: Manufacturer, Set, Type, Card #, Year</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel req>Manufacturer</FieldLabel>
            <InlineCreateButton onClick={onCreateCardManufacturer}>+ New</InlineCreateButton>
          </div>
          <Select
            value={cardManufacturerId}
            onChange={(e) => {
              setCardManufacturerId(e.target.value);
              setCardSetId("");
            }}
          >
            <option value="">Select…</option>
            {cardManufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel req>Set</FieldLabel>
            <InlineCreateButton onClick={onCreateCardSet} disabled={!cardManufacturerId}>
              + New
            </InlineCreateButton>
          </div>
          <Select value={cardSetId} onChange={(e) => setCardSetId(e.target.value)} disabled={!cardManufacturerId}>
            <option value="">{cardManufacturerId ? "Select…" : "Select manufacturer first"}</option>
            {cardSetOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel req>Card Type</FieldLabel>
            <InlineCreateButton onClick={onCreateCardType}>+ New</InlineCreateButton>
          </div>
          <Select value={cardTypeId} onChange={(e) => setCardTypeId(e.target.value)}>
            <option value="">Select…</option>
            {cardTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <FieldLabel req>Card Number</FieldLabel>
          <TextInput value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="e.g. 123" />
        </div>

        <div className="space-y-1">
          <FieldLabel req>Year</FieldLabel>
          <TextInput value={cardYear} onChange={(e) => setCardYear(e.target.value)} inputMode="numeric" placeholder="e.g. 1999" />
        </div>

        {/* ✅ RARITY (TRADING CARD ONLY - requested) */}
        {itemKind === "trading_card" && (
          <>
            <div className="space-y-1">
              <FieldLabel>Rarity (dropdown)</FieldLabel>
              <Select value={cardRarityDropdown} onChange={(e) => setCardRarityDropdown(e.target.value)}>
                {RARITY_OPTIONS.map((opt) => (
                  <option key={opt || "none"} value={opt}>
                    {opt || "(none)"}
                  </option>
                ))}
              </Select>
              <div className="text-[11px] text-gray-500">Optional. Used if Custom rarity is blank.</div>
            </div>

            <div className="space-y-1">
              <FieldLabel>Custom rarity</FieldLabel>
              <TextInput
                value={cardRarityCustom}
                onChange={(e) => setCardRarityCustom(e.target.value)}
                placeholder='Optional override (e.g. "SP", "SR", "1st Edition Holo")'
              />
              <div className="text-[11px] text-gray-500">If filled, this overrides the dropdown.</div>
            </div>
          </>
        )}

        <p className="text-[11px] text-gray-500 md:col-span-2">Note: Release Year is captured in Item Details above.</p>
      </div>
    </div>
  );
}
