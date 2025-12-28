"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fetchInsights, type CompletenessRow } from "@/lib/collection/insights";

function ProgressRow({ row }: { row: CompletenessRow }) {
  const pct = Math.max(0, Math.min(100, Number(row.completeness_pct || 0)));
  const label = `${row.owned_count}/${row.total_count} • ${pct.toFixed(2)}%`;

  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{row.name}</div>
          <div className="text-sm text-gray-600">{label}</div>
        </div>
        <div className="text-sm font-semibold tabular-nums">{pct.toFixed(2)}%</div>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full bg-black" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: CompletenessRow[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-gray-600">{empty}</div>
      ) : (
        <div className="mt-3 grid gap-2">
          {rows.map((r, i) => (
            <ProgressRow key={`${r.name}-${i}`} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InsightsPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [overview, setOverview] = useState<{ unique_items: number; total_copies: number; graded_items: number } | null>(
    null
  );
  const [bbThemes, setBbThemes] = useState<CompletenessRow[]>([]);
  const [bbSubthemes, setBbSubthemes] = useState<CompletenessRow[]>([]);
  const [artists, setArtists] = useState<CompletenessRow[]>([]);
  const [actors, setActors] = useState<CompletenessRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = await fetchInsights(10);
        if (cancelled) return;

        setOverview(data.overview);
        setBbThemes(data.bbThemes);
        setBbSubthemes(data.bbSubthemes);
        setArtists(data.artists);
        setActors(data.actors);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load insights");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const overviewCards = useMemo(() => {
    const u = overview?.unique_items ?? 0;
    const c = overview?.total_copies ?? 0;
    const g = overview?.graded_items ?? 0;

    return [
      { label: "Unique Items", value: u },
      { label: "Total Copies", value: c },
      { label: "Graded Items", value: g },
    ];
  }, [overview]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Insights</h2>
        {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}
      </div>

      {err ? (
        <div className="mt-3 rounded-2xl border bg-white p-4 text-sm text-red-600">{err}</div>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {overviewCards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-600">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Section
          title="LEGO Theme Completeness"
          rows={bbThemes}
          empty="No LEGO theme data yet."
        />
        <Section
          title="LEGO Subtheme Completeness"
          rows={bbSubthemes}
          empty="No LEGO subtheme data yet."
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Section title="Music Artist Completeness" rows={artists} empty="No music artist data yet." />
        <Section title="Movie Actor Completeness" rows={actors} empty="No movie actor data yet." />
      </div>
    </div>
  );
}
