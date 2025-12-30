"use client";

import React, { useMemo, useState } from "react";
import { safeInsertLookup } from "@/lib/catalog/lookups";

type Row = { id: string; name: string };

export default function GamingSection(props: {
  // data
  gamePlatforms: Row[];
  gamePublishers: Row[];

  // selected values
  gamePlatformId: string;
  setGamePlatformId: (v: string) => void;
  gamePublisherId: string;
  setGamePublisherId: (v: string) => void;

  // optional: let parent update meta lists (if provided)
  onPlatformCreated?: (row: Row) => void;
  onPublisherCreated?: (row: Row) => void;

  // optional: disable create buttons (non-admin)
  canCreate?: boolean;
}) {
  const {
    gamePlatforms,
    gamePublishers,
    gamePlatformId,
    setGamePlatformId,
    gamePublisherId,
    setGamePublisherId,
    onPlatformCreated,
    onPublisherCreated,
    canCreate = true,
  } = props;

  // local fallback options so this works even if parent doesn't update meta
  const [localPlatforms, setLocalPlatforms] = useState<Row[]>([]);
  const [localPublishers, setLocalPublishers] = useState<Row[]>([]);
  const [busy, setBusy] = useState<null | "platform" | "publisher">(null);
  const [err, setErr] = useState<string | null>(null);

  const platforms = useMemo(() => {
    const merged = [...(gamePlatforms ?? []), ...localPlatforms];
    const map = new Map<string, Row>();
    merged.forEach((r) => map.set(r.id, r));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [gamePlatforms, localPlatforms]);

  const publishers = useMemo(() => {
    const merged = [...(gamePublishers ?? []), ...localPublishers];
    const map = new Map<string, Row>();
    merged.forEach((r) => map.set(r.id, r));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [gamePublishers, localPublishers]);

  const createPlatform = async () => {
    if (!canCreate || busy) return;
    const name = (window.prompt("New platform name:") || "").trim();
    if (!name) return;

    setErr(null);
    setBusy("platform");
    try {
      const row = await safeInsertLookup("game_platforms", name);
      if (!row) return;

      // parent update if available, plus local fallback
      onPlatformCreated?.(row);
      setLocalPlatforms((p) => [...p, row]);

      setGamePlatformId(row.id);
    } catch (e: any) {
      setErr(e?.message || "Failed to create platform.");
    } finally {
      setBusy(null);
    }
  };

  const createPublisher = async () => {
    if (!canCreate || busy) return;
    const name = (window.prompt("New publisher name:") || "").trim();
    if (!name) return;

    setErr(null);
    setBusy("publisher");
    try {
      const row = await safeInsertLookup("game_publishers", name);
      if (!row) return;

      onPublisherCreated?.(row);
      setLocalPublishers((p) => [...p, row]);

      setGamePublisherId(row.id);
    } catch (e: any) {
      setErr(e?.message || "Failed to create publisher.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[#0F172A]">Gaming Details</h3>
        <p className="mt-0.5 text-xs text-gray-500">Platform is required for video games.</p>
      </div>

      {err ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        {/* Platform */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">
              Platform <span className="text-red-500">*</span>
            </label>

            {canCreate ? (
              <button
                type="button"
                onClick={createPlatform}
                className="text-[11px] font-semibold text-indigo-600 hover:underline disabled:opacity-60"
                disabled={busy !== null}
              >
                {busy === "platform" ? "Adding..." : "+ Add platform"}
              </button>
            ) : null}
          </div>

          <select
            value={gamePlatformId}
            onChange={(e) => setGamePlatformId(e.target.value)}
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="">{platforms.length ? "Select platform..." : "No platforms available"}</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Publisher */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">Publisher</label>

            {canCreate ? (
              <button
                type="button"
                onClick={createPublisher}
                className="text-[11px] font-semibold text-indigo-600 hover:underline disabled:opacity-60"
                disabled={busy !== null}
              >
                {busy === "publisher" ? "Adding..." : "+ Add publisher"}
              </button>
            ) : null}
          </div>

          <select
            value={gamePublisherId}
            onChange={(e) => setGamePublisherId(e.target.value)}
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="">{publishers.length ? "(optional) Select publisher..." : "No publishers available"}</option>
            {publishers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
