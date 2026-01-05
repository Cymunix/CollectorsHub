// components/catalog/add-item/lookups/createLookups.ts
"use client";

import type { Banner } from "./lookupInsert";
import { insertLookupRowSafe, insertWithSlugSafe } from "./lookupInsert";
import { safeInsertLookup } from "@/lib/catalog/lookups";

type NamedRow = { id: string; name: string };
type GenreRow = { id: string; name: string };
type AgeRatingRow = { id: string; system: string; code: string; label: string };

function sortByName<T extends { name: string }>(arr: T[]) {
  return [...arr].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function promptName(label: string) {
  return (window.prompt(`New ${label} name:`) || "").trim();
}

export function makeLookupCreators(args: {
  supabase: any;
  kind: string;

  meta: any;
  setMeta: React.Dispatch<React.SetStateAction<any>>;

  form: any;
  setBanner: (b: Banner) => void;
}) {
  const { supabase, kind, setMeta, form, setBanner } = args;

  const createFranchise = async () => {
    const name = promptName("franchise");
    if (!name) return;

    try {
      const row = await safeInsertLookup("franchises", name);
      if (!row) return;

      setMeta((m: any) => ({ ...m, franchises: sortByName([...(m.franchises ?? []), row]) }));
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

    const row = await insertLookupRowSafe<any>({
      supabase,
      table: "bb_themes",
      payload: { name, subcategory_id: form.subcategoryId },
      setBanner,
    });
    if (!row) return;

    setMeta((m: any) => ({ ...m, bbThemes: sortByName([...(m.bbThemes ?? []), row]) }));
    form.setBbThemeId?.(row.id);
  };

  const createBbSubtheme = async () => {
    const name = promptName("subtheme");
    if (!name) return;

    if (!form.bbThemeId) {
      setBanner({ type: "error", msg: "Select a theme before creating a subtheme." });
      return;
    }

    const row = await insertLookupRowSafe<any>({
      supabase,
      table: "bb_subthemes",
      payload: { name, theme_id: form.bbThemeId },
      setBanner,
    });
    if (!row) return;

    setMeta((m: any) => ({ ...m, bbSubthemes: sortByName([...(m.bbSubthemes ?? []), row]) }));
    form.setBbSubthemeId?.(row.id);
  };

  const createCardManufacturer = async () => {
    const name = promptName("card manufacturer");
    if (!name) return;

    const row = await insertWithSlugSafe<any>({
      supabase,
      table: "card_manufacturers",
      payload: { name },
      setBanner,
    });
    if (!row) return;

    setMeta((m: any) => ({ ...m, cardManufacturers: sortByName([...(m.cardManufacturers ?? []), row]) }));
    form.setCardManufacturerId?.(row.id);
  };

  const createCardSet = async () => {
    const name = promptName("card set");
    if (!name) return;

    if (!form.cardManufacturerId) {
      setBanner({ type: "error", msg: "Select a card manufacturer before creating a set." });
      return;
    }

    const row = await insertWithSlugSafe<any>({
      supabase,
      table: "card_sets",
      payload: { name, manufacturer_id: form.cardManufacturerId },
      setBanner,
    });
    if (!row) return;

    setMeta((m: any) => ({ ...m, cardSets: sortByName([...(m.cardSets ?? []), row]) }));
    form.setCardSetId?.(row.id);
  };

  const createCardType = async () => {
    const name = promptName("card type");
    if (!name) return;

    const row = await insertWithSlugSafe<any>({
      supabase,
      table: "card_types",
      payload: { name },
      setBanner,
    });
    if (!row) return;

    setMeta((m: any) => ({ ...m, cardTypes: sortByName([...(m.cardTypes ?? []), row]) }));
    form.setCardTypeId?.(row.id);
  };

  const createMusicArtist = async () => {
    const name = promptName("artist");
    if (!name) return;

    const row = await insertLookupRowSafe<any>({
      supabase,
      table: "music_artists",
      payload: { name },
      setBanner,
    });
    if (!row) return;

    setMeta((m: any) => ({ ...m, musicArtists: sortByName([...(m.musicArtists ?? []), row]) }));
    form.setMusicArtistId?.(row.id);
  };

  const createPerson = async () => {
    const name = promptName("person");
    if (!name) return null;

    const row = await insertLookupRowSafe<any>({
      supabase,
      table: "people",
      payload: { name },
      setBanner,
    });
    if (!row) return null;

    setMeta((m: any) => ({ ...m, people: sortByName([...(m.people ?? []), row]) }));
    return row;
  };

  const createGenre = async (afterCreateSelect?: (genreId: string) => void) => {
    const name = promptName("genre");
    if (!name) return;

    const row = await insertLookupRowSafe<GenreRow>({
      supabase,
      table: "genres",
      payload: { name },
      setBanner,
    });
    if (!row) return;

    setMeta((m: any) => ({ ...m, genres: sortByName([...(m.genres ?? []), row]) }));
    afterCreateSelect?.(row.id);
  };

  const createAgeRating = async (afterCreateSelect?: (ratingId: string) => void) => {
    const system = kind === "movie" ? "MPAA" : kind === "gaming" ? "ESRB" : kind === "music" ? "MUSIC" : null;
    if (!system) {
      setBanner({ type: "error", msg: "No rating system defined for this item type." });
      return;
    }

    const code = window.prompt(`New ${system} Code (e.g. PG-13):`);
    if (!code) return;
    const label = window.prompt("Description/Label (optional):") || "";

    const row = await insertLookupRowSafe<AgeRatingRow>({
      supabase,
      table: "age_ratings",
      payload: { system, code, label },
      setBanner,
    });
    if (!row) return;

    setMeta((m: any) => ({ ...m, ageRatings: [...(m.ageRatings ?? []), row] }));
    afterCreateSelect?.(row.id);
  };

  return {
    createFranchise,
    createBbTheme,
    createBbSubtheme,

    createCardManufacturer,
    createCardSet,
    createCardType,

    createMusicArtist,
    createPerson,

    createGenre,
    createAgeRating,
  };
}
