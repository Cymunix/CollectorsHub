"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/lib/useUserProfile";

type Status = "pending" | "needs_info" | "approved" | "rejected";

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

export default function AdminSuggestionsPage() {
  const router = useRouter();
  const { user, loading: profileLoading } = useUserProfile();

  const isAdmin = (user?.roleRaw || "").toLowerCase() === "admin";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<SuggestionRow[]>([]);

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
        "id,created_at,created_by_user_id,status,reviewed_by_user_id,reviewed_at,admin_notes,name,category_id,subcategory_id,franchise_id,release_year,upc,version,source_url,image_url,details_json,approved_catalog_item_id"
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

  useEffect(() => {
    if (profileLoading) return;
    if (!isAdmin) return; // page will show "not authorized"
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
        (r.created_by_user_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

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

  if (profileLoading) {
    return (
      <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A] dark:bg-[#020617] dark:text-[#E5E7EB]">
        <Header />
        <SecondaryNav />
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-[#64748B] dark:text-[#9CA3AF]">Loading…</div>
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
            Not authorized.
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
              Review user submissions. Approve/reject/needs-info here.
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
            {filtered.map((r) => (
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
                    </div>

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
                      disabled={busyId === r.id}
                      onClick={() => setStatusAndNote(r.id, "approved")}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      Approve
                    </button>
                  </div>
                </div>

                {r.reviewed_at ? (
                  <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#9CA3AF]">
                    Reviewed: {ts(r.reviewed_at)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
