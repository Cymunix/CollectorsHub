// components/catalog/add-item/sections/kinds/MoviesSection.tsx
"use client";

import React from "react";
import TextInput from "../../blocks/TextInput";
import ChipList from "../../blocks/ChipList";

// local type (because "@/lib/catalog/types" does NOT export Person)
type Person = { id: string; name: string };

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
        <span className="text-[11px] text-gray-500">Directors & cast (optional)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-gray-700">Search people</div>
          <div className="flex gap-2">
            <TextInput
              value={personQuery}
              onChange={(e) => setPersonQuery(e.target.value)}
              placeholder="Type a name…"
            />
            <button
              type="button"
              onClick={onSearchPeople}
              className="rounded-lg border px-3 text-[11px] font-semibold hover:bg-gray-50"
              disabled={personSearching}
            >
              {personSearching ? "…" : "Search"}
            </button>
            <button
              type="button"
              onClick={onCreatePerson}
              className="rounded-lg border px-3 text-[11px] font-semibold hover:bg-gray-50"
            >
              + New
            </button>
          </div>

          {personResults.length ? (
            <div className="rounded-xl border p-2">
              <div className="text-[11px] text-gray-500 mb-1">Results</div>
              <div className="flex flex-wrap gap-2">
                {personResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="rounded-full border px-2 py-1 text-[11px] hover:bg-gray-50"
                    onClick={() => onAddActor(p)}
                    title="Click to add as Actor"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-gray-400">
                Tip: click a name to add as Actor, then move to Director below if needed.
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-gray-400">No results yet.</div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-gray-700 mb-1">Directors</div>
            <ChipList
              items={directorPeople.map((p) => ({ id: p.id, label: p.name }))}
              onRemove={(id) => onRemoveDirector(id)}
              emptyText="None"
            />
          </div>

          <div>
            <div className="text-[11px] font-semibold text-gray-700 mb-1">Actors</div>
            <ChipList
              items={actorPeople.map((p) => ({ id: p.id, label: p.name }))}
              onRemove={(id) => onRemoveActor(id)}
              emptyText="None"
            />
          </div>

          {/* optional: quick add buttons if your UI expects it */}
          {personResults.length ? (
            <div className="rounded-xl border p-2">
              <div className="text-[11px] text-gray-500 mb-2">Add from results</div>
              <div className="flex flex-wrap gap-2">
                {personResults.map((p) => (
                  <div key={p.id} className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-[11px] hover:bg-gray-50"
                      onClick={() => onAddDirector(p)}
                    >
                      + Director
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-[11px] hover:bg-gray-50"
                      onClick={() => onAddActor(p)}
                    >
                      + Actor
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
