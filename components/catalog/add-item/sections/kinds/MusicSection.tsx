// components/catalog/add-item/sections/kinds/MusicSection.tsx
"use client";

import React from "react";

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

export default function MusicSection(p: {
  saving: boolean;
  musicArtists: any[];
  musicArtistId: string;
  setMusicArtistId: (v: string) => void;
  onCreateMusicArtist: () => void;
}) {
  return (
    <SectionShell title="Music" subtitle="Artist selection + create artist.">
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-[#0F172A]">Artist</div>
          <CreateLinkButton onClick={p.onCreateMusicArtist} disabled={p.saving} />
        </div>

        <select
          value={p.musicArtistId ?? ""}
          onChange={(e) => p.setMusicArtistId(e.target.value)}
          disabled={p.saving}
          className="mt-1 w-full rounded-xl border border-[#E5E9F2] bg-white px-3 py-2 text-sm"
        >
          <option value="">Select artist…</option>
          {(p.musicArtists ?? []).map((x: any) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </div>
    </SectionShell>
  );
}
