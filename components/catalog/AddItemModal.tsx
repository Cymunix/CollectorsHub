// components/catalog/AddItemModal.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import AddItemModalShell from "./AddItemModal.shell";

import { useCatalogMeta } from "./add-item/hooks/useCatalogMeta";
import { useAddItemForm } from "./add-item/hooks/useAddItemForm";
import { useVariantLinks } from "./add-item/hooks/useVariantLinks";
import { useMinifigs } from "./add-item/hooks/useMinifigs";
import { usePeoplePicker } from "./add-item/hooks/usePeoplePicker";

import ClassificationSection from "./add-item/sections/ClassificationSection";
import PhotoSection from "./add-item/sections/PhotoSection";
import GlobalDetailsSection from "./add-item/sections/GlobalDetailsSection";
import WikiSection from "./add-item/sections/WikiSection";
import VariantsSection from "./add-item/sections/VariantsSection";
import GamingSection from "./add-item/sections/kinds/GamingSection";

import CreateMinifigModal from "./add-item/modals/CreateMinifigModal";
import ItemFranchiseEditor from "@/components/catalog/ItemFranchiseEditor";

import { supabase } from "@/lib/supabaseClient";

import MediaMetaSection from "./add-item/sections/MediaMetaSection";
import ProductionStatusSection from "./add-item/sections/ProductionStatusSection";
import BundleSection, { type BundleDraftRow } from "./add-item/sections/BundleSection";

import BuildingBlocksSection from "./add-item/sections/kinds/BuildingBlocksSection";
import CardsSection from "./add-item/sections/kinds/CardsSection";
import MusicSection from "./add-item/sections/kinds/MusicSection";
import PeopleSection from "./add-item/sections/kinds/PeopleSection";
import ComicsSection from "./add-item/sections/kinds/ComicsSection";

import { makeLookupCreators } from "./add-item/lookups/createLookups";
import { submitAddItem } from "./add-item/submit/submitAddItem";

type Banner = { type: "error" | "success"; msg: string } | null;

type GenreRow = { id: string; name: string };
type AgeRatingRow = { id: string; system: string; code: string; label: string };

function sortByName<T extends { name: string }>(arr: T[]) {
  return [...arr].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function uniqStrings(xs: string[]) {
  return Array.from(new Set((xs ?? []).filter(Boolean)));
}

export default function AddItemModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (catalogItemId: string) => void;
}) {
  const { meta, setMeta, metaLoading, metaError } = useCatalogMeta(open) as any;

  const form = useAddItemForm(meta) as any;
  const variants = useVariantLinks();
  const people = usePeoplePicker();
  const minifigs = useMinifigs(() => form.subcategoryId, () => form.franchiseId);

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const [createdCatalogItemId, setCreatedCatalogItemId] = useState<string | null>(null);
  const [createdDone, setCreatedDone] = useState(false);

  // Bundle
  const [isBundle, setIsBundle] = useState(false);
  const [bundleRows, setBundleRows] = useState<BundleDraftRow[]>([]);

  // Media meta (single source of truth – no "local vs form" nonsense)
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [ageRatingId, setAgeRatingId] = useState<string>("");
  const [explicitContent, setExplicitContent] = useState<boolean>(false);

  const kind = String(form.itemKind || "building_blocks");

  const title = useMemo(() => {
    const k = kind.replace(/_/g, " ");
    return `Create Catalog Item • ${k}`;
  }, [kind]);

  // load genres + ratings once the modal opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      try {
        const [{ data: g, error: gErr }, { data: ar, error: arErr }] = await Promise.all([
          supabase.from("genres").select("id,name").order("name", { ascending: true }),
          supabase
            .from("age_ratings")
            .select("id,system,code,label")
            .order("system", { ascending: true })
            .order("code", { ascending: true }),
        ]);

        if (cancelled) return;
        if (gErr) throw gErr;
        if (arErr) throw arErr;

        setMeta((m: any) => ({
          ...m,
          genres: (g ?? []) as GenreRow[],
          ageRatings: (ar ?? []) as AgeRatingRow[],
        }));
      } catch (e: any) {
        if (!cancelled) setBanner({ type: "error", msg: e?.message ?? "Failed to load genres/age ratings." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, setMeta]);

  // wipe stale rating when kind changes (prevents MPAA rating stuck on gaming, etc.)
  useEffect(() => {
    if (!open) return;

    const system = kind === "movie" ? "MPAA" : kind === "gaming" ? "ESRB" : kind === "music" ? "MUSIC" : null;
    if (!system) {
      setAgeRatingId("");
      return;
    }

    const list: AgeRatingRow[] = (meta.ageRatings ?? []) as any;
    const ok = list.some((r) => String(r.id) === String(ageRatingId) && String(r.system).toUpperCase() === system);
    if (!ok) setAgeRatingId("");
  }, [kind, open]); // intentional: doesn't depend on meta to avoid churn

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

    setGenreIds([]);
    setAgeRatingId("");
    setExplicitContent(false);

    setBanner(null);
    setCreatedCatalogItemId(null);
    setCreatedDone(false);
  };

  const finish = useCallback(() => {
    if (!createdCatalogItemId) return;
    onCreated?.(createdCatalogItemId);
    resetAll();
    onClose();
  }, [createdCatalogItemId, onCreated, onClose]);

  const lookups = useMemo(
    () =>
      makeLookupCreators({
        supabase,
        kind,
        meta,
        setMeta,
        form,
        setBanner,
      }),
    // meta is stable enough; if it churns too much we can narrow deps later
    [kind, meta, setMeta, form]
  );

  const submit = async () => {
    if (createdDone && createdCatalogItemId) {
      finish();
      return;
    }

    if (saving) return;
    setSaving(true);
    setBanner(null);

    try {
      const id = await submitAddItem({
        supabase,
        kind,
        form,
        variants,
        minifigs,
        people,
        isBundle,
        bundleRows,
        genreIds: uniqStrings(genreIds),
        ageRatingId: ageRatingId ? ageRatingId : null,
        explicitContent: kind === "music" ? !!explicitContent : null,
        setBanner,
      });

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

  const showMediaMeta = kind === "movie" || kind === "music" || kind === "gaming";

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
            onCreateFranchise={lookups.createFranchise}
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

          <PhotoSection
            previews={form.itemImagePreviews ?? []}
            onPickFiles={form.pickItemImages}
            onRemoveAt={form.removeItemImageAt}
            disabled={saving}
          />

          <GlobalDetailsSection {...form} />

          {showMediaMeta ? (
            <MediaMetaSection
              kind={kind}
              saving={saving}
              genres={sortByName((meta.genres ?? []) as GenreRow[])}
              ageRatings={(meta.ageRatings ?? []) as AgeRatingRow[]}
              genreIds={genreIds}
              setGenreIds={setGenreIds}
              ageRatingId={ageRatingId}
              setAgeRatingId={setAgeRatingId}
              explicitContent={explicitContent}
              setExplicitContent={setExplicitContent}
              onCreateGenre={() => lookups.createGenre((id) => setGenreIds((prev) => uniqStrings([...prev, id])))}
              onCreateAgeRating={() => lookups.createAgeRating((id) => setAgeRatingId(id))}
            />
          ) : null}

          {/* Kind-specific */}
          {kind === "building_blocks" ? (
            <BuildingBlocksSection
              saving={saving}
              bbThemes={meta.bbThemes ?? []}
              bbSubthemes={meta.bbSubthemes ?? []}
              bbThemeId={form.bbThemeId ?? ""}
              setBbThemeId={form.setBbThemeId}
              bbSubthemeId={form.bbSubthemeId ?? ""}
              setBbSubthemeId={form.setBbSubthemeId}
              bbSetNumber={form.bbSetNumber ?? ""}
              setBbSetNumber={form.setBbSetNumber}
              bbPieceCount={form.bbPieceCount ?? ""}
              setBbPieceCount={form.setBbPieceCount}
              bbRetailCad={form.bbRetailCad ?? ""}
              setBbRetailCad={form.setBbRetailCad}
              bbRetailUsd={form.bbRetailUsd ?? ""}
              setBbRetailUsd={form.setBbRetailUsd}
              onCreateBbTheme={lookups.createBbTheme}
              onCreateBbSubtheme={lookups.createBbSubtheme}
              minifigs={minifigs}
            />
          ) : null}

          {kind === "trading_card" || kind === "sports_card" ? (
            <CardsSection
              saving={saving}
              cardManufacturers={meta.cardManufacturers ?? []}
              cardSets={meta.cardSets ?? []}
              cardTypes={meta.cardTypes ?? []}
              cardManufacturerId={form.cardManufacturerId ?? ""}
              setCardManufacturerId={form.setCardManufacturerId}
              cardSetId={form.cardSetId ?? ""}
              setCardSetId={form.setCardSetId}
              cardTypeId={form.cardTypeId ?? ""}
              setCardTypeId={form.setCardTypeId}
              cardNumber={form.cardNumber ?? ""}
              setCardNumber={form.setCardNumber}
              cardYear={form.cardYear ?? ""}
              setCardYear={form.setCardYear}
              onCreateCardManufacturer={lookups.createCardManufacturer}
              onCreateCardSet={lookups.createCardSet}
              onCreateCardType={lookups.createCardType}
            />
          ) : null}

          {kind === "music" ? (
            <>
              <MusicSection
                saving={saving}
                musicArtists={meta.musicArtists ?? []}
                musicArtistId={form.musicArtistId ?? ""}
                setMusicArtistId={form.setMusicArtistId}
                onCreateMusicArtist={lookups.createMusicArtist}
              />

              {/* Reuse your existing people picker fields as "Producers / Featured" for now */}
              <PeopleSection
                saving={saving}
                title="People"
                subtitle="Add producers and featured artists."
                people={people}
                primaryLabel="Producer"
                secondaryLabel="Featured"
                primaryIds={(people as any).movieDirectorIds ?? []}
                secondaryIds={(people as any).movieActorIds ?? []}
                onAddPrimary={(id) => (people as any).addDirector?.(id)}
                onAddSecondary={(id) => (people as any).addActor?.(id)}
                onRemovePrimary={(id) => (people as any).removeDirector?.(id)}
                onRemoveSecondary={(id) => (people as any).removeActor?.(id)}
                onCreatePerson={lookups.createPerson}
              />
            </>
          ) : null}

          {kind === "movie" ? (
            <PeopleSection
              saving={saving}
              title="Movie"
              subtitle="Search people and add them as Directors / Actors."
              people={people}
              primaryLabel="Director"
              secondaryLabel="Actor"
              primaryIds={(people as any).movieDirectorIds ?? []}
              secondaryIds={(people as any).movieActorIds ?? []}
              onAddPrimary={(id) => (people as any).addDirector?.(id)}
              onAddSecondary={(id) => (people as any).addActor?.(id)}
              onRemovePrimary={(id) => (people as any).removeDirector?.(id)}
              onRemoveSecondary={(id) => (people as any).removeActor?.(id)}
              onCreatePerson={lookups.createPerson}
            />
          ) : null}

          {kind === "comic" ? (
            <ComicsSection
              saving={saving}
              comicPublishers={meta.comicPublishers ?? []}
              comicPublisherId={form.comicPublisherId ?? ""}
              setComicPublisherId={form.setComicPublisherId}
              comicSeries={form.comicSeries ?? ""}
              setComicSeries={form.setComicSeries}
              comicIssueNumber={form.comicIssueNumber ?? ""}
              setComicIssueNumber={form.setComicIssueNumber}
              comicVariant={form.comicVariant ?? ""}
              setComicVariant={form.setComicVariant}
            />
          ) : null}

          {/* Gaming stays as-is */}
          {kind === "gaming" ? (
            <GamingSection
              gamePlatforms={meta.gamePlatforms ?? []}
              gamePublishers={meta.gamePublishers ?? []}
              gamePlatformId={form.gamePlatformId ?? ""}
              setGamePlatformId={form.setGamePlatformId}
              gamePublisherId={form.gamePublisherId ?? ""}
              setGamePublisherId={form.setGamePublisherId}
              canCreate={true}
              onPlatformCreated={(row: any) =>
                setMeta((m: any) => ({ ...m, gamePlatforms: sortByName([...(m.gamePlatforms ?? []), row]) }))
              }
              onPublisherCreated={(row: any) =>
                setMeta((m: any) => ({ ...m, gamePublishers: sortByName([...(m.gamePublishers ?? []), row]) }))
              }
            />
          ) : null}

          <ProductionStatusSection
            value={form.productionStatus ?? "unknown"}
            onChange={(v) => form.setProductionStatus?.(v)}
            disabled={saving}
          />

          <BundleSection
            supabase={supabase}
            saving={saving}
            isBundle={isBundle}
            setIsBundle={setIsBundle}
            bundleRows={bundleRows}
            setBundleRows={setBundleRows}
          />

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
