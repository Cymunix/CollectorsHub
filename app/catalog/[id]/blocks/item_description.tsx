"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link"; // Added Link
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CatalogItemRow = {
  id: string;
  description: string | null;
  franchise_id: string | null;
  genre_ids?: string[] | null;
  age_rating_id?: string | null;
  publisher: string | null;
  upc: string | null;
  release_year: number | null;
  release_month: number | null;
  release_day: number | null;
  production_status: string | null;
  end_year: number | null;
  end_month: number | null;
  end_day: number | null;
  epid_ebay: string | null;
};

type LookupRow = { id: string; name: string };

function normalizeInput(s: string) {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

function display(v: string | null | undefined) {
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}

function formatPartialDate(y: number | null, m: number | null, d: number | null) {
  if (!y) return "—";
  const yy = String(y).padStart(4, "0");
  if (!m) return yy;
  const mm = String(m).padStart(2, "0");
  if (!d) return `${yy}-${mm}`;
  const dd = String(d).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const PRODUCTION_STATUS_OPTIONS = [
  { value: "", label: "—" },
  { value: "in_production", label: "In production" },
  { value: "out_of_production", label: "Out of production" },
  { value: "discontinued", label: "Discontinued" },
  { value: "prototype", label: "Prototype" },
  { value: "unknown", label: "Unknown" },
];

function Field({ label, value, editing, onChange }: any) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-[#64748B]">{label}</div>
      {editing ? (
        <input
          className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-[#0F172A]/10"
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="—"
        />
      ) : (
        <div className="mt-1 text-left text-sm truncate w-full text-[#0F172A]" title={value}>
          {display(value)}
        </div>
      )}
    </div>
  );
}

// Updated safeLookup to handle the 'rating' column name for age_ratings
async function safeLookup(table: string): Promise<LookupRow[]> {
  try {
    const { data, error } = await supabase.from(table).select("*").order("id");
    if (error) return [];
    
    return (data || []).map((r: any) => ({
      id: String(r.id),
      // Check for 'rating' first (common in age_ratings table), then 'name'
      name: String(r.rating || r.name || "")
    }));
  } catch { return []; }
}

export default function ItemDescription({ catalogItemId, isAdmin, categoryName = null }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<CatalogItemRow | null>(null);
  const [editing, setEditing] = useState(false);

  const [franchises, setFranchises] = useState<LookupRow[]>([]);
  const [genres, setGenres] = useState<LookupRow[]>([]);
  const [ageRatings, setAgeRatings] = useState<LookupRow[]>([]);

  const [draftDescription, setDraftDescription] = useState("");
  const [draftFranchiseId, setDraftFranchiseId] = useState<string | null>(null);
  const [draftGenreIds, setDraftGenreIds] = useState<string[]>([]);
  const [draftAgeRatingId, setDraftAgeRatingId] = useState<string | null>(null);
  const [draftProductionStatus, setDraftProductionStatus] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: it } = await supabase.from("catalog_items").select("*").eq("id", catalogItemId).maybeSingle();
        const [frs, gen, age] = await Promise.all([
          safeLookup("franchises"),
          safeLookup("genres"),
          safeLookup("age_ratings"),
        ]);

        setFranchises(frs);
        setGenres(gen);
        setAgeRatings(age);
        setItem(it);

        if (it) {
          setDraftDescription(it.description || "");
          setDraftFranchiseId(it.franchise_id);
          setDraftGenreIds(it.genre_ids || []);
          setDraftAgeRatingId(it.age_rating_id);
          setDraftProductionStatus(it.production_status || "");
        }
      } catch (e) {} finally { setLoading(false); }
    }
    load();
  }, [catalogItemId]);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        description: normalizeInput(draftDescription),
        franchise_id: draftFranchiseId,
        genre_ids: draftGenreIds,
        age_rating_id: draftAgeRatingId,
        production_status: normalizeInput(draftProductionStatus),
      };
      const { error } = await supabase.from("catalog_items").update(payload).eq("id", catalogItemId);
      if (error) throw error;
      setItem((prev) => (prev ? { ...prev, ...payload } : null));
      setEditing(false);
    } catch (e: any) {
      alert(e.message);
    } finally { setSaving(false); }
  }

  const fName = franchises.find(f => f.id === item?.franchise_id)?.name;
  const gNames = (item?.genre_ids || []).map(id => genres.find(g => g.id === id)?.name).filter(Boolean).join(", ");
  const aName = ageRatings.find(a => a.id === item?.age_rating_id)?.name;

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Description</div>
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <button onClick={save} disabled={saving} className="rounded-xl bg-[#0F172A] px-3 py-1.5 text-sm font-semibold text-white">{saving ? "Saving..." : "Save"}</button>
            ) : (
              <button onClick={() => setEditing(true)} className="rounded-xl border border-[#E5E9F2] px-3 py-1.5 text-sm font-semibold">Edit</button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {loading ? <div className="animate-pulse h-20 bg-slate-50 rounded-xl" /> : (
          <>
            <div className="rounded-2xl border border-[#E5E9F2] p-4">
              <div className="text-xs font-semibold text-[#64748B] mb-2">Free Text Description</div>
              {editing ? (
                <textarea className="w-full rounded-xl border border-[#E5E9F2] p-3 text-sm" rows={4} value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} />
              ) : (
                <div className="text-sm text-[#0F172A]">{item?.description || "No description."}</div>
              )}
            </div>

            <div className="rounded-2xl border border-[#E5E9F2] p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Franchise (CLICKABLE) */}
              <div>
                <div className="text-xs font-semibold text-[#64748B]">Franchise</div>
                {editing ? (
                  <select className="mt-1 w-full rounded-xl border p-2 text-sm" value={draftFranchiseId || ""} onChange={(e) => setDraftFranchiseId(e.target.value || null)}>
                    <option value="">—</option>
                    {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                ) : (
                  <div className="mt-1 text-sm">
                    {item?.franchise_id ? (
                      <Link href={`/catalog?franchise=${item.franchise_id}`} className="text-blue-600 hover:underline font-medium">
                        {fName || "Unknown Franchise"}
                      </Link>
                    ) : "—"}
                  </div>
                )}
              </div>

              {/* Genre */}
              <div>
                <div className="text-xs font-semibold text-[#64748B]">Genre</div>
                {editing ? (
                  <select 
                    className="mt-1 w-full rounded-xl border p-2 text-sm" 
                    value={draftGenreIds[0] || ""} 
                    onChange={(e) => setDraftGenreIds(e.target.value ? [e.target.value] : [])}
                  >
                    <option value="">—</option>
                    {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : <div className="mt-1 text-sm">{display(gNames)}</div>}
              </div>

              {/* Age Rating (FIXED) */}
              <div>
                <div className="text-xs font-semibold text-[#64748B]">Age Rating</div>
                {editing ? (
                  <select className="mt-1 w-full rounded-xl border p-2 text-sm" value={draftAgeRatingId || ""} onChange={(e) => setDraftAgeRatingId(e.target.value || null)}>
                    <option value="">—</option>
                    {ageRatings.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                ) : <div className="mt-1 text-sm">{display(aName)}</div>}
              </div>

              <Field label="Production Status" value={item?.production_status} editing={false} />
              <Field label="Release Date" value={formatPartialDate(item?.release_year ?? null, item?.release_month ?? null, item?.release_day ?? null)} editing={false} />
              <Field label="CollectorsHub ID" value={catalogItemId} editing={false} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
