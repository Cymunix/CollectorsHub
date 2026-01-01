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

// kind section you already had
import GamingSection from "./add-item/sections/kinds/GamingSection";

import CreateMinifigModal from "./add-item/modals/CreateMinifigModal";

import { supabase } from "@/lib/supabaseClient";
import { replaceBundleComponents } from "@/lib/catalog/queries";

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

function sortByName<T extends { name: string }>(arr: T[]) {
  return [...arr].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function uniqStrings(xs: string[]) {
  return Array.from(new Set(xs.filter(Boolean)));
}

function toggleId(list: string[], id: string) {
  const s = new Set(list);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  return Array.from(s);
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

/**
 * SAFE lookup insert: if it fails, it shows the real error in the banner
 * instead of appearing to do nothing.
 */
async function insertLookupRowSafe<T extends { id: string; name: string }>(
  table: string,
  payload: Record<string, any>,
  setBanner: (b: { type: "error" | "success"; msg: string } | null) => void
): Promise<T | null> {
  try {
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();
    if (error) throw error;
    return data as T;
  } catch (e: any) {
    setBanner({ type: "error", msg: e?.message ?? `Insert failed: ${table}` });
    console.error("Lookup insert failed:", table, payload, e);
    return null;
  }
}

/* ---------------- slug helpers (for NOT NULL slug tables) ---------------- */

function slugify(input: any) {
  const s = String(input ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = s
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "item";
}

/**
 * Insert into a lookup table that requires a NOT NULL slug.
 * - Attempts base slug first
 * - If collision, retries with random suffix
 */
async function insertWithSlugSafe<T extends { id: string; name: string }>(
  table: string,
  payload: Record<string, any>,
  setBanner: (b: { type: "error" | "success"; msg: string } | null) => void
): Promise<T | null> {
  try {
    const base = slugify(payload?.name);

    // attempt 1
    let { data, error } = await supabase
      .from(table)
      .insert({ ...payload, slug: base })
      .select("*")
      .single();

    if (!error) return data as T;

    // attempt 2 (collision safe)
    const suffix = Math.random().toString(36).slice(2, 7);
    ({ data, error } = await supabase
      .from(table)
      .insert({ ...payload, slug: `${base}-${suffix}` })
      .select("*")
      .single());

    if (error) throw error;
    return data as T;
  } catch (e: any) {
    setBanner({ type: "error", msg: e?.message ?? `Insert failed: ${table}` });
    console.error("insertWithSlugSafe failed:", table, payload, e);
    return null;
  }
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

  // keep modal open after create so we can attach franchises
  const [createdCatalogItemId, setCreatedCatalogItemId] = useState<string | null>(null);
  const [createdDone, setCreatedDone] = useState(false);

  // Bundles
  const [isBundle, setIsBundle] = useState(false);
  const [bundleRows, setBundleRows] = useState<BundleDraftRow[]>([]);
  const [bundleQuery, setBundleQuery] = useState("");
  const [bundleSearching, setBundleSearching] = useState(false);
  const [bundleResults, setBundleResults] = useState<CatalogSearchRow[]>([]);
  const [bundleUiErr, setBundleUiErr] = useState<string | null>(null);

  const kind = String(form.itemKind || "building_blocks");

  const title = useMemo(() => {
    const k = String(form.itemKind || "building_blocks").replace(/_/g, " ");
    return `Create Catalog Item • ${k}`;
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
    variants.resetVariants?.();
    minifigs.resetMinifigs?.();
    people.resetPeople?.();

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

    try {
      const row = await safeInsertLookup("franchises", name);
      if (!row) return;

      setMeta((m) => ({
        ...m,
        franchises: sortByName([...(m.franchises ?? []), row]),
      }));

      form.setFranchiseId?.(row.id);
    } catch (e: any) {
      setBanner({ type: "error", msg: e?.message ?? "Failed to create franchise." });
      console.error("createFranchise failed:", e);
    }
  };

  const createBbTheme = async () => {
    const name = promptName("theme");
    if (!name) return;

    if (!form.subcategoryId) {
      setBanner({ type: "error", msg: "Select a subcategory before creating a theme." });
      return;
    }

    const row = await insertLookupRowSafe<any>(
      "bb_themes",
      { name, subcategory_id: form.subcategoryId },
      setBanner
    );
    if (!row) return;

    setMeta((m) => ({ ...m, bbThemes: sortByName([...(m.bbThemes ?? []), row]) }));
    form.setBbThemeId?.(row.id);
  };

  const createBbSubtheme = async () => {
    const name = promptName("subtheme");
    if (!name) return;

    if (!form.bbThemeId) {
      setBanner({ type: "error", msg: "Select a theme before creating a subtheme." });
      return;
    }

    const row = await insertLookupRowSafe<any>(
      "bb_subthemes",
      { name, theme_id: form.bbThemeId },
      setBanner
    );
    if (!row) return;

    setMeta((m) => ({ ...m, bbSubthemes: sortByName([...(m.bbSubthemes ?? []), row]) }));
    form.setBbSubthemeId?.(row.id);
  };

  const createCardManufacturer = async () => {
    const name = promptName("card manufacturer");
    if (!name) return;

const row = await insertWithSlugSafe<any>("card_manufacturers", { name }, setBanner);
    if (!row) return;

    setMeta((m) => ({ ...m, cardManufacturers: sortByName([...(m.cardManufacturers ?? []), row]) }));
    form.setCardManufacturerId?.(row.id);
  };

  const createCardSet = async () => {
    const name = promptName("card set");
    if (!name) return;

    if (!form.cardManufacturerId) {
      setBanner({ type: "error", msg: "Select a card manufacturer before creating a set." });
      return;
    }

    const row = await insertWithSlugSafe<any>(
  "card_sets",
  { name, manufacturer_id: form.cardManufacturerId },
  setBanner
);
    if (!row) return;

    setMeta((m) => ({ ...m, cardSets: sortByName([...(m.cardSets ?? []), row]) }));
    form.setCardSetId?.(row.id);
  };

  const createCardType = async () => {
    const name = promptName("card type");
    if (!name) return;

    const row = await insertWithSlugSafe<any>("card_types", { name }, setBanner);
    if (!row) return;

    setMeta((m) => ({ ...m, cardTypes: sortByName([...(m.cardTypes ?? []), row]) }));
    form.setCardTypeId?.(row.id);
  };

  const createMusicArtist = async () => {
    const name = promptName("artist");
    if (!name) return;

    const row = await insertLookupRowSafe<any>("music_artists", { name }, setBanner);
    if (!row) return;

    setMeta((m) => ({ ...m, musicArtists: sortByName([...(m.musicArtists ?? []), row]) }));
    form.setMusicArtistId?.(row.id);
  };

  const createPerson = async () => {
    const name = promptName("person");
    if (!name) return null;

    const row = await insertLookupRowSafe<any>("people", { name }, setBanner);
    if (!row) return null;

    setMeta((m) => ({ ...m, people: sortByName([...(m.people ?? []), row]) }));
    return row;
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
      const id = await createCatalogItem(kind, {
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
        movieDirectorIds: (people as any).movieDirectorIds,
        movieActorIds: (people as any).movieActorIds,

        // gaming
        gamePlatformId: form.gamePlatformId,
        gamePublisherId: form.gamePublisherId,

        // comics
        comicPublisherId: form.comicPublisherId,
        comicSeries: form.comicSeries,
        comicIssueNumber: form.comicIssueNumber,
        comicVariant: form.comicVariant,
      });

      // AUTO-SYNC: legacy franchiseId -> join table as PRIMARY
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

      await applyVariantGroupLinks({
        catalogItemId: id,
        linkedVariants: variants.linkedVariants ?? [],
        variantName: form.catalogVersion || variants.variantDefaultLabel || null,
      });

      if (kind === "building_blocks") {
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

      setCreatedCatalogItemId(id);
      setCreatedDone(true);

      setBanner({
        type: "success",
        msg: "Item created. Franchise was set as Primary. Add crossovers/franchises if needed, then click Finish.",
      });
    } catch (e: any) {
      setBanner({ type: "error", msg: e?.message || "Failed to create item." });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- derived filters ---------------- */

  const bbThemes = meta.bbThemes ?? [];
  const bbSubthemes = meta.bbSubthemes ?? [];
  const filteredSubthemes = useMemo(() => {
    const themeId = String(form.bbThemeId ?? "");
    if (!themeId) return bbSubthemes;
    return bbSubthemes.filter((s: any) => String(s.theme_id) === themeId);
  }, [bbSubthemes, form.bbThemeId]);

  const cardSets = meta.cardSets ?? [];
  const filteredCardSets = useMemo(() => {
    const manId = String(form.cardManufacturerId ?? "");
    if (!manId) return cardSets;
    return cardSets.filter((s: any) => String(s.manufacturer_id) === manId);
  }, [cardSets, form.cardManufacturerId]);

  /* ---------------- render ---------------- */

  return (
    <>
      <AddItemModalShell open={open} title={title} saving={saving} banner={banner} onClose={safeClose} onSubmit={submit}>
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

          {/* Franchise/Crossover editor: only after create */}
          <div className="mt-4">
            {createdCatalogItemId ? (
              <ItemFranchiseEditor catalogItemId={createdCatalogItemId} disabled={saving} />
            ) : (
              <div className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-4 shadow-sm">
                <div className="text-sm font-semibold text-[#0F172A]">Franchises</div>
                <div className="mt-1 text-xs text-[#64748B]">
                  Create the item first. Then you can add crossovers / extra franchises here.
                </div>
              </div>
            )}
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

          {/* =========================
              KIND-SPECIFIC FIELDS
             ========================= */}

          {kind === "building_blocks" ? (
            <SectionShell title="Building Blocks" subtitle="Themes, set details, and minifigs.">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#0F172A]">Theme</div>
                    <CreateLinkButton onClick={createBbTheme} disabled={saving} />
                  </div>
                  <select
                    value={form.bbThemeId ?? ""}
                    onChange={(e) => form.setBbThemeId?.(e.target.value)}
                    disabled={saving}
                    className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select theme…</option>
                    {bbThemes.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#0F172A]">Subtheme</div>
                    <CreateLinkButton onClick={createBbSubtheme} disabled={saving || !form.bbThemeId} />
                  </div>
                  <select
                    value={form.bbSubthemeId ?? ""}
                    onChange={(e) => form.setBbSubthemeId?.(e.target.value)}
                    disabled={saving}
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
                      value={form.bbSetNumber ?? ""}
                      onChange={(e) => form.setBbSetNumber?.(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      placeholder="e.g., 75313"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#0F172A]">Piece Count</div>
                    <input
                      value={form.bbPieceCount ?? ""}
                      onChange={(e) => form.setBbPieceCount?.(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      placeholder="e.g., 1022"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#0F172A]">Retail CAD</div>
                    <input
                      value={form.bbRetailCad ?? ""}
                      onChange={(e) => form.setBbRetailCad?.(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      placeholder="e.g., 199.99"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#0F172A]">Retail USD</div>
                    <input
                      value={form.bbRetailUsd ?? ""}
                      onChange={(e) => form.setBbRetailUsd?.(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      placeholder="e.g., 159.99"
                    />
                  </div>
                </div>

                {/* Minifigs flow */}
                <div className="mt-2 rounded-2xl border border-[#E5E9F2] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[#0F172A]">Minifigs</div>
                    <CreateLinkButton
                      label="Create Minifig"
                      onClick={() => (minifigs as any).setMinifigCreateOpen?.(true)}
                      disabled={saving}
                    />
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={(minifigs as any).minifigQuery ?? ""}
                      onChange={(e) => (minifigs as any).setMinifigQuery?.(e.target.value)}
                      placeholder="Search minifigs..."
                      disabled={saving}
                      className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => (minifigs as any).searchMinifigs?.()}
                      disabled={saving || !!(minifigs as any).minifigSearching}
                      className="rounded-xl bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-200 disabled:text-gray-600"
                    >
                      {(minifigs as any).minifigSearching ? "Searching..." : "Search"}
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {((minifigs as any).minifigResults ?? []).map((r: any) => (
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
                          onClick={() => (minifigs as any).addMinifig?.(r)}
                          disabled={saving}
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
                      {((minifigs as any).selectedMinifigs ?? []).length === 0 ? (
                        <div className="rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">None selected.</div>
                      ) : (
                        ((minifigs as any).selectedMinifigs ?? []).map((m: any) => (
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
                                onChange={(e) => (minifigs as any).updateMinifigQty?.(m, e.target.value)}
                                disabled={saving}
                                className="w-20 rounded-lg border border-[#E5E9F2] px-2 py-1 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => (minifigs as any).removeMinifig?.(m)}
                                disabled={saving}
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
          ) : null}

          {kind === "trading_card" || kind === "sports_card" ? (
            <SectionShell title="Cards" subtitle="Manufacturer, set, and type.">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#0F172A]">Manufacturer</div>
                    <CreateLinkButton onClick={createCardManufacturer} disabled={saving} />
                  </div>
                  <select
                    value={form.cardManufacturerId ?? ""}
                    onChange={(e) => form.setCardManufacturerId?.(e.target.value)}
                    disabled={saving}
                    className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select manufacturer…</option>
                    {(meta.cardManufacturers ?? []).map((x: any) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#0F172A]">Set</div>
                    <CreateLinkButton onClick={createCardSet} disabled={saving || !form.cardManufacturerId} />
                  </div>
                  <select
                    value={form.cardSetId ?? ""}
                    onChange={(e) => form.setCardSetId?.(e.target.value)}
                    disabled={saving}
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
                    <CreateLinkButton onClick={createCardType} disabled={saving} />
                  </div>
                  <select
                    value={form.cardTypeId ?? ""}
                    onChange={(e) => form.setCardTypeId?.(e.target.value)}
                    disabled={saving}
                    className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select type…</option>
                    {(meta.cardTypes ?? []).map((x: any) => (
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
                      value={form.cardNumber ?? ""}
                      onChange={(e) => form.setCardNumber?.(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      placeholder="e.g., XH-3"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#0F172A]">Card Year</div>
                    <input
                      value={form.cardYear ?? ""}
                      onChange={(e) => form.setCardYear?.(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      placeholder="e.g., 1992"
                    />
                  </div>
                </div>
              </div>
            </SectionShell>
          ) : null}

          {kind === "music" ? (
            <SectionShell title="Music" subtitle="Artist selection + create artist.">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[#0F172A]">Artist</div>
                  <CreateLinkButton onClick={createMusicArtist} disabled={saving} />
                </div>
                <select
                  value={form.musicArtistId ?? ""}
                  onChange={(e) => form.setMusicArtistId?.(e.target.value)}
                  disabled={saving}
                  className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select artist…</option>
                  {(meta.musicArtists ?? []).map((x: any) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
            </SectionShell>
          ) : null}

          {kind === "movie" ? (
            <SectionShell title="Movie" subtitle="Directors & actors come from the People lookup.">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[#0F172A]">People</div>
                  <CreateLinkButton
                    label="Create Person"
                    onClick={async () => {
                      const p = await createPerson();
                      if (!p) return;
                    }}
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-[#0F172A]">Directors</div>
                      <CreateLinkButton
                        label="Create + Add"
                        onClick={async () => {
                          const p = await createPerson();
                          if (!p) return;
                          const prev = (people as any).movieDirectorIds ?? [];
                          (people as any).setMovieDirectorIds?.(uniqStrings([...prev, p.id]));
                        }}
                        disabled={saving}
                      />
                    </div>
                    <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-[#E5E9F2] p-2">
                      {(meta.people ?? []).map((p: any) => {
                        const ids: string[] = (people as any).movieDirectorIds ?? [];
                        const checked = ids.includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => (people as any).setMovieDirectorIds?.(toggleId(ids, String(p.id)))}
                              disabled={saving}
                            />
                            <span className="truncate">{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-[#0F172A]">Actors</div>
                      <CreateLinkButton
                        label="Create + Add"
                        onClick={async () => {
                          const p = await createPerson();
                          if (!p) return;
                          const prev = (people as any).movieActorIds ?? [];
                          (people as any).setMovieActorIds?.(uniqStrings([...prev, p.id]));
                        }}
                        disabled={saving}
                      />
                    </div>
                    <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-[#E5E9F2] p-2">
                      {(meta.people ?? []).map((p: any) => {
                        const ids: string[] = (people as any).movieActorIds ?? [];
                        const checked = ids.includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => (people as any).setMovieActorIds?.(toggleId(ids, String(p.id)))}
                              disabled={saving}
                            />
                            <span className="truncate">{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </SectionShell>
          ) : null}

          {kind === "comic" ? (
            <SectionShell title="Comics" subtitle="Publisher and issue details.">
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-[#0F172A]">Publisher</div>
                  <select
                    value={form.comicPublisherId ?? ""}
                    onChange={(e) => form.setComicPublisherId?.(e.target.value)}
                    disabled={saving}
                    className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select publisher…</option>
                    {(meta.comicPublishers ?? []).map((x: any) => (
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
                      value={form.comicSeries ?? ""}
                      onChange={(e) => form.setComicSeries?.(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      placeholder="e.g., Amazing Spider-Man"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#0F172A]">Issue #</div>
                    <input
                      value={form.comicIssueNumber ?? ""}
                      onChange={(e) => form.setComicIssueNumber?.(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      placeholder="e.g., 129"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#0F172A]">Variant</div>
                    <input
                      value={form.comicVariant ?? ""}
                      onChange={(e) => form.setComicVariant?.(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                      placeholder="e.g., Cover B"
                    />
                  </div>
                </div>
              </div>
            </SectionShell>
          ) : null}

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

          {/* Bundle */}
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

          {/* Gaming section stays as-is */}
          {kind === "gaming" ? (
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
                  gamePlatforms: sortByName([...(m.gamePlatforms ?? []), row]),
                }))
              }
              onPublisherCreated={(row) =>
                setMeta((m) => ({
                  ...m,
                  gamePublishers: sortByName([...(m.gamePublishers ?? []), row]),
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
        open={(minifigs as any).minifigCreateOpen}
        creating={(minifigs as any).creatingMinifig}
        onClose={() => (minifigs as any).setMinifigCreateOpen?.(false)}
        newMinifigNumber={(minifigs as any).newMinifigNumber}
        setNewMinifigNumber={(minifigs as any).setNewMinifigNumber}
        newMinifigName={(minifigs as any).newMinifigName}
        setNewMinifigName={(minifigs as any).setNewMinifigName}
        newMinifigImagePreview={(minifigs as any).newMinifigImagePreview}
        onPickImage={(minifigs as any).pickNewMinifigImage}
        onCreate={(minifigs as any).createMinifigWithImage}
      />
    </>
  );
}


