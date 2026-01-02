"use client";

import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type PersonRow = { id: string; name: string; slug?: string | null };

function uniqStrings(xs: string[]) {
  return Array.from(new Set(xs.filter(Boolean)));
}

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

  return slug || "person";
}

export function usePeoplePicker() {
  // Directors / Actors selections
  const [movieDirectorIds, setMovieDirectorIds] = useState<string[]>([]);
  const [movieActorIds, setMovieActorIds] = useState<string[]>([]);

  // Search UI state
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleSearching, setPeopleSearching] = useState(false);
  const [peopleResults, setPeopleResults] = useState<PersonRow[]>([]);
  const [peopleUiErr, setPeopleUiErr] = useState<string | null>(null);

  // quick lookup map for results (helps rendering selected names)
  const resultsById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const r of peopleResults) m.set(r.id, r);
    return m;
  }, [peopleResults]);

  const resetPeople = useCallback(() => {
    setMovieDirectorIds([]);
    setMovieActorIds([]);
    setPeopleQuery("");
    setPeopleResults([]);
    setPeopleUiErr(null);
    setPeopleSearching(false);
  }, []);

  const searchPeople = useCallback(async () => {
    const q = String(peopleQuery ?? "").trim();
    if (q.length < 2) {
      setPeopleResults([]);
      setPeopleUiErr(null);
      return;
    }

    setPeopleSearching(true);
    setPeopleUiErr(null);

    try {
      // Search name first. If you want slug too:
      // .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
      const { data, error } = await supabase
        .from("people")
        .select("id,name,slug")
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(20);

      if (error) throw error;

      const rows = (data ?? []).map((r: any) => ({
        id: String(r.id),
        name: String(r.name ?? "Person"),
        slug: r.slug ?? null,
      })) as PersonRow[];

      setPeopleResults(rows);
    } catch (e: any) {
      setPeopleUiErr(e?.message ?? "Failed to search people.");
    } finally {
      setPeopleSearching(false);
    }
  }, [peopleQuery]);

  const addDirector = useCallback((id: string) => {
    if (!id) return;
    setMovieDirectorIds((prev) => uniqStrings([...prev, id]));
  }, []);

  const removeDirector = useCallback((id: string) => {
    setMovieDirectorIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const addActor = useCallback((id: string) => {
    if (!id) return;
    setMovieActorIds((prev) => uniqStrings([...prev, id]));
  }, []);

  const removeActor = useCallback((id: string) => {
    setMovieActorIds((prev) => prev.filter((x) => x !== id));
  }, []);

  /**
   * Create person + return row
   * IMPORTANT: people.slug is NOT NULL in your DB, so we must provide it
   * unless you have a DB trigger. This code handles it in-app.
   */
  const createPerson = useCallback(async (name: string): Promise<PersonRow | null> => {
    const clean = String(name ?? "").trim();
    if (!clean) return null;

    const base = slugify(clean);

    // attempt 1
    let { data, error } = await supabase
      .from("people")
      .insert({ name: clean, slug: base })
      .select("id,name,slug")
      .single();

    if (!error && data) return { id: String(data.id), name: String(data.name), slug: data.slug ?? null };

    // attempt 2 (collision-safe)
    const suffix = Math.random().toString(36).slice(2, 7);
    ({ data, error } = await supabase
      .from("people")
      .insert({ name: clean, slug: `${base}-${suffix}` })
      .select("id,name,slug")
      .single());

    if (error) return null;
    if (!data) return null;

    return { id: String(data.id), name: String(data.name), slug: data.slug ?? null };
  }, []);

  return {
    // selection state
    movieDirectorIds,
    setMovieDirectorIds,
    movieActorIds,
    setMovieActorIds,

    // search state
    peopleQuery,
    setPeopleQuery,
    peopleSearching,
    peopleResults,
    peopleUiErr,
    resultsById,

    // actions
    searchPeople,
    addDirector,
    removeDirector,
    addActor,
    removeActor,
    createPerson,
    resetPeople,
  };
}
