"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";

type Status = "pending" | "needs_info" | "approved" | "rejected";

type SuggestionRow = {
  id: string;
  created_at: string;
  created_by_user_id: string;
  status: Status;
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
};

function pill(status: Status) {
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border";
  if (status === "approved") return `${base} border-emerald-200 bg-emerald-50 text-emerald-800`;
  if (status === "rejected") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (status === "needs_info") return `${base} border-amber-200 bg-amber-50 text-amber-800`;
  return `${base} border-[#E5E9F2] bg-white text-[#0F172A]`;
}

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

export default function MySuggestionsPage() {
  const router = useRouter();

  const [authOpen, setAuthOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<SuggestionRow[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase.auth.getUser();
      if (error) console.warn("auth.getUser:", error.message);

      const uid = data.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setRows([]);
        setLoading(false);
        setAuthOpen(true);
        return;
      }

      const res = await supabase
        .from("catalog_item_suggestions")
        .select(
          "id,created_at,created_by_user_id,status,admin_notes,name,category_id,subcategory_id,franchise_id,release_year,upc,version,source_url,image_url,details_json"
        )
        .eq("created_by_user_id", uid)
        .order("created_at", { ascending: false });

      if (res.error) {
        console.error(res.error);
        setErr(res.error.message || "Could not load your suggestions.");
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((res.data ?? []) as any);
      setLoading(false);
    };

    run();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.upc ?? "").toLowerCase().includes(q) ||
        (r.source_url ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A] dark:bg-[#020617] dark:text-[#E5E7EB]">
      <Header />
      <SecondaryNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">My Suggestions</h1>
            <p className="mt-1 text-sm text-[#64748B] dark:text-[#9CA3AF]">
              Track your submitted items and review feedback.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/catalog/suggest")}
              className="rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
            >
              Suggest Item
            </button>
            <button
              type="button"
              onClick={() => router.push("/catalog")}
              className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC] dark:hover:bg-[#0B1220]"
            >
              Catalog
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / UPC / source URL"
            className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="needs_info">Needs info</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
        ) : null}

        {loading ? (
          <div className="mt-6 text-sm text-[#64748B] dark:text-[#9CA3AF]">Loading…</div>
        ) : !userId ? (
          <div className="mt-6 rounded-2xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] p-6 text-sm text-[#64748B] dark:text-[#9CA3AF]">
            Log in to view your suggestions.
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#020617] p-8 text-center text-sm text-[#64748B] dark:text-[#9CA3AF]">
            No suggestions found.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-2xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{r.name}</div>
                    <div className="mt-1 text-xs text-[#64748B] dark:text-[#9CA3AF]">
                      Submitted {ts(r.created_at)}
                      {r.release_year ? ` • ${r.release_year}` : ""}
                      {r.upc ? ` • UPC ${r.upc}` : ""}
                    </div>
                  </div>
                  <span className={pill(r.status)}>{r.status.replace("_", " ")}</span>
                </div>

                {r.admin_notes ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="text-[11px] font-semibold mb-1">Admin note</div>
                    <div className="text-sm">{r.admin_notes}</div>
                  </div>
                ) : null}

                {r.source_url ? (
                  <div className="mt-3 text-xs text-[#64748B] dark:text-[#9CA3AF] truncate">
                    Source: <span className="font-mono">{r.source_url}</span>
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
