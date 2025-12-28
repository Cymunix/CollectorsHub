// components/catalog/add-item/hooks/usePeoplePicker.ts
"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeName } from "@/lib/catalog/normalize";

/** local type (because "@/lib/catalog/types" does NOT export Person) */
export type Person = { id: string; name: string };

export function usePeoplePicker(allPeople: Person[]) {
  const [personQuery, setPersonQuery] = useState("");
  const [personSearching, setPersonSearching] = useState(false);
  const [personResults, setPersonResults] = useState<Person[]>([]);

  const [movieDirectorIds, setMovieDirectorIds] = useState<string[]>([]);
  const [movieActorIds, setMovieActorIds] = useState<string[]>([]);

  const searchPeople = async () => {
    const q = normalizeName(personQuery);
    if (!q) {
      setPersonResults([]);
      return;
    }

    setPersonSearching(true);
    try {
      const { data, error } = await supabase
        .from("people")
        .select("id,name")
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(25);

      if (error) throw error;
      setPersonResults((data ?? []) as Person[]);
    } catch (e) {
      console.error(e);
      setPersonResults([]);
    } finally {
      setPersonSearching(false);
    }
  };

  const addDirector = (p: Person) => setMovieDirectorIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));
  const removeDirector = (id: string) => setMovieDirectorIds((prev) => prev.filter((x) => x !== id));

  const addActor = (p: Person) => setMovieActorIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));
  const removeActor = (id: string) => setMovieActorIds((prev) => prev.filter((x) => x !== id));

  const directorPeople = useMemo(
    () => (allPeople ?? []).filter((p) => movieDirectorIds.includes(p.id)),
    [allPeople, movieDirectorIds]
  );

  const actorPeople = useMemo(
    () => (allPeople ?? []).filter((p) => movieActorIds.includes(p.id)),
    [allPeople, movieActorIds]
  );

  const resetPeople = () => {
    setPersonQuery("");
    setPersonResults([]);
    setMovieDirectorIds([]);
    setMovieActorIds([]);
  };

  return {
    personQuery,
    setPersonQuery,
    personSearching,
    personResults,
    searchPeople,

    movieDirectorIds,
    movieActorIds,
    addDirector,
    removeDirector,
    addActor,
    removeActor,

    directorPeople,
    actorPeople,

    resetPeople,
  };
}

export default usePeoplePicker;
