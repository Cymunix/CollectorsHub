// components/catalog/add-item/submit/submitAddItem.ts
"use client";

import { createCatalogItem } from "@/lib/catalog/createCatalogItem";
import { ensureBuildingBlocksRow, upsertSetMinifigLinks } from "@/lib/db/catalog";
import { upsertItemDescription } from "@/lib/db/catalog_write";
import { applyVariantGroupLinks } from "@/lib/db/variant_groups_write";
import { replaceBundleComponents } from "@/lib/catalog/queries";
import { persistMediaMetaOnCatalogItem } from "./persistMediaMeta";

function clampQty(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function uniqStrings(xs: string[]) {
  return Array.from(new Set((xs ?? []).filter(Boolean)));
}

export async function submitAddItem(args: {
  supabase: any;

  kind: string;
  form: any;
  variants: any;
  minifigs: any;
  people: any;

  isBundle: boolean;
  bundleRows: Array<{ component_item_id: string; name?: string; qty: number }>;

  // single source of truth from orchestrator (NO locals here)
  genreIds: string[];
  ageRatingId: string | null;
  explicitContent: boolean | null;

  setBanner: (b: { type: "error" | "success"; msg: string } | null) => void;
}): Promise<string> {
  const {
    supabase,
    kind,
    form,
    variants,
    minifigs,
    people,
    isBundle,
    bundleRows,
    genreIds,
    ageRatingId,
    explicitContent,
  } = args;

  const minifigsSnapshot = [...(minifigs.selectedMinifigs ?? [])];
  const bundleSnapshot = [...bundleRows];

  // 1) create base item
  const id = await createCatalogItem(kind, {
    categoryId: form.categoryId,
    subcategoryId: form.subcategoryId,

    franchiseId: form.franchiseId || null,

    itemImageFiles: form.itemImageFiles ?? [],
    catalogName: form.catalogName,
    catalogReleaseYear: form.catalogReleaseYear,
    catalogUPC: form.catalogUPC,
    catalogVersion: form.catalogVersion,

    productionStatus: form.productionStatus ?? "unknown",

    // media meta (pass through if createCatalogItem supports it)
    genreIds: uniqStrings(genreIds ?? []),
    ageRatingId: ageRatingId ? ageRatingId : null,
    explicitContent,

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

    // movies + people
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

  // 2) hard guarantee: persist onto catalog_items (even if createCatalogItem ignores them)
  await persistMediaMetaOnCatalogItem({
    supabase,
    catalogItemId: id,
    genreIds: uniqStrings(genreIds ?? []),
    ageRatingId: ageRatingId || null,
    explicitContent,
  });

  // 3) auto-sync: legacy franchiseId -> join table as PRIMARY
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

  // 4) description
  await upsertItemDescription(id, form.wikiDescription);

  // 5) variants/groups
  await applyVariantGroupLinks({
    catalogItemId: id,
    linkedVariants: variants.linkedVariants ?? [],
    variantName: form.catalogVersion || variants.variantDefaultLabel || null,
  });

  // 6) building blocks row + minifigs links
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

  // 7) bundles
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

  return id;
}
