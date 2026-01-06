"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/lib/useUserProfile";

type Status = "pending" | "needs_info" | "approved" | "rejected";

type LookupRow = { id: string; name: string };
type BbSubthemeRow = { id: string; name: string; theme_id: string };

type SuggestionRow = {
  id: string;
  created_at: string;
  created_by_user_id: string;
  status: Status;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;

  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;
  release_year: number | null;
  upc: string | null;
  version: string | null;
  source_url: string | null;
  image_url: string | null;
  details_json: Record<string, any> | null;

  // new (suggestions lego fields)
  bb_theme_id?: string | null;
  bb_subtheme_id?: string | null;
  bb_set_number?: string | null;
  bb_piece_count?: number | null;
  bb_retail_cad?: number | null;
  bb_retail_usd?: number | null;

  // new (idempotency)
  source?: string | null;
  source_key?: string | null;

  approved_catalog_item_id: string | null;
};

function ts(ts: string) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(s: Status) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border";
  if (s === "approved") return `${base} border-emerald-200 bg-emerald-50 text-emerald-800`;
  if (s === "rejected") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "needs_info") return `${base} border-amber-200 bg-amber-50 text-amber-800`;
  return `${base} border-[#E5E9F2] bg-white text-[#0F172A]`;
}

function isLegoSuggestion(r: SuggestionRow) {
  // Practical: API imports should set bb_set_number.
  // If you later want, you can also detect by category/subcategory IDs.
  return !!(r.bb_set_number && String(r.bb_set_number).trim().length);
}

function toNullableString(v: string) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function toNullableInt(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNullableNumber(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function AdminSuggestionsPage() {
  const router = useRouter();
  const { user, loading: profileLoading } = useUserProfile();

  const isAdmin = (user?.roleRaw || "").toLowerCase() === "admin";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<SuggestionRow[]>([]);

  const [franchises, setFranchises] = useState<LookupRow[]>([]);
  const [bbThemes, setBbThemes] = useState<LookupRow[]>([]);
  const [bbSubthemes, setBbSubthemes] = useState<BbSubthemeRow[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Status>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setErr(null);

    const res = await supabase
      .from("catalog_item_suggestions")
      .select(
        [
          "id",
          "created_at",
          "created_by_user_id",
          "status",
          "reviewed_by_user_id",
          "reviewed_at",
          "admin_notes",
          "name",
          "category_id",
          "subcategory_id",
          "franchise_id",
          "release_year",
          "upc",
          "version",
          "source_url",
          "image_url",
          "details_json",
          "approved_catalog_item_id",
          "source",
          "source_key",
          "bb_theme_id",
          "bb_subtheme_id",
          "bb_set_number",
          "bb_piece_count",
          "bb_retail_cad",
          "bb_retail_usd",
        ].join(",")
      )
      .order("created_at", { ascending: false });

    if (res.error) {
      console.error(res.error);
      setErr(res.error.message || "Failed to load suggestions.");
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((res.data ?? []) as any);
    setLoading(false);
  };

  const loadLookups = async () => {
    const [f, t, s] = await Promise.all([
      supabase.from("franchises").select("id,name").order("name"),
      supabase.from("bb_themes").select("id,name").order("name"),
      supabase.from("bb_subthemes").select("id,name,theme_id").order("name"),
    ]);

    if (f.error) console.warn("Failed to load franchises", f.error);
    else setFranchises((f.data ?? []) as any);

    if (t.error) console.warn("Failed to load bb_themes", t.error);
    else setBbThemes((t.data ?? []) as any);

    if (s.error) console.warn("Failed to load bb_subthemes", s.error);
    else setBbSubthemes((s.data ?? []) as any);
  };

  useEffect(() => {
    if (profileLoading) return;
    if (!isAdmin) return;
    loadLookups();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.upc ?? "").toLowerCase().includes(q) ||
        (r.source_url ?? "").toLowerCase().includes(q) ||
        (r.source_key ?? "").toLowerCase().includes(q) ||
        (r.created_by_user_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  const patchSuggestion = async (id: string, patch: Partial<SuggestionRow>) => {
    if (!isAdmin) return;
    setBusyId(id);
    setErr(null);

    const upd = await supabase.from("catalog_item_suggestions").update(patch).eq("id", id);
    if (upd.error) {
      console.error(upd.error);
      setErr(upd.error.message || "Update failed.");
      setBusyId(null);
      return;
    }

    await load();
    setBusyId(null);
  };

  const setStatusAndNote = async (id: string, next: Status) => {
    if (!isAdmin || !user?.userId) return;

    setBusyId(id);
    setErr(null);

    const admin_notes = (noteDraft[id] ?? "").trim() || null;

    const upd = await supabase
      .from("catalog_item_suggestions")
      .update({
        status: next,
        admin_notes,
        reviewed_by_user_id: user.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (upd.error) {
      console.error(upd.error);
      setErr(upd.error.message || "Update failed.");
      setBusyId(null);
      return;
    }

    await load();
    setBusyId(null);
  };

  const publishSuggestion = async (id: string) => {
    if (!isAdmin || !user?.userId) return;

    setBusyId(id);
    setErr(null);

    const res = await fetch(`/api/admin/suggestions/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed_by_user_id: user.userId }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErr(json?.error || "Publish failed.");
      setBusyId(null);
      return;
    }

    await load();
    setBusyId(null);
  };

  const enrichFromBrickset = async (r: SuggestionRow) => {
    if (!isAdmin) return;

    const setNo = String(r.bb_set_number || "").trim();
    if (!setNo) {
      setErr("Missing bb_set_number on this suggestion.");
      return;
    }

    setBusyId(r.id);
    setErr(null);

    try {
      const res = await fetch(`/api/lego/enrich?setNumber=${encodeURIComponent(setNo)}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Brickset enrich failed.");
      }

      const s = json?.set ?? {};

      // Best-effort theme/subtheme mapping by NAME to your internal bb_* tables
      const themeName = String(s?.theme || "").trim();
      const subthemeName = String(s?.subtheme || "").trim();

      const themeMatch =
        themeName.length > 0
          ? bbThemes.find((t) => (t.name || "").trim().toLowerCase() === themeName.toLowerCase())
          : undefined;

      const subthemeMatch =
        subthemeName.length > 0 && themeMatch
          ? bbSubthemes.find(
              (st) =>
                String(st.theme_id) === String(themeMatch.id) &&
                (st.name || "").trim().toLowerCase() === subthemeName.toLowerCase()
            )
          : undefined;

      const patch: Partial<SuggestionRow> = {
        // core suggestion fields
        name: s?.name ?? r.name,
        release_year: Number.isFinite(Number(s?.year)) ? Number(s.year) : r.release_year,
        image_url: s?.imageUrl ?? r.image_url,
        source_url: s?.bricksetURL ?? r.source_url,

        // lego fields
        bb_set_number: s?.setNumber ?? r.bb_set_number,
        bb_piece_count: Number.isFinite(Number(s?.pieces)) ? Number(s.pieces) : r.bb_piece_count,
        bb_retail_cad: s?.retailCAD ?? r.bb_retail_cad,
        bb_retail_usd: s?.retailUSD ?? r.bb_retail_usd,

        // internal mapping
        bb_theme_id: themeMatch?.id ?? r.bb_theme_id ?? null,
        bb_subtheme_id: subthemeMatch?.id ?? r.bb_subtheme_id ?? null,

        // raw proof for debugging
        details_json: {
          ...(r.details_json || {}),
          brickset: json,
        },

        // idempotency metadata
        source: "brickset",
        source_key: s?.setNumber ?? r.source_key ?? r.bb_set_number ?? null,
      };

      const upd = await supabase.from("catalog_item_suggestions").update(patch).eq("id", r.id);
      if (upd.error) throw upd.error;

      await load();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Brickset enrich failed.");
    } finally {
      setBusyId(null);
    }
  };

  if (profileLoading) {
    return (
      <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A] dark:bg-[#020617] dark:text-[#E5E7EB]">
        <Header />
        <SecondaryNav />
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-[#64748B] dark:text-[#9CA3AF]">
          Loading…
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A] dark:bg-[#020617] dark:text-[#E5E7EB]">
        <Header />
        <SecondaryNav />
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Not authorised.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A] dark:bg-[#020617] dark:text-[#E5E7EB]">
      <Header />
      <SecondaryNav />

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Suggestions (Admin)</h1>
            <p className="mt-1 text-sm text-[#64748B] dark:text-[#9CA3AF]">
              Review user submissions and API imports. Publish from here.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/catalog")}
            className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC] dark:hover:bg-[#0B1220]"
          >
            Back to Catalog
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / UPC / source / user id"
            className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="needs_info">Needs info</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 text-sm text-[#64748B] dark:text-[#9CA3AF]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#020617] p-8 text-center text-sm text-[#64748B] dark:text-[#9CA3AF]">
            No suggestions.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filtered.map((r) => {
              const lego = isLegoSuggestion(r);
              const canPublish =
                !!r.name &&
                !!r.category_id &&
                !!r.subcategory_id &&
                (!lego || (!!r.franchise_id && !!r.bb_set_number));

              const filteredSubthemes = r.bb_theme_id
                ? bbSubthemes.filter((s) => String(s.theme_id) === String(r.bb_theme_id))
                : bbSubthemes;

              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{r.name}</div>
                      <div className="mt-1 text-xs text-[#64748B] dark:text-[#9CA3AF]">
                        {ts(r.created_at)} • user {r.created_by_user_id}
                        {r.release_year ? ` • ${r.release_year}` : ""}
                        {r.upc ? ` • UPC ${r.upc}` : ""}
                        {lego ? ` • LEGO ${r.bb_set_number}` : ""}
                      </div>

                      {r.source_key ? (
                        <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#9CA3AF] truncate">
                          Source key:{" "}
                          <span className="font-mono">
                            {r.source}:{r.source_key}
                          </span>
                        </div>
                      ) : null}

                      {r.source_url ? (
                        <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#9CA3AF] truncate">
                          Source: <span className="font-mono">{r.source_url}</span>
                        </div>
                      ) : null}

                      {r.details_json && Object.keys(r.details_json).length ? (
                        <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#9CA3AF]">
                          details_json:{" "}
                          <span className="font-mono">
                            {JSON.stringify(r.details_json).slice(0, 180)}
                            {JSON.stringify(r.details_json).length > 180 ? "…" : ""}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      <span className={statusBadge(r.status)}>{r.status.replace("_", " ")}</span>
                    </div>
                  </div>

                  {/* Inline editors */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                        Franchise
                      </div>
                      <select
                        value={r.franchise_id ?? ""}
                        disabled={busyId === r.id}
                        onChange={(e) => patchSuggestion(r.id, { franchise_id: e.target.value || null })}
                        className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                      >
                        <option value="">Select franchise…</option>
                        {franchises.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      {lego && !r.franchise_id ? (
                        <div className="mt-1 text-[11px] text-red-600">Required for LEGO publish.</div>
                      ) : null}
                    </div>

                    {lego ? (
                      <div>
                        <div className="text-xs font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                          LEGO Theme
                        </div>
                        <select
                          value={r.bb_theme_id ?? ""}
                          disabled={busyId === r.id}
                          onChange={(e) =>
                            patchSuggestion(r.id, {
                              bb_theme_id: e.target.value || null,
                              bb_subtheme_id: null,
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                        >
                          <option value="">Select theme…</option>
                          {bbThemes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {lego ? (
                      <div>
                        <div className="text-xs font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                          LEGO Subtheme
                        </div>
                        <select
                          value={r.bb_subtheme_id ?? ""}
                          disabled={busyId === r.id}
                          onChange={(e) => patchSuggestion(r.id, { bb_subtheme_id: e.target.value || null })}
                          className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                        >
                          <option value="">Select subtheme…</option>
                          {filteredSubthemes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {lego ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:col-span-2">
                        <div>
                          <div className="text-xs font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                            Set Number
                          </div>
                          <input
                            value={r.bb_set_number ?? ""}
                            disabled={busyId === r.id}
                            onChange={(e) =>
                              patchSuggestion(r.id, { bb_set_number: toNullableString(e.target.value) })
                            }
                            placeholder="e.g. 75313-1"
                            className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                          />
                          {!r.bb_set_number ? (
                            <div className="mt-1 text-[11px] text-red-600">Required for LEGO publish.</div>
                          ) : null}
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                            Piece Count
                          </div>
                          <input
                            value={r.bb_piece_count ?? ""}
                            disabled={busyId === r.id}
                            onChange={(e) =>
                              patchSuggestion(r.id, { bb_piece_count: toNullableInt(e.target.value) as any })
                            }
                            placeholder="e.g. 1022"
                            className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                            Retail CAD
                          </div>
                          <input
                            value={r.bb_retail_cad ?? ""}
                            disabled={busyId === r.id}
                            onChange={(e) =>
                              patchSuggestion(r.id, { bb_retail_cad: toNullableNumber(e.target.value) as any })
                            }
                            placeholder="e.g. 199.99"
                            className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                            Retail USD
                          </div>
                          <input
                            value={r.bb_retail_usd ?? ""}
                            disabled={busyId === r.id}
                            onChange={(e) =>
                              patchSuggestion(r.id, { bb_retail_usd: toNullableNumber(e.target.value) as any })
                            }
                            placeholder="e.g. 159.99"
                            className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Notes + actions */}
                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                    <textarea
                      value={noteDraft[r.id] ?? r.admin_notes ?? ""}
                      onChange={(e) => setNoteDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                      rows={2}
                      placeholder="Admin notes (shown to user for Needs info / Rejected)."
                      className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                    />

                    <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                      {lego ? (
                        <button
                          type="button"
                          disabled={busyId === r.id || !String(r.bb_set_number || "").trim()}
                          onClick={() => enrichFromBrickset(r)}
                          className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC] dark:hover:bg-[#0B1220] disabled:opacity-60"
                          title={
                            !String(r.bb_set_number || "").trim()
                              ? "Enter a set number first."
                              : "Fetch details from Brickset and auto-fill fields."
                          }
                        >
                          Enrich (Brickset)
                        </button>
                      ) : null}

                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => setStatusAndNote(r.id, "needs_info")}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                      >
                        Needs info
                      </button>

                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => setStatusAndNote(r.id, "rejected")}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        Reject
                      </button>

                      <button
                        type="button"
                        disabled={busyId === r.id || !canPublish}
                        onClick={() => publishSuggestion(r.id)}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                        title={!canPublish ? "Fill required fields before publishing." : "Publish to catalog_items"}
                      >
                        Publish / Approve
                      </button>
                    </div>
                  </div>

                  {r.reviewed_at ? (
                    <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#9CA3AF]">
                      Reviewed: {ts(r.reviewed_at)}
                    </div>
                  ) : null}

                  {r.approved_catalog_item_id ? (
                    <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#9CA3AF]">
                      Published item: <span className="font-mono">{r.approved_catalog_item_id}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
