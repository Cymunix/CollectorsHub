// components/catalog/add-item/sections/kinds/MoviesSection.tsx
"use client";

import React from "react";
import FieldLabel from "../../blocks/FieldLabel";
import TextInput from "../../blocks/TextInput";
import ChipList from "../../blocks/ChipList";
import type { Person } from "@/lib/catalog/types";

export default function MoviesSection({
  personQuery,
  setPersonQuery,
  personSearching,
  personResults,
  onSearchPeople,
  onCreatePerson,

  directorPeople,
  actorPeople,
  onAddDirector,
  onRemoveDirector,
  onAddActor,
  onRemoveActor,
}: {
  personQuery: string;
  setPersonQuery: (v: string) => void;
  personSearching: boolean;
  personResults: Person[];
  onSearchPeople: () => void;
  onCreatePerson: () => void;

  directorPeople: Person[];
  actorPeople: Person[];
  onAddDirector: (p: Person) => void;
  onRemoveDirector: (id: string) => void;
  onAddActor: (p: Person) => void;
  onRemoveActor: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold">Movies</h3>
        <span className="text-[11px] text-gray-500">Release Year required; Director/Actor optional</span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <FieldLabel>Find a person</FieldLabel>
          <button type="button" onClick={onCreatePerson} className="text-[11px] text-blue-600 hover:underline">
            + New person
          </button>
        </div>

        <div className="flex gap-2">
          <TextInput
            value={personQuery}
            onChange={(e) => setPersonQuery(e.target.value)}
            placeholder="Search by name (e.g., Brad Pitt)"
          />
          <button
            type="button"
            onClick={onSearchPeople}
            className="rounded-xl border bg-white px-3 py-2 text-xs hover:bg-gray-50"
          >
            {personSearching ? "…" : "Search"}
          </button>
        </div>

        {personResults.length > 0 && (
          <div className="rounded-xl border bg-white max-h-44 overflow-auto">
            {personResults.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <span>{p.name}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onAddDirector(p)}
                    className="rounded-lg border px-2 py-1 hover:bg-gray-50"
                  >
                    + Director
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddActor(p)}
                    className="rounded-lg border px-2 py-1 hover:bg-gray-50"
                  >
                    + Actor
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-2">
          <FieldLabel>Directors</FieldLabel>
          <ChipList
            items={directorPeople}
            getKey={(p) => p.id}
            render={(p) => (
              <button
                type="button"
                onClick={() => onRemoveDirector(p.id)}
                className="rounded-full border bg-white px-3 py-1 text-[11px] hover:bg-gray-50"
                title="Remove"
              >
                {p.name} ✕
              </button>
            )}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel>Actors</FieldLabel>
          <ChipList
            items={actorPeople}
            getKey={(p) => p.id}
            render={(p) => (
              <button
                type="button"
                onClick={() => onRemoveActor(p.id)}
                className="rounded-full border bg-white px-3 py-1 text-[11px] hover:bg-gray-50"
                title="Remove"
              >
                {p.name} ✕
              </button>
            )}
          />
        </div>
      </div>
    </div>
  );
}
