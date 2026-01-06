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
type SubcategoryRow = { id: string; name: string; category_id: string };

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

  // LEGO suggestion fields
  bb_theme_id?: string | null;
  bb_subtheme_id?: string | null;
  bb_set_number?: string | null;
  bb_piece_count?: number | null;
  bb_retail_cad?: number | null;
  bb_retail_usd?: number | null;

  // idempotency
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
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border";
  if (s === "approved") return `${base} border-emerald-200 bg-emerald-50 text-emerald-800`;
  if (s === "rejected") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "needs_info") return `${base} border-amber-200 bg-amber-50 text-amber-800`;
  return `${base} border-[#E5E9F2] bg-white text-[#0F172A]`;
}

function isLegoSuggestion(r: SuggestionRow) {
  // Keep current heuristic: if set number exists, it's LEGO.
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

  const [categories, setCategories] = useState<LookupRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [franchises, setFranchises] = useState<LookupRow[]>([]);
  const [bbThemes, setBbThemes] = useState<LookupRow[]>([]);
  const [bbSubthemes, setBbSubthemes] = useState<BbSubthemeRow[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Status>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  // Import by theme panel
  const [importTheme, setImportTheme] = useState("");
  const [importSubtheme, setImportSubtheme] = useState("");
  const [importYear, setImportYear] = useState("");
  const [importPageSize, setImportPageSize] = useState("200");
  const [importPageNumber, setImportPageNumber] = useState("1");

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
    // If your table names differ, change them here.
    const [cat, sub, f, t, s] = await Promise.all([
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("subcategories").select("id,name,category_id").order("name"),
      supabase.from("franchises").select("id,name").order("name"),
      supabase.from("bb_themes").select("id,name").order("name"),
      supabase.from("bb_subthemes").select("id,name,theme_id").order("name"),
    ]);

    if (cat.error) console.warn("Failed to load categories", cat.error);
    else setCategories((cat.data ?? []) as any);

    if (sub.error) console.warn("Failed to load subcategories", sub.error);
    else setSubcategories((sub.data ?? []) as any);

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

  const importLegoByTheme = async () => {
    if (!isAdmin || !user?.userId) return;

    const theme = importTheme.trim();
    if (!theme) {
      setErr("Theme is required.");
      return;
    }

    setBusyId("__import__");
    setErr(null);

    try {
      const res = await fetch("/api/admin/lego/import-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by_user_id: user.userId,
          theme,
          subtheme: importSubtheme.trim() || null,
          year: importYear.trim() ? Number(importYear.trim()) : null,
          pageSize: importPageSize.trim() ? Number(importPageSize.trim()) : 200,
          pageNumber: importPageNumber.trim() ? Number(importPageNumber.trim()) : 1,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Import failed.");

      await load();
    } catch (e: any) {
      setErr(e?.message || "Import failed.");
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
              Import from Brickset, then classify (category/subcategory/franchise) and publish.
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

        {/* IMPORT PANEL */}
        <div className="mt-4 rounded-2xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Import LEGO sets by theme (Brickset)</div>
              <div className="mt-1 text-xs text-[#64748B] dark:text-[#9CA3AF]">
                This imports suggestions as UNCLASSIFIED. You assign category/subcategory/franchise afterwards.
              </div>
            </div>
            <button
              type="button"
              disabled={busyId === "__import__"}
              onClick={importLegoByTheme}
              className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC] dark:hover:bg-[#0B1220] disabled:opacity-60"
            >
              Import
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <div className="text-xs font-semibold">Theme</div>
              <input
                value={importTheme}
                onChange={(e) => setImportTheme(e.target.value)}
                placeholder='e.g. "Star Wars"'
                className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-xs font-semibold">Subtheme (optional)</div>
              <input
                value={importSubtheme}
                onChange={(e) => setImportSubtheme(e.target.value)}
                placeholder='e.g. "Ultimate Collector Series"'
                className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-xs font-semibold">Year (optional)</div>
              <input
                value={importYear}
                onChange={(e) => setImportYear(e.target.value)}
                placeholder="e.g. 2021"
                className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-xs font-semibold">Page size</div>
              <input
                value={importPageSize}
                onChange={(e) => setImportPageSize(e.target.value)}
                placeholder="200"
                className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-xs font-semibold">Page number</div>
              <input
                value={importPageNumber}
                onChange={(e) => setImportPageNumber(e.target.value)}
                placeholder="1"
                className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* SEARCH / FILTER */}
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
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
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

              // Publish gating: must be classified. LEGO also needs franchise + set number.
              const canPublish =
                !!r.name &&
                !!r.category_id &&
                !!r.subcategory_id &&
                (!lego || (!!r.franchise_id && !!r.bb_set_number));

              const subcatsForRow = r.category_id
                ? subcategories.filter((s) => String(s.category_id) === String(r.category_id))
                : subcategories;

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
                        {lego ? ` • LEGO ${r.bb_set_number}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={statusBadge(r.status)}>{r.status.replace("_", " ")}</span>
                    </div>
                  </div>

                  {/* CLASSIFICATION EDITORS */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs font-semibold">Category</div>
                      <select
                        value={r.category_id ?? ""}
                        disabled={busyId === r.id}
                        onChange={(e) =>
                          patchSuggestion(r.id, {
                            category_id: e.target.value || null,
                            subcategory_id: null,
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                      >
                        <option value="">Select category…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {!r.category_id ? (
                        <div className="mt-1 text-[11px] text-red-600">Required for publish.</div>
                      ) : null}
                    </div>

                    <div>
                      <div className="text-xs font-semibold">Subcategory</div>
                      <select
                        value={r.subcategory_id ?? ""}
                        disabled={busyId === r.id || !r.category_id}
                        onChange={(e) => patchSuggestion(r.id, { subcategory_id: e.target.value || null })}
                        className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                      >
                        <option value="">Select subcategory…</option>
                        {subcatsForRow.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {!r.subcategory_id ? (
                        <div className="mt-1 text-[11px] text-red-600">Required for publish.</div>
                      ) : null}
                    </div>

                    <div>
                      <div className="text-xs font-semibold">Franchise</div>
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
                  </div>

                  {/* LEGO EDITORS */}
                  {lego ? (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-semibold">LEGO Theme</div>
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

                      <div>
                        <div className="text-xs font-semibold">LEGO Subtheme</div>
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

                      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-semibold">Set Number</div>
                          <input
                            value={r.bb_set_number ?? ""}
                            disabled={busyId === r.id}
                            onChange={(e) => patchSuggestion(r.id, { bb_set_number: toNullableString(e.target.value) })}
                            placeholder="e.g. 75313-1"
                            className="mt-1 w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <div className="text-xs font-semibold">Piece Count</div>
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
                          <div className="text-xs font-semibold">Retail CAD</div>
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
                          <div className="text-xs font-semibold">Retail USD</div>
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
                    </div>
                  ) : null}

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
                        title={!canPublish ? "Assign category/subcategory (and franchise for LEGO) before publishing." : "Publish to catalog_items"}
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
