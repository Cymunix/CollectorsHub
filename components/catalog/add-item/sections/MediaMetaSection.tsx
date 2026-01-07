// components/catalog/add-item/sections/MediaMetaSection.tsx
"use client";

import React, { useMemo } from "react";

type GenreRow = { id: string; name: string };
type AgeRatingRow = { id: string; system: string; code: string; label: string };

function sortByName<T extends { name: string }>(arr: T[]) {
  return [...arr].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function toggleId(list: string[], id: string) {
  const s = new Set(list);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  return Array.from(s);
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

function CreateLinkButton({
  onClick,
  disabled,
  label = "Create",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabled}
      className="text-xs font-semibold text-[#0F172A] underline disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export default function MediaMetaSection(p: {
  kind: string;
  saving: boolean;

  genres: GenreRow[];
  ageRatings: AgeRatingRow[];

  genreIds: string[];
  setGenreIds: (ids: string[]) => void;

  ageRatingId: string;
  setAgeRatingId: (id: string) => void;

  explicitContent: boolean;
  setExplicitContent: (v: boolean) => void;

  onCreateGenre: () => void;
  onCreateAgeRating: () => void;
}) {
  const ratingSystemForKind = useMemo(() => {
    if (p.kind === "movie") return "MPAA";
    if (p.kind === "gaming") return "ESRB";
    if (p.kind === "music") return "MUSIC";
    return null;
  }, [p.kind]);

  const filteredRatings = useMemo(() => {
    if (!ratingSystemForKind) return [];
    return (p.ageRatings ?? []).filter(
      (r) => String(r.system).toUpperCase() === String(ratingSystemForKind).toUpperCase()
    );
  }, [p.ageRatings, ratingSystemForKind]);

  const genresSorted = useMemo(() => sortByName(p.genres ?? []), [p.genres]);

  const subtitle =
    p.kind === "movie"
      ? "Pick genres (multi) and an MPAA rating."
      : p.kind === "gaming"
      ? "Pick genres (multi) and an ESRB rating."
      : p.kind === "music"
      ? "Pick genres (multi) and mark explicit content."
      : "Pick genres and rating.";

  return (
    <SectionShell title="Genre & Age Rating" subtitle={subtitle}>
      <div className="space-y-4">
        {/* Genres */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-[#0F172A]">Genres</div>
              <CreateLinkButton label="(+ New)" onClick={p.onCreateGenre} disabled={p.saving} />
            </div>
            <div className="text-[11px] text-[#64748B]">{(p.genreIds ?? []).length} selected</div>
          </div>

          {(!p.genres || p.genres.length === 0) ? (
            <div className="mt-2 rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">No genres found.</div>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto">
              {genresSorted.map((g) => {
                const checked = (p.genreIds ?? []).includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-2 rounded-xl border p-3 text-sm cursor-pointer transition-colors ${
                      checked ? "bg-blue-50 border-blue-200" : "bg-white border-[#E5E9F2]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => p.setGenreIds(toggleId(p.genreIds ?? [], g.id))}
                      disabled={p.saving}
                      className="h-4 w-4"
                    />
                    <span className="min-w-0 truncate">{g.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Rating / Explicit */}
        {p.kind === "music" ? (
          <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
            <div className="text-xs font-semibold text-[#0F172A]">Explicit</div>
            <div className="mt-1 text-[11px] text-[#64748B]">Used for parental filters and browsing.</div>

            <label className="mt-3 inline-flex items-center gap-2 text-sm text-[#0F172A]">
              <input
                type="checkbox"
                checked={!!p.explicitContent}
                onChange={(e) => p.setExplicitContent(!!e.target.checked)}
                disabled={p.saving}
                className="h-4 w-4"
              />
              Explicit content
            </label>

            {filteredRatings.length ? (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[#0F172A]">Rating ({ratingSystemForKind})</div>
                  <CreateLinkButton label="(+ New)" onClick={p.onCreateAgeRating} disabled={p.saving} />
                </div>

                <select
                  value={p.ageRatingId ?? ""}
                  onChange={(e) => p.setAgeRatingId(e.target.value)}
                  disabled={p.saving}
                  className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {filteredRatings.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} {r.label ? `— ${r.label}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[#0F172A]">
                Age rating{ratingSystemForKind ? ` (${ratingSystemForKind})` : ""}
              </div>
              <CreateLinkButton label="(+ New)" onClick={p.onCreateAgeRating} disabled={p.saving} />
            </div>

            <select
              value={p.ageRatingId ?? ""}
              onChange={(e) => p.setAgeRatingId(e.target.value)}
              disabled={p.saving}
              className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
            >
              <option value="">Select rating…</option>
              {filteredRatings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} {r.label ? `— ${r.label}` : ""}
                </option>
              ))}
            </select>

            {ratingSystemForKind && filteredRatings.length === 0 ? (
              <div className="mt-2 rounded-xl border bg-[#F8FAFC] p-3 text-xs text-[#64748B]">
                No ratings found for <b>{ratingSystemForKind}</b>. Create one above.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </SectionShell>
  );
}
