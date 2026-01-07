// components/catalog/add-item/sections/kinds/PeopleSection.tsx
"use client";

import React from "react";

function safeText(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function SectionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-[#0F172A]">{title}</div>
      {subtitle ? <div className="mt-1 text-xs text-[#64748B]">{subtitle}</div> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * IMPORTANT:
 * Your current people hook exposes:
 * - peopleQuery, setPeopleQuery, peopleResults, searchPeople
 * - resultsById map
 * - movieDirectorIds, movieActorIds
 * - addDirector(id), addActor(id), removeDirector(id), removeActor(id)
 *
 * We keep that exact surface, but make the UI labels configurable.
 * For music, you can still reuse these arrays as "Producers" and "Featured"
 * until you add dedicated fields in the hook + DB.
 */
export default function PeopleSection(p: {
  saving: boolean;

  title: string;
  subtitle?: string;

  people: any; // usePeoplePicker()

  primaryLabel: string; // e.g. "Director" or "Producer"
  secondaryLabel: string; // e.g. "Actor" or "Featured"

  // these map to the existing hook arrays
  primaryIds: string[];
  secondaryIds: string[];

  onAddPrimary: (personId: string) => void;
  onAddSecondary: (personId: string) => void;
  onRemovePrimary: (personId: string) => void;
  onRemoveSecondary: (personId: string) => void;

  onCreatePerson: () => Promise<any | null>;
}) {
  const people = p.people;

  return (
    <SectionShell title={p.title} subtitle={p.subtitle}>
      <div className="space-y-4">
        {people.peopleUiErr ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {people.peopleUiErr}
          </div>
        ) : null}

        <div>
          <div className="text-xs font-semibold text-[#0F172A]">Find person</div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={people.peopleQuery ?? ""}
              onChange={(e) => people.setPeopleQuery?.(e.target.value)}
              placeholder="Search people... (min 2 chars)"
              disabled={p.saving}
              className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
            />

            <button
              type="button"
              onClick={() => people.searchPeople?.()}
              disabled={p.saving || !!people.peopleSearching || String(people.peopleQuery ?? "").trim().length < 2}
              className="rounded-xl bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-200 disabled:text-gray-600"
            >
              {people.peopleSearching ? "Searching..." : "Search"}
            </button>

            <button
              type="button"
              onClick={async () => {
                const row = await p.onCreatePerson();
                if (!row) return;
                people.setPeopleQuery?.(row.name);
                await people.searchPeople?.();
              }}
              disabled={p.saving}
              className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              Create
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {(people.peopleResults ?? []).map((r: any) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E9F2] bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#0F172A]">{safeText(r.name)}</div>
                  <div className="text-[11px] text-[#64748B]">{r.id}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => p.onAddPrimary(r.id)}
                    disabled={p.saving}
                    className="rounded-lg border px-3 py-1 text-xs font-semibold hover:bg-[#F8FAFC]"
                  >
                    Add {p.primaryLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => p.onAddSecondary(r.id)}
                    disabled={p.saving}
                    className="rounded-lg border px-3 py-1 text-xs font-semibold hover:bg-[#F8FAFC]"
                  >
                    Add {p.secondaryLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
          <div className="text-sm font-semibold text-[#0F172A]">{p.primaryLabel}s</div>
          <div className="mt-2 space-y-2">
            {(p.primaryIds ?? []).length === 0 ? (
              <div className="rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">None selected.</div>
            ) : (
              (p.primaryIds ?? []).map((id) => {
                const r = people.resultsById?.get?.(id);
                return (
                  <div key={id} className="flex items-center justify-between rounded-xl border border-[#E5E9F2] p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#0F172A]">{r?.name ?? id}</div>
                      <div className="text-[11px] text-[#64748B]">{id}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => p.onRemovePrimary(id)}
                      disabled={p.saving}
                      className="rounded-lg border px-2 py-1 text-xs font-semibold hover:bg-[#F8FAFC]"
                    >
                      Remove
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
          <div className="text-sm font-semibold text-[#0F172A]">{p.secondaryLabel}s</div>
          <div className="mt-2 space-y-2">
            {(p.secondaryIds ?? []).length === 0 ? (
              <div className="rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">None selected.</div>
            ) : (
              (p.secondaryIds ?? []).map((id) => {
                const r = people.resultsById?.get?.(id);
                return (
                  <div key={id} className="flex items-center justify-between rounded-xl border border-[#E5E9F2] p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#0F172A]">{r?.name ?? id}</div>
                      <div className="text-[11px] text-[#64748B]">{id}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => p.onRemoveSecondary(id)}
                      disabled={p.saving}
                      className="rounded-lg border px-2 py-1 text-xs font-semibold hover:bg-[#F8FAFC]"
                    >
                      Remove
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
