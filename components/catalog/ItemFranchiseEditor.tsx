// components/catalog/ItemFranchiseEditor.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Role = "primary" | "secondary" | "crossover";

type Franchise = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
};

type Selected = {
  franchise: Franchise;
  role: Role;
};

function roleWeight(r: Role) {
  return r === "primary" ? 0 : r === "crossover" ? 1 : 2;
}

export default function ItemFranchiseEditor({
  catalogItemId,
  disabled,
  onSaved,
}: {
  catalogItemId: string | null | undefined;
  disabled?: boolean;
  onSaved?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Franchise[]>([]);

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [selected, setSelected] = useState<Selected[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.franchise.id)), [selected]);

  const isDisabled = !!disabled || !catalogItemId;

  // Load existing franchises when editing an existing item
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErrorMsg(null);
      setSavedMsg(null);

      if (!catalogItemId) {
        setSelected([]);
        return;
      }

      setLoadingExisting(true);
      try {
        const { data, error } = await supabase
          .from("catalog_item_franchises")
          .select(
            `
            franchise_id,
            role,
            franchises:franchise_id (
              id, slug, name, description
            )
          `
          )
          .eq("catalog_item_id", catalogItemId);

        if (error) throw error;

        const rows = (data ?? []) as any[];

        const mapped: Selected[] = rows
          .map((r) => ({
            franchise: r.franchises as Franchise,
            role: (r.role as Role) ?? "secondary",
          }))
          .filter((x) => !!x.franchise?.id);

        mapped.sort((a, b) => roleWeight(a.role) - roleWeight(b.role));

        if (!cancelled) setSelected(mapped);
      } catch (e: any) {
        if (!cancelled) setErrorMsg(e?.message ?? "Failed to load franchises");
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  // Search franchises
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErrorMsg(null);
      setSavedMsg(null);

      const q = query.trim();
      if (!q || isDisabled) {
        setResults([]);
        return;
      }

      setSearching(true);
      try {
        const { data, error } = await supabase
          .from("franchises")
          .select("id,slug,name,description")
          .ilike("name", `%${q}%`)
          .limit(20);

        if (error) throw error;

        if (!cancelled) setResults((data ?? []) as Franchise[]);
      } catch (e: any) {
        if (!cancelled) setErrorMsg(e?.message ?? "Search failed");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }

    const t = setTimeout(run, 150); // tiny debounce
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, isDisabled]);

  function add(fr: Franchise) {
    setErrorMsg(null);
    setSavedMsg(null);

    if (!fr?.id) return;
    if (selectedIds.has(fr.id)) return;

    setSelected((prev) => {
      const next: Selected[] = [...prev, { franchise: fr, role: "secondary" }];
      next.sort((a, b) => roleWeight(a.role) - roleWeight(b.role));
      return next;
    });

    setQuery("");
    setResults([]);
  }

  function remove(franchiseId: string) {
    setErrorMsg(null);
    setSavedMsg(null);
    setSelected((prev) => prev.filter((s) => s.franchise.id !== franchiseId));
  }

  function setRole(franchiseId: string, role: Role) {
    setErrorMsg(null);
    setSavedMsg(null);

    setSelected((prev) => {
      let next: Selected[];

      if (role === "primary") {
        // enforce only one primary in UI
        next = prev.map((s): Selected =>
          s.franchise.id === franchiseId
            ? { ...s, role: "primary" }
            : { ...s, role: "secondary" } // <-- stays Role because return typed as Selected
        );
      } else {
        next = prev.map((s): Selected => (s.franchise.id === franchiseId ? { ...s, role } : s));
      }

      next.sort((a, b) => roleWeight(a.role) - roleWeight(b.role));
      return next;
    });
  }

  async function save() {
    setErrorMsg(null);
    setSavedMsg(null);

    if (!catalogItemId) {
      setErrorMsg("Save the item first, then attach franchises.");
      return;
    }

    setSaving(true);
    try {
      // Replace pattern (simple, reliable)
      const del = await supabase.from("catalog_item_franchises").delete().eq("catalog_item_id", catalogItemId);
      if (del.error) throw del.error;

      if (selected.length > 0) {
        const ins = await supabase.from("catalog_item_franchises").insert(
          selected.map((s) => ({
            catalog_item_id: catalogItemId,
            franchise_id: s.franchise.id,
            role: s.role,
          }))
        );
        if (ins.error) throw ins.error;
      }

      setSavedMsg("Saved");
      onSaved?.();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 1200);
    }
  }

  const isCrossover = selected.length >= 2;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm font-semibold">Franchises</div>
        {isCrossover && (
          <span className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700">
            Crossover Item
          </span>
        )}
      </div>

      {!catalogItemId && (
        <div className="mb-3 rounded-xl border bg-gray-50 px-3 py-2 text-xs text-gray-700">
          Create/save the item first. Then you can attach franchises.
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={isDisabled ? "Disabled" : "Search franchise (e.g., Pokémon, Magic...)"}
        disabled={isDisabled}
        className="w-full rounded-xl border px-3 py-2 text-sm disabled:bg-gray-50"
      />

      {(searching || results.length > 0) && !isDisabled && (
        <div className="mt-2 rounded-xl border bg-white overflow-hidden">
          {searching && <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>}
          {results
            .filter((r) => !selectedIds.has(r.id))
            .map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => add(r)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-[11px] text-gray-500">{r.slug}</div>
              </button>
            ))}
          {!searching && results.filter((r) => !selectedIds.has(r.id)).length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">No results</div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loadingExisting && <div className="text-xs text-gray-500">Loading linked franchises...</div>}

        {selected.map((s) => (
          <div key={s.franchise.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{s.franchise.name}</div>
              <div className="text-xs text-gray-500 truncate">{s.franchise.slug}</div>
            </div>

            <select
              value={s.role}
              onChange={(e) => setRole(s.franchise.id, e.target.value as Role)}
              disabled={isDisabled}
              className="rounded-lg border px-2 py-1 text-sm disabled:bg-gray-50"
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="crossover">Crossover</option>
            </select>

            <button
              type="button"
              onClick={() => remove(s.franchise.id)}
              disabled={isDisabled}
              className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50 disabled:bg-gray-50"
            >
              Remove
            </button>
          </div>
        ))}

        {!loadingExisting && selected.length === 0 && <div className="text-xs text-gray-500">No franchises linked yet.</div>}
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isDisabled || saving}
          className="w-full rounded-2xl bg-[#0F172A] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Franchises"}
        </button>

        {savedMsg && <div className="text-xs font-semibold text-green-700">{savedMsg}</div>}
      </div>
    </div>
  );
}
