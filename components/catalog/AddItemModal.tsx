// components/catalog/AddItemModal.tsx
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
import { upsertItemDescription, replaceVariantLinks } from "@/lib/db/catalog_write";

import ClassificationSection from "./add-item/sections/ClassificationSection";
import PhotoSection from "./add-item/sections/PhotoSection";
import GlobalDetailsSection from "./add-item/sections/GlobalDetailsSection";
import WikiSection from "./add-item/sections/WikiSection";
import VariantsSection from "./add-item/sections/VariantsSection";

import BuildingBlocksSection from "./add-item/sections/kinds/BuildingBlocksSection";
import CardsSection from "./add-item/sections/kinds/CardsSection";
import MusicSection from "./add-item/sections/kinds/MusicSection";
import ToysSection from "./add-item/sections/kinds/ToysSection";
import MoviesSection from "./add-item/sections/kinds/MoviesSection";
import GamingSection from "./add-item/sections/kinds/GamingSection";
import ComicsSection from "./add-item/sections/kinds/ComicsSection";

import CreateMinifigModal from "./add-item/modals/CreateMinifigModal";

export default function AddItemModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (catalogItemId: string) => void;
}) {
  const { meta, setMeta, metaLoading, metaError } = useCatalogMeta(open);

  const form = useAddItemForm(meta);
  const variants = useVariantLinks();
  const people = usePeoplePicker(meta.people);

  const minifigs = useMinifigs(() => form.subcategoryId, () => form.franchiseId);

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  const title = useMemo(() => {
    const base = "Create Catalog Item";
    const kind = (form.itemKind || "building_blocks").replace(/_/g, " ");
    return `${base} • ${kind}`;
  }, [form.itemKind]);

  const safeClose = () => {
    if (saving) return;
    setBanner(null);
    onClose();
  };

  const resetAll = () => {
    form.reset();
    variants.resetVariants();
    minifigs.resetMinifigs();
    people.resetPeople();
    setBanner(null);
  };

  // ---------- Inline-create handlers (lookups) ----------
  const promptName = (label: string) => {
    const v = window.prompt(`New ${label} name:`);
    return (v || "").trim();
  };

  const createFranchise = async () => {
    const name = promptName("franchise");
    if (!name) return;
    try {
      const row = await safeInsertLookup("franchises", name);
      if (!row) return;
      setMeta((m) => ({ ...m, franchises: [...m.franchises, row].sort((a, b) => a.name.localeCompare(b.name)) }));
      form.setFranchiseId(row.id);
    } catch (e: any) {
      alert(e?.message || "Failed to create franchise.");
    }
  };

  const createBbTheme = async () => {
    const name = promptName("theme");
    if (!name) return;
    if (!form.subcategoryId) return alert("Pick a Building Blocks brand (subcategory) first.");
    try {
      const row = await safeInsertLookup(
        "bb_themes",
        name,
        { subcategory_id: form.subcategoryId },
        "id,name,subcategory_id"
      );
      if (!row) return;
      setMeta((m) => ({ ...m, bbThemes: [...m.bbThemes, row as any].sort((a, b) => a.name.localeCompare(b.name)) }));
      form.setBbThemeId(row.id);
      form.setBbSubthemeId("");
    } catch (e: any) {
      alert(e?.message || "Failed to create theme.");
    }
  };

  const createBbSubtheme = async () => {
    const name = promptName("subtheme");
    if (!name) return;
    if (!form.bbThemeId) return alert("Pick a theme first.");
    try {
      const row = await safeInsertLookup("bb_subthemes", name, { theme_id: form.bbThemeId }, "id,name,theme_id");
      if (!row) return;
      setMeta((m) => ({
        ...m,
        bbSubthemes: [...m.bbSubthemes, row as any].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      form.setBbSubthemeId(row.id);
    } catch (e: any) {
      alert(e?.message || "Failed to create subtheme.");
    }
  };

  const createCardManufacturer = async () => {
    const name = promptName("manufacturer");
    if (!name) return;
    try {
      const row = await safeInsertLookup("card_manufacturers", name);
      if (!row) return;
      setMeta((m) => ({
        ...m,
        cardManufacturers: [...m.cardManufacturers, row as any].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      form.setCardManufacturerId(row.id);
      form.setCardSetId("");
    } catch (e: any) {
      alert(e?.message || "Failed to create manufacturer.");
    }
  };

  const createCardSet = async () => {
    const name = promptName("set");
    if (!name) return;
    if (!form.cardManufacturerId) return alert("Pick a manufacturer first.");
    try {
      const row = await safeInsertLookup(
        "card_sets",
        name,
        { manufacturer_id: form.cardManufacturerId },
        "id,name,manufacturer_id"
      );
      if (!row) return;
      setMeta((m) => ({ ...m, cardSets: [...m.cardSets, row as any].sort((a, b) => a.name.localeCompare(b.name)) }));
      form.setCardSetId(row.id);
    } catch (e: any) {
      alert(e?.message || "Failed to create set.");
    }
  };

  const createCardType = async () => {
    const name = promptName("card type");
    if (!name) return;
    try {
      const row = await safeInsertLookup("card_types", name);
      if (!row) return;
      setMeta((m) => ({ ...m, cardTypes: [...m.cardTypes, row as any].sort((a, b) => a.name.localeCompare(b.name)) }));
      form.setCardTypeId(row.id);
    } catch (e: any) {
      alert(e?.message || "Failed to create card type.");
    }
  };

  const createMusicArtist = async () => {
    const name = promptName("artist");
    if (!name) return;
    try {
      const row = await safeInsertLookup("music_artists", name);
      if (!row) return;
      setMeta((m) => ({
        ...m,
        musicArtists: [...m.musicArtists, row as any].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      form.setMusicArtistId(row.id);
    } catch (e: any) {
      alert(e?.message || "Failed to create artist.");
    }
  };

  const createToyManufacturer = async () => {
    const name = promptName("toy manufacturer");
    if (!name) return;
    try {
      const row = await safeInsertLookup("toy_manufacturers", name);
      if (!row) return;
      setMeta((m) => ({
        ...m,
        toyManufacturers: [...m.toyManufacturers, row as any].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      form.setToyManufacturerId(row.id);
      form.setToyBrandId("");
      form.setToyLineId("");
    } catch (e: any) {
      alert(e?.message || "Failed to create toy manufacturer.");
    }
  };

  const createToyBrand = async () => {
    const name = promptName("toy brand");
    if (!name) return;
    if (!form.toyManufacturerId) return alert("Pick a manufacturer first.");
    try {
      const row = await safeInsertLookup(
        "toy_brands",
        name,
        { manufacturer_id: form.toyManufacturerId },
        "id,name,manufacturer_id"
      );
      if (!row) return;
      setMeta((m) => ({ ...m, toyBrands: [...m.toyBrands, row as any].sort((a, b) => a.name.localeCompare(b.name)) }));
      form.setToyBrandId(row.id);
      form.setToyLineId("");
    } catch (e: any) {
      alert(e?.message || "Failed to create toy brand.");
    }
  };

  const createToyLine = async () => {
    const name = promptName("toy line");
    if (!name) return;
    if (!form.toyBrandId) return alert("Pick a brand first.");
    try {
      const row = await safeInsertLookup("toy_lines", name, { brand_id: form.toyBrandId }, "id,name,brand_id");
      if (!row) return;
      setMeta((m) => ({ ...m, toyLines: [...m.toyLines, row as any].sort((a, b) => a.name.localeCompare(b.name)) }));
      form.setToyLineId(row.id);
    } catch (e: any) {
      alert(e?.message || "Failed to create toy line.");
    }
  };

  const createPerson = async () => {
    const name = promptName("person");
    if (!name) return;
    try {
      const row = await safeInsertLookup("people", name);
      if (!row) return;
      setMeta((m) => ({ ...m, people: [...m.people, row as any].sort((a, b) => a.name.localeCompare(b.name)) }));
    } catch (e: any) {
      alert(e?.message || "Failed to create person.");
    }
  };

  const createGamePlatform = async () => {
    const name = promptName("platform");
    if (!name) return;
    try {
      const row = await safeInsertLookup("game_platforms", name);
      if (!row) return;
      setMeta((m) => ({
        ...m,
        gamePlatforms: [...m.gamePlatforms, row as any].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      form.setGamePlatformId(row.id);
    } catch (e: any) {
      alert(e?.message || "Failed to create platform.");
    }
  };

  const createGamePublisher = async () => {
    const name = promptName("publisher");
    if (!name) return;
    try {
      const row = await safeInsertLookup("game_publishers", name);
      if (!row) return;
      setMeta((m) => ({
        ...m,
        gamePublishers: [...m.gamePublishers, row as any].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      form.setGamePublisherId(row.id);
    } catch (e: any) {
      alert(e?.message || "Failed to create publisher.");
    }
  };

  const createComicPublisher = async () => {
    const name = promptName("comic publisher");
    if (!name) return;
    try {
      const row = await safeInsertLookup("comic_publishers", name);
      if (!row) return;
      setMeta((m) => ({
        ...m,
        comicPublishers: [...m.comicPublishers, row as any].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      form.setComicPublisherId(row.id);
    } catch (e: any) {
      alert(e?.message || "Failed to create comic publisher.");
    }
  };

  // ---------- Submit ----------
  const submit = async () => {
    if (saving) return;

    setSaving(true);
    setBanner(null);

    // ✅ snapshot minifigs now (state-safe)
    const minifigsSnapshot = [...(minifigs.selectedMinifigs ?? [])];

    try {
      const rawState = {
        // classification
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        franchiseId: form.franchiseId || null,

        // shared image
        itemImageFile: form.itemImageFile,

        // global
        catalogName: form.catalogName,
        catalogReleaseYear: form.catalogReleaseYear,
        catalogUPC: form.catalogUPC,
        catalogVersion: form.catalogVersion,

        // wiki
        wikiSummary: form.wikiSummary,
        wikiDescription: form.wikiDescription,
        wikiFacts: form.wikiFacts,
        wikiChecklist: form.wikiChecklist,
        wikiSources: form.wikiSources,

        // variants
        linkedVariants: variants.linkedVariants,

        // building blocks
        bbThemeId: form.bbThemeId,
        bbSubthemeId: form.bbSubthemeId,
        bbSetNumber: form.bbSetNumber,
        bbPieceCount: form.bbPieceCount,
        bbRetailCad: form.bbRetailCad,
        bbRetailUsd: form.bbRetailUsd,

        // ✅ qty-aware selection list
        selectedMinifigs: minifigsSnapshot,

        // cards
        cardManufacturerId: form.cardManufacturerId,
        cardSetId: form.cardSetId,
        cardTypeId: form.cardTypeId,
        cardNumber: form.cardNumber,
        cardYear: form.cardYear,

        // rarity (dropdown + free text)
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
      };

      const id = await createCatalogItem(form.itemKind, rawState);

      await upsertItemDescription(id, form.wikiDescription);

      await replaceVariantLinks({
        catalogItemId: id,
        linkedVariants: variants.linkedVariants,
        defaultType: variants.variantDefaultType,
        defaultLabel: variants.variantDefaultLabel,
      });

      if (form.itemKind === "building_blocks") {
        if (!form.bbThemeId) throw new Error("Building Blocks requires a Theme.");
        if (!form.bbSetNumber) throw new Error("Building Blocks requires a Set Number.");

        await ensureBuildingBlocksRow(id, {
          themeId: form.bbThemeId,
          subthemeId: form.bbSubthemeId || null,
          setNumber: form.bbSetNumber,
          pieceCount: form.bbPieceCount,
          retailCad: form.bbRetailCad,
          retailUsd: form.bbRetailUsd,
        });

        if (minifigsSnapshot.length > 0) {
          await upsertSetMinifigLinks(id, minifigsSnapshot);
        }
      }

      setBanner({ type: "success", msg: "Item created successfully." });
      onCreated?.(id);

      resetAll();
      onClose();
    } catch (e: any) {
      console.error(e);
      setBanner({ type: "error", msg: e?.message || "Failed to create item." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AddItemModalShell open={open} title={title} saving={saving} banner={banner} onClose={safeClose} onSubmit={submit}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
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

          <GlobalDetailsSection
            itemKind={form.itemKind}
            catalogName={form.catalogName}
            setCatalogName={form.setCatalogName}
            catalogReleaseYear={form.catalogReleaseYear}
            setCatalogReleaseYear={form.setCatalogReleaseYear}
            catalogUPC={form.catalogUPC}
            setCatalogUPC={form.setCatalogUPC}
            catalogVersion={form.catalogVersion}
            setCatalogVersion={form.setCatalogVersion}
          />

          <WikiSection
            wikiSummary={form.wikiSummary}
            setWikiSummary={form.setWikiSummary}
            wikiDescription={form.wikiDescription}
            setWikiDescription={form.setWikiDescription}
            wikiFacts={form.wikiFacts}
            setWikiFacts={form.setWikiFacts}
            newFactKey={form.newFactKey}
            setNewFactKey={form.setNewFactKey}
            newFactVal={form.newFactVal}
            setNewFactVal={form.setNewFactVal}
            wikiChecklist={form.wikiChecklist}
            setWikiChecklist={form.setWikiChecklist}
            newChecklistItem={form.newChecklistItem}
            setNewChecklistItem={form.setNewChecklistItem}
            wikiSources={form.wikiSources}
            setWikiSources={form.setWikiSources}
            newSource={form.newSource}
            setNewSource={form.setNewSource}
          />

          <VariantsSection
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

          {form.itemKind === "building_blocks" && (
            <BuildingBlocksSection
              subcategoryId={form.subcategoryId}
              bbThemeId={form.bbThemeId}
              setBbThemeId={form.setBbThemeId}
              bbSubthemeId={form.bbSubthemeId}
              setBbSubthemeId={form.setBbSubthemeId}
              bbSetNumber={form.bbSetNumber}
              setBbSetNumber={form.setBbSetNumber}
              bbPieceCount={form.bbPieceCount}
              setBbPieceCount={form.setBbPieceCount}
              bbRetailCad={form.bbRetailCad}
              setBbRetailCad={form.setBbRetailCad}
              bbRetailUsd={form.bbRetailUsd}
              setBbRetailUsd={form.setBbRetailUsd}
              bbThemeOptions={form.bbThemeOptions}
              bbSubthemeOptions={form.bbSubthemeOptions}
              onCreateBbTheme={createBbTheme}
              onCreateBbSubtheme={createBbSubtheme}
              minifigQuery={minifigs.minifigQuery}
              setMinifigQuery={minifigs.setMinifigQuery}
              minifigSearching={minifigs.minifigSearching}
              minifigResults={minifigs.minifigResults}
              selectedMinifigs={minifigs.selectedMinifigs}
              onSearchMinifigs={minifigs.searchMinifigs}
              onAddMinifig={minifigs.addMinifigToSelection}
              onRemoveMinifig={minifigs.removeMinifigFromSelection}
              onSetMinifigQty={minifigs.setMinifigQty}
              onBumpMinifigQty={minifigs.bumpMinifigQty}
              onOpenCreateMinifig={minifigs.openCreateMinifig}
            />
          )}

          {(form.itemKind === "trading_card" || form.itemKind === "sports_card") && (
            <CardsSection
              itemKind={form.itemKind}
              cardManufacturers={meta.cardManufacturers}
              cardSets={meta.cardSets}
              cardTypes={meta.cardTypes}
              cardManufacturerId={form.cardManufacturerId}
              setCardManufacturerId={form.setCardManufacturerId}
              cardSetId={form.cardSetId}
              setCardSetId={form.setCardSetId}
              cardTypeId={form.cardTypeId}
              setCardTypeId={form.setCardTypeId}
              cardNumber={form.cardNumber}
              setCardNumber={form.setCardNumber}
              cardYear={form.cardYear}
              setCardYear={form.setCardYear}
              cardRarityDropdown={form.cardRarityDropdown}
              setCardRarityDropdown={form.setCardRarityDropdown}
              cardRarityCustom={form.cardRarityCustom}
              setCardRarityCustom={form.setCardRarityCustom}
              cardSetOptions={form.cardSetOptions}
              onCreateCardManufacturer={createCardManufacturer}
              onCreateCardSet={createCardSet}
              onCreateCardType={createCardType}
            />
          )}

          {form.itemKind === "music" && (
            <MusicSection
              musicArtists={meta.musicArtists}
              musicArtistId={form.musicArtistId}
              setMusicArtistId={form.setMusicArtistId}
              onCreateMusicArtist={createMusicArtist}
            />
          )}

          {form.itemKind === "toy" && (
            <ToysSection
              toyManufacturers={meta.toyManufacturers}
              toyBrandOptions={form.toyBrandOptions}
              toyLineOptions={form.toyLineOptions}
              toyManufacturerId={form.toyManufacturerId}
              setToyManufacturerId={form.setToyManufacturerId}
              toyBrandId={form.toyBrandId}
              setToyBrandId={form.setToyBrandId}
              toyLineId={form.toyLineId}
              setToyLineId={form.setToyLineId}
              toyModelNumber={form.toyModelNumber}
              setToyModelNumber={form.setToyModelNumber}
              onCreateToyManufacturer={createToyManufacturer}
              onCreateToyBrand={createToyBrand}
              onCreateToyLine={createToyLine}
            />
          )}

          {form.itemKind === "movie" && (
            <MoviesSection
              personQuery={people.personQuery}
              setPersonQuery={people.setPersonQuery}
              personSearching={people.personSearching}
              personResults={people.personResults}
              onSearchPeople={people.searchPeople}
              onCreatePerson={createPerson}
              directorPeople={people.directorPeople}
              actorPeople={people.actorPeople}
              onAddDirector={people.addDirector}
              onRemoveDirector={people.removeDirector}
              onAddActor={people.addActor}
              onRemoveActor={people.removeActor}
            />
          )}

          {form.itemKind === "gaming" && (
            <GamingSection
              gamePlatforms={meta.gamePlatforms}
              gamePublishers={meta.gamePublishers}
              gamePlatformId={form.gamePlatformId}
              setGamePlatformId={form.setGamePlatformId}
              gamePublisherId={form.gamePublisherId}
              setGamePublisherId={form.setGamePublisherId}
              onCreateGamePlatform={createGamePlatform}
              onCreateGamePublisher={createGamePublisher}
            />
          )}

          {form.itemKind === "comic" && (
            <ComicsSection
              comicPublishers={meta.comicPublishers}
              comicPublisherId={form.comicPublisherId}
              setComicPublisherId={form.setComicPublisherId}
              comicSeries={form.comicSeries}
              setComicSeries={form.setComicSeries}
              comicIssueNumber={form.comicIssueNumber}
              setComicIssueNumber={form.setComicIssueNumber}
              comicVariant={form.comicVariant}
              setComicVariant={form.setComicVariant}
              onCreateComicPublisher={createComicPublisher}
            />
          )}
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
