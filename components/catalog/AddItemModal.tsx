"use client";

import React, { useMemo, useState } from "react";

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

  const title = useMemo(() => {
    const kind = String(form.itemKind || "building_blocks").replace(/_/g, " ");
    return `Create Catalog Item • ${kind}`;
  }, [form.itemKind]);

  const safeClose = () => {
    if (!saving) {
      setBanner(null);
      onClose();
    }
  };

  const resetAll = () => {
    form.reset?.();
    variants.resetVariants();
    minifigs.resetMinifigs();
    people.resetPeople();
    setBanner(null);
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

  /* ---------------- submit ---------------- */

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setBanner(null);

    const minifigsSnapshot = [...(minifigs.selectedMinifigs ?? [])];

    try {
      const id = await createCatalogItem(form.itemKind, {
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        franchiseId: form.franchiseId || null,
        itemImageFile: form.itemImageFile,
        catalogName: form.catalogName,
        catalogReleaseYear: form.catalogReleaseYear,
        catalogUPC: form.catalogUPC,
        catalogVersion: form.catalogVersion,
        wikiSummary: form.wikiSummary,
        wikiDescription: form.wikiDescription,
        wikiFacts: form.wikiFacts,
        wikiChecklist: form.wikiChecklist,
        wikiSources: form.wikiSources,

        // Keeping this doesn't hurt if createCatalogItem expects it,
        // but variant grouping is handled AFTER via applyVariantGroupLinks().
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

        // ✅ gaming
        gamePlatformId: form.gamePlatformId,
        gamePublisherId: form.gamePublisherId,

        // comics
        comicPublisherId: form.comicPublisherId,
        comicSeries: form.comicSeries,
        comicIssueNumber: form.comicIssueNumber,
        comicVariant: form.comicVariant,
      });

      await upsertItemDescription(id, form.wikiDescription);

      // ✅ NEW: Variant group linking (THIS is what creates variant_groups + updates catalog_items.variant_group_id)
      await applyVariantGroupLinks({
        catalogItemId: id,
        // ✅ FIX: your hook uses target_id
        linkedVariants: (variants.linkedVariants ?? [])
          .map((v: any) => ({ catalogItemId: String(v?.target_id ?? "") }))
          .filter((v: any) => v.catalogItemId),
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

      setBanner({ type: "success", msg: "Item created successfully." });
      onCreated?.(id);
      resetAll();
      onClose();
    } catch (e: any) {
      setBanner({ type: "error", msg: e?.message || "Failed to create item." });
    } finally {
      setSaving(false);
    }
  };

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

          <PhotoSection itemImagePreview={form.itemImagePreview} onPick={form.pickItemImage} />

          <GlobalDetailsSection {...form} />

          {/* ✅ Gaming kind-specific section: platform + publisher */}
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
