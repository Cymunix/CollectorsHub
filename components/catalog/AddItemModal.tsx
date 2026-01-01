// components/catalog/AddItemModal.tsx
"use client";

import React, { useCallback, useMemo, useState } from "react";

import AddItemModalShell from "./AddItemModal.shell";

import { useCatalogMeta } from "./add-item/hooks/useCatalogMeta";
import { useAddItemForm } from "./add-item/hooks/useAddItemForm";
import { useVariantLinks } from "./add-item/hooks/useVariantLinks";
import { useMinifigs } from "./add-item/hooks/useMinifigs";
import { usePeoplePicker } from "./add-item/hooks/usePeoplePicker";

import { safeInsertLookup } from "@/lib/catalog/lookups";
import { createCatalogItem } from "@/lib/catalog/createCatalogItem";

import { ensureBuildingBlocksRow, upsertSetMinifigLinks } from "@/lib/db/catalog";
import { upsertItemDescription } from "@/lib/db/catalog_write";
import { applyVariantGroupLinks } from "@/lib/db/variant_groups_write";

import ClassificationSection from "./add-item/sections/ClassificationSection";
import PhotoSection from "./add-item/sections/PhotoSection";
import GlobalDetailsSection from "./add-item/sections/GlobalDetailsSection";
import WikiSection from "./add-item/sections/WikiSection";
import VariantsSection from "./add-item/sections/VariantsSection";

// ✅ render only this kind section (won't break other kinds)
import GamingSection from "./add-item/sections/kinds/GamingSection";

import CreateMinifigModal from "./add-item/modals/CreateMinifigModal";

import { supabase } from "@/lib/supabaseClient";
import { replaceBundleComponents } from "@/lib/catalog/queries";

// ✅ NEW: franchises editor (many-to-many)
import ItemFranchiseEditor from "@/components/catalog/ItemFranchiseEditor";

/* ---------------- types ---------------- */

type NamedRow = { id: string; name: string };

type CatalogMeta = {
  categories: any[];
  subcategories: any[];
  franchises: NamedRow[];

  bbThemes: any[];
  bbSubthemes: any[];

  cardManufacturers: any[];
  cardSets: any[];
  cardTypes: any[];

  musicArtists: any[];

  toyManufacturers: any[];
  toyBrands: any[];
  toyLines: any[];

  people: NamedRow[];

  gamePlatforms: NamedRow[];
  gamePublishers: NamedRow[];

  comicPublishers: any[];

  [key: string]: any;
};

type CatalogSearchRow = {
  id: string;
  name: string;
  image_url: string | null;
  release_year: number | null;
  version: string | null;
};

type BundleDraftRow = {
  component_item_id: string;
  name: string;
  qty: number;
};

/* ---------------- production status ---------------- */

const PRODUCTION_STATUSES = [
  { value: "in_production", label: "In Production" },
  { value: "out_of_production", label: "Out of Production" },
  { value: "discontinued", label: "Discontinued" },
  { value: "limited_run", label: "Limited Run" },
  { value: "preorder", label: "Pre-Order" },
  { value: "unknown", label: "Unknown" },
] as const;

/* ---------------- utils ---------------- */

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function clampQty(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

/* ---------------- component ---------------- */

export default function AddItemModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (catalogItemId: string) => void;
}) {
  const { meta, setMeta, metaLoading, metaError } = useCatalogMeta(open) as {
    meta: CatalogMeta;
    setMeta: React.Dispatch<React.SetStateAction<CatalogMeta>>;
    metaLoading: boolean;
    metaError: string | null;
  };

  const form = useAddItemForm(meta) as any;
  const variants = useVariantLinks();
  const people = usePeoplePicker(meta.people);
  const minifigs = useMinifigs(() => form.subcategoryId, () => form.franchiseId);

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  // ✅ keep modal open after create so we can attach franchises
  const [createdCatalogItemId, setCreatedCatalogItemId] = useState<string | null>(null);
  const [createdDone, setCreatedDone] = useState(false);

  // Bundles (draft)
  const [isBundle, setIsBundle] = useState(false);
  const [bundleRows, setBundleRows] = useState<BundleDraftRow[]>([]);
  const [bundleQuery, setBundleQuery] = useState("");
  const [bundleSearching, setBundleSearching] = useState(false);
  const [bundleResults, setBundleResults] = useState<CatalogSearchRow[]>([]);
  const [bundleUiErr, setBundleUiErr] = useState<string | null>(null);

  const title = useMemo(() => {
    const kind = String(form.itemKind || "building_blocks").replace(/_/g, " ");
    return `Create Catalog Item • ${kind}`;
  }, [form.itemKind]);

  const safeClose = () => {
    if (!saving) {
      setBanner(null);
      setCreatedCatalogItemId(null);
      setCreatedDone(false);
      onClose();
    }
  };

  const resetAll = () => {
    form.reset?.();
    variants.resetVariants();
    minifigs.resetMinifigs();
    people.resetPeople();

    setIsBundle(false);
    setBundleRows([]);
    setBundleQuery("");
    setBundleResults([]);
    setBundleUiErr(null);

    setBanner(null);

    setCreatedCatalogItemId(null);
    setCreatedDone(false);
  };

  const promptName = (label: string) => (window.prompt(`New ${label} name:`) || "").trim();

  /* ---------------- lookup creators ---------------- */

  const createFranchise = async () => {
    const name = promptName("franchise");
    if (!name) return;

    const row = await safeInsertLookup("franchises", name);
    if (!row) return;

    setMeta((m) => ({
      ...m,
      franchises: [...(m.franchises ?? []), row].sort((a, b) => a.name.localeCompare(b.name)),
    }));

    form.setFranchiseId?.(row.id);
  };

  /* ---------------- bundle helpers ---------------- */

  const bundleIds = useMemo(() => new Set(bundleRows.map((r) => r.component_item_id)), [bundleRows]);

  const searchBundleComponents = useCallback(async () => {
    const q = String(bundleQuery ?? "").trim();
    if (q.length < 2) {
      setBundleResults([]);
      return;
    }

    setBundleSearching(true);
    setBundleUiErr(null);

    try {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("id,name,image_url,release_year,version")
        .ilike("name", `%${q}%`)
        .limit(20);

      if (error) throw error;

      const rows = ((data ?? []) as any[]).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? "Item"),
        image_url: r.image_url ?? null,
        release_year: typeof r.release_year === "number" ? r.release_year : null,
        version: r.version ?? null,
      })) as CatalogSearchRow[];

      setBundleResults(rows);
    } catch (e: any) {
      setBundleUiErr(e?.message ?? "Failed to search catalog items.");
    } finally {
      setBundleSearching(false);
    }
  }, [bundleQuery]);

  const addBundleComponent = useCallback(
    (r: CatalogSearchRow) => {
      if (!r?.id) return;
      if (bundleIds.has(r.id)) return;

      setBundleRows((prev) => [...prev, { component_item_id: r.id, name: r.name, qty: 1 }]);
    },
    [bundleIds]
  );

  const removeBundleComponent = useCallback((id: string) => {
    setBundleRows((prev) => prev.filter((r) => r.component_item_id !== id));
  }, []);

  const setBundleQty = useCallback((id: string, qty: any) => {
    const v = clampQty(qty);
    setBundleRows((prev) => prev.map((r) => (r.component_item_id === id ? { ...r, qty: v } : r)));
  }, []);

  /* ---------------- finish ---------------- */

  const finish = useCallback(() => {
    if (!createdCatalogItemId) return;
    onCreated?.(createdCatalogItemId);
    resetAll();
    onClose();
  }, [createdCatalogItemId, onCreated, onClose]);

  /* ---------------- submit ---------------- */

  const submit = async () => {
    // After create, the primary action becomes "Finish"
    if (createdDone && createdCatalogItemId) {
      finish();
      return;
    }

    if (saving) return;
    setSaving(true);
    setBanner(null);

    const minifigsSnapshot = [...(minifigs.selectedMinifigs ?? [])];
    const bundleSnapshot = [...bundleRows];

    try {
      const id = await createCatalogItem(form.itemKind, {
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,

        // legacy single franchise
        franchiseId: form.franchiseId || null,

        itemImageFile: form.itemImageFile,
        catalogName: form.catalogName,
        catalogReleaseYear: form.catalogReleaseYear,
        catalogUPC: form.catalogUPC,
        catalogVersion: form.catalogVersion,

        productionStatus: form.productionStatus ?? "unknown",

        wikiSummary: form.wikiSummary,
        wikiDescription: form.wikiDescription,
        wikiFacts: form.wikiFacts,
        wikiChecklist: form.wikiChecklist,
        wikiSources: form.wikiSources,

        linkedVariants: variants.linkedVariants,

        // building blocks
        bbThemeId: form.bbThemeId,
        bbSubthemeId: form.bbSubthemeId,
        bbSetNumber: form.bbSetNumber,
        bbPieceCount: form.bbPieceCount,
        bbRetailCad: form.bbRetailCad,
        bbRetailUsd: form.bbRetailUsd,
        selectedMinifigs: minifigsSnapshot,

        // cards
        cardManufacturerId: form.cardManufacturerId,
        cardSetId: form.cardSetId,
        cardTypeId: form.cardTypeId,
        cardNumber: form.cardNumber,
        cardYear: form.cardYear,
        cardRarityDropdown: form.cardRarityDropdown,
        cardRarityCustom: form.cardRarityCustom,

        // music
        musicArtistId: form.musicArtistId,

        // toys
        toyManufacturerId: form.toyManufacturerId,
        toyBrandId: form.toyBrandId,
        toyLineId: form.toyLineId,
        toyModelNumber: form.toyModelNumber,

        // movies
        movieDirectorIds: people.movieDirectorIds,
        movieActorIds: people.movieActorIds,

        // gaming
        gamePlatformId: form.gamePlatformId,
        gamePublisherId: form.gamePublisherId,

        // comics
        comicPublisherId: form.comicPublisherId,
        comicSeries: form.comicSeries,
        comicIssueNumber: form.comicIssueNumber,
        comicVariant: form.comicVariant,
      });

      // ✅ AUTO-SYNC: legacy franchiseId -> join table as PRIMARY
      if (form.franchiseId) {
        const { error: upErr } = await supabase.from("catalog_item_franchises").upsert(
          [
            {
              catalog_item_id: id,
              franchise_id: form.franchiseId,
              role: "primary",
            },
          ],
          { onConflict: "catalog_item_id,franchise_id" }
        );
        if (upErr) throw upErr;
      }

      await upsertItemDescription(id, form.wikiDescription);

      // Variant group linking
      await applyVariantGroupLinks({
        catalogItemId: id,
        linkedVariants: variants.linkedVariants ?? [],
        variantName: form.catalogVersion || variants.variantDefaultLabel || null,
      });

      if (form.itemKind === "building_blocks") {
        await ensureBuildingBlocksRow(id, {
          themeId: form.bbThemeId!,
          subthemeId: form.bbSubthemeId || null,
          setNumber: form.bbSetNumber!,
          pieceCount: form.bbPieceCount,
          retailCad: form.bbRetailCad,
          retailUsd: form.bbRetailUsd,
        });

        if (minifigsSnapshot.length) {
          await upsertSetMinifigLinks(id, minifigsSnapshot);
        }
      }

      // Bundles: flag + components
      if (isBundle) {
        const { error: bErr } = await supabase.from("catalog_items").update({ is_bundle: true }).eq("id", id);
        if (bErr) throw bErr;

        if (bundleSnapshot.length) {
          await replaceBundleComponents(
            id,
            bundleSnapshot.map((r) => ({
              component_item_id: r.component_item_id,
              qty: clampQty(r.qty),
              role: null,
              notes: null,
            }))
          );
        }
      }

      // Keep modal open so franchises can be attached
      setCreatedCatalogItemId(id);
      setCreatedDone(true);

      setBanner({
        type: "success",
        msg: "Item created. Franchise was set as Primary. Add more franchises if needed, then click Finish.",
      });
    } catch (e: any) {
      setBanner({ type: "error", msg: e?.message || "Failed to create item." });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- render ---------------- */

  return (
    <>
      <AddItemModalShell
        open={open}
        title={title}
        saving={saving}
        banner={banner}
        onClose={safeClose}
        onSubmit={submit}
      >
        <form onSubmit={(e) => (e.preventDefault(), submit())}>
          <ClassificationSection
            metaLoading={metaLoading}
            metaError={metaError}
            categories={meta.categories}
            subcategories={meta.subcategories}
            franchises={meta.franchises}
            categoryId={form.categoryId}
            setCategoryId={form.setCategoryId}
            subcategoryId={form.subcategoryId}
            setSubcategoryId={form.setSubcategoryId}
            franchiseId={form.franchiseId}
            setFranchiseId={form.setFranchiseId}
            onCreateFranchise={createFranchise}
          />

          <div className="mt-4">
            <ItemFranchiseEditor catalogItemId={createdCatalogItemId} disabled={saving} />
          </div>

          {createdDone && createdCatalogItemId ? (
            <div className="mt-4 rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-[#0F172A]">Next step</div>
              <div className="mt-1 text-xs text-[#64748B]">
                Franchise is already set as <b>Primary</b>. Add more franchises if needed, then click <b>Finish</b>.
              </div>
              <div className="mt-2 text-[11px] text-[#64748B]">
                Item ID: <span className="font-mono">{createdCatalogItemId}</span>
              </div>
            </div>
          ) : null}

          <PhotoSection itemImagePreview={form.itemImagePreview} onPick={form.pickItemImage} />

          <GlobalDetailsSection {...form} />

          {/* Production Status */}
          <div className="mt-4 rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-[#0F172A]">Production Status</div>
            <div className="mt-1 text-xs text-[#64748B]">
              Helps filters + pricing expectations. Use <b>Unknown</b> if you’re not sure.
            </div>

            <div className="mt-3">
              <select
                value={form.productionStatus ?? "unknown"}
                onChange={(e) => form.setProductionStatus?.(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
              >
                {PRODUCTION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bundles Section (draft) */}
          <div className="mt-4 rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">Bundle</div>
                <div className="text-xs text-[#64748B]">Mark this item as a bundle and define what it includes.</div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                <input
                  type="checkbox"
                  checked={isBundle}
                  onChange={(e) => setIsBundle(!!e.target.checked)}
                  disabled={saving}
                  className="h-4 w-4"
                />
                This item is a bundle
              </label>
            </div>

            {isBundle ? (
              <div className="mt-4">
                {bundleUiErr ? (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    {bundleUiErr}
                  </div>
                ) : null}

                <div className="text-xs font-semibold text-[#0F172A]">Included items</div>

                <div className="mt-2 space-y-2">
                  {bundleRows.length === 0 ? (
                    <div className="rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">
                      No components added yet.
                    </div>
                  ) : (
                    bundleRows.map((r) => (
                      <div
                        key={r.component_item_id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E9F2] bg-white p-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[#0F172A]">{safeText(r.name)}</div>
                          <div className="text-[11px] text-[#64748B]">{r.component_item_id}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={r.qty}
                            onChange={(e) => setBundleQty(r.component_item_id, e.target.value)}
                            disabled={saving}
                            className="w-20 rounded-lg border border-[#E5E9F2] px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeBundleComponent(r.component_item_id)}
                            disabled={saving}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                              saving
                                ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                                : "bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                            }`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 border-t border-[#E5E9F2] pt-4">
                  <div className="text-xs font-semibold text-[#0F172A]">Add components</div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={bundleQuery}
                      onChange={(e) => setBundleQuery(e.target.value)}
                      placeholder="Search catalog items..."
                      className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={searchBundleComponents}
                      disabled={saving || bundleSearching || String(bundleQuery).trim().length < 2}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition ${
                        saving || bundleSearching || String(bundleQuery).trim().length < 2
                          ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                          : "bg-[#0F172A] text-white"
                      }`}
                    >
                      {bundleSearching ? "Searching..." : "Search"}
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {bundleResults.map((r) => {
                      const already = bundleIds.has(r.id);
                      const subtitle = `${r.release_year ?? "—"}${r.version ? ` • ${r.version}` : ""}`;
                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E9F2] bg-white p-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#0F172A]">{safeText(r.name)}</div>
                            <div className="text-[11px] text-[#64748B] truncate">{subtitle}</div>
                          </div>

                          <button
                            type="button"
                            onClick={() => addBundleComponent(r)}
                            disabled={saving || already}
                            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                              saving || already
                                ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                                : "bg-white border text-[#0F172A] hover:bg-[#F8FAFC]"
                            }`}
                          >
                            {already ? "Added" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-[11px] text-[#64748B]">Components are saved after the item is created.</div>
                </div>
              </div>
            ) : null}
          </div>

          {form.itemKind === "gaming" ? (
            <GamingSection
              gamePlatforms={meta.gamePlatforms ?? []}
              gamePublishers={meta.gamePublishers ?? []}
              gamePlatformId={form.gamePlatformId ?? ""}
              setGamePlatformId={form.setGamePlatformId}
              gamePublisherId={form.gamePublisherId ?? ""}
              setGamePublisherId={form.setGamePublisherId}
              canCreate={true}
              onPlatformCreated={(row) =>
                setMeta((m) => ({
                  ...m,
                  gamePlatforms: [...(m.gamePlatforms ?? []), row].sort((a, b) => a.name.localeCompare(b.name)),
                }))
              }
              onPublisherCreated={(row) =>
                setMeta((m) => ({
                  ...m,
                  gamePublishers: [...(m.gamePublishers ?? []), row].sort((a, b) => a.name.localeCompare(b.name)),
                }))
              }
            />
          ) : null}

          <WikiSection {...form} />

          <VariantsSection
            LINK_TYPES={variants.LINK_TYPES}
            variantQuery={variants.variantQuery}
            setVariantQuery={variants.setVariantQuery}
            variantSearching={variants.variantSearching}
            variantResults={variants.variantResults}
            linkedVariants={variants.linkedVariants}
            variantDefaultType={variants.variantDefaultType}
            setVariantDefaultType={variants.setVariantDefaultType}
            variantDefaultLabel={variants.variantDefaultLabel}
            setVariantDefaultLabel={variants.setVariantDefaultLabel}
            searchVariants={variants.searchVariants}
            addVariant={variants.addVariant}
            removeVariant={variants.removeVariant}
            updateVariant={variants.updateVariant}
          />
        </form>
      </AddItemModalShell>

      <CreateMinifigModal
        open={minifigs.minifigCreateOpen}
        creating={minifigs.creatingMinifig}
        onClose={() => minifigs.setMinifigCreateOpen(false)}
        newMinifigNumber={minifigs.newMinifigNumber}
        setNewMinifigNumber={minifigs.setNewMinifigNumber}
        newMinifigName={minifigs.newMinifigName}
        setNewMinifigName={minifigs.setNewMinifigName}
        newMinifigImagePreview={minifigs.newMinifigImagePreview}
        onPickImage={minifigs.pickNewMinifigImage}
        onCreate={minifigs.createMinifigWithImage}
      />
    </>
  );
}
