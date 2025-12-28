// components/catalog/add-item/sections/kinds/MoviesSection.tsx
"use client";

import React from "react";
import TextInput from "../../blocks/TextInput";
import ChipList from "../../blocks/ChipList";

// local type (because "@/lib/catalog/types" does NOT export Person)
type Person = { id: string; name: string };

function RemoveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-white px-2 py-1 text-[11px]">
      <span className="max-w-[200px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold hover:bg-gray-50"
        aria-label={`Remove ${label}`}
        title="Remove"
      >
        ×
      </button>
    </span>
  );
}

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

      <div className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-gray-700">Search people</div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="min-w-[220px] flex-1">
              <TextInput
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Type a name…"
              />
            </div>

            <button
              type="button"
              onClick={onSearchPeople}
              className="rounded-lg border px-3 py-2 text-[11px] font-semibold hover:bg-gray-50"
              disabled={personSearching}
            >
              {personSearching ? "Searching…" : "Search"}
            </button>

            <button
              type="button"
              onClick={onCreatePerson}
              className="rounded-lg border px-3 py-2 text-[11px] font-semibold hover:bg-gray-50"
            >
              + New
            </button>
          </div>

          {/* Results */}
          {personResults.length ? (
            <div className="rounded-xl border p-3">
              <div className="text-[11px] text-gray-500 mb-2">Results</div>
              <div className="flex flex-wrap gap-2">
                {personResults.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-[11px]">{p.name}</span>
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-[11px] font-semibold hover:bg-gray-50"
                      onClick={() => onAddDirector(p)}
                    >
                      + Director
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-[11px] font-semibold hover:bg-gray-50"
                      onClick={() => onAddActor(p)}
                    >
                      + Actor
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-gray-400">No results yet.</div>
          )}
        </div>

        {/* Directors */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-gray-700">Directors</div>
          {directorPeople.length ? (
            <ChipList
              items={directorPeople}
              getKey={(p) => p.id}
              render={(p) => <RemoveChip label={p.name} onRemove={() => onRemoveDirector(p.id)} />}
            />
          ) : (
            <div className="text-[11px] text-gray-400">None</div>
          )}
        </div>

        {/* Actors */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-gray-700">Actors</div>
          {actorPeople.length ? (
            <ChipList
              items={actorPeople}
              getKey={(p) => p.id}
              render={(p) => <RemoveChip label={p.name} onRemove={() => onRemoveActor(p.id)} />}
            />
          ) : (
            <div className="text-[11px] text-gray-400">None</div>
          )}
        </div>
      </div>
    </div>
  );
}
