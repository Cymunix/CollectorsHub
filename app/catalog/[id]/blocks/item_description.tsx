"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CatalogItemRow = {
  id: string;
  description: string | null;
  franchise_id: string | null;
  genre_id?: string | null;
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
  card_set_id?: string | null;
  card_number?: string | null;
  tcgplayer_id?: string | null;
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

function parsePartialDate(input: string): { y: number | null; m: number | null; d: number | null } {
  const raw = (input ?? "").trim();
  if (!raw) return { y: null, m: null, d: null };
  const cleaned = raw.replace(/\//g, "-");
  const parts = cleaned.split("-").map((p) => p.trim()).filter(Boolean);
  const y = parts[0] ? Number(parts[0]) : NaN;
  if (!Number.isFinite(y) || y < 0) return { y: null, m: null, d: null };
  const m = parts[1] ? Number(parts[1]) : null;
  const d = parts[2] ? Number(parts[2]) : null;
  return { y: Math.floor(y), m: m, d: d };
}

const PRODUCTION_STATUS_OPTIONS = [
  { value: "", label: "—" },
  { value: "in_production", label: "In production" },
  { value: "out_of_production", label: "Out of production" },
  { value: "discontinued", label: "Discontinued" },
  { value: "prototype", label: "Prototype" },
  { value: "unknown", label: "Unknown" },
];

function formatProductionStatus(raw: string | null | undefined) {
  const s = String(raw ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
  const known: Record<string, string> = {
    in_production: "In production",
    out_of_production: "Out of production",
    discontinued: "Discontinued",
    prototype: "Prototype",
    unknown: "Unknown",
  };
  if (known[s]) return known[s];
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—";
}

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

async function safeLookup(table: string): Promise<LookupRow[]> {
  try {
    const res = await supabase.from(table).select("id, name").order("name");
    // Fallback for age_ratings which might use 'rating' instead of 'name'
    if (res.error) return [];
    return (res.data || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name || r.rating || "")
    }));
  } catch { return []; }
}

export default function ItemDescription({
  catalogItemId,
  isAdmin,
  categoryName = null,
}: {
  catalogItemId: string;
  isAdmin: boolean;
  categoryName?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [item, setItem] = useState<CatalogItemRow | null>(null);
  const [editing, setEditing] = useState(false);

  const [franchises, setFranchises] = useState<LookupRow[]>([]);
  const [genres, setGenres] = useState<LookupRow[]>([]);
  const [ageRatings, setAgeRatings] = useState<LookupRow[]>([]);

  const [draftDescription, setDraftDescription] = useState("");
  const [draftFranchiseId, setDraftFranchiseId] = useState<string | null>(null);
  const [draftGenreId, setDraftGenreId] = useState<string | null>(null);
  const [draftAgeRatingId, setDraftAgeRatingId] = useState<string | null>(null);
  const [draftProductionStatus, setDraftProductionStatus] = useState("");
  const [draftReleaseDate, setDraftReleaseDate] = useState("");

  const isCardCategory = useMemo(() => {
    const c = String(categoryName ?? "").toLowerCase();
    return c.includes("card") || c.includes("tcg");
  }, [categoryName]);

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
          setDraftGenreId(it.genre_id || null);
          setDraftAgeRatingId(it.age_rating_id || null);
          setDraftProductionStatus(it.production_status || "");
          setDraftReleaseDate(formatPartialDate(it.release_year, it.release_month, it.release_day).replace("—", ""));
        }
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [catalogItemId]);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const rel = parsePartialDate(draftReleaseDate);
      const payload = {
        description: normalizeInput(draftDescription),
        franchise_id: draftFranchiseId,
        genre_id: draftGenreId,
        age_rating_id: draftAgeRatingId,
        production_status: normalizeInput(draftProductionStatus),
        release_year: rel.y,
        release_month: rel.m,
        release_day: rel.d,
      };

      const { error } = await supabase.from("catalog_items").update(payload).eq("id", catalogItemId);
      if (error) throw error;

      setItem((prev) => (prev ? { ...prev, ...payload } : null));
      setEditing(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const fName = franchises.find(f => f.id === String(item?.franchise_id))?.name || "—";
  const gName = genres.find(g => g.id === String(item?.genre_id))?.name || "—";
  const aName = ageRatings.find(a => a.id === String(item?.age_rating_id))?.name || "—";

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Description</div>
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={save} disabled={saving} className="rounded-xl bg-[#0F172A] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="rounded-xl border border-[#E5E9F2] px-3 py-1.5 text-sm font-semibold">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="rounded-xl border border-[#E5E9F2] px-3 py-1.5 text-sm font-semibold">Edit</button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {loading ? <div className="text-sm text-[#64748B] animate-pulse">Loading info...</div> : (
          <>
            <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
              <div className="text-xs font-semibold text-[#64748B] mb-2">Free Text Description</div>
              {editing ? (
                <textarea
                  className="w-full rounded-xl border border-[#E5E9F2] p-3 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-[#0F172A]/10"
                  rows={4}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                />
              ) : (
                <div className="text-sm text-[#0F172A] whitespace-pre-wrap">{item?.description || "No description saved yet."}</div>
              )}
            </div>

            <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Franchise */}
              <div>
                <div className="text-xs font-semibold text-[#64748B]">Franchise</div>
                {editing ? (
                  <select className="mt-1 w-full rounded-xl border p-2 text-sm" value={draftFranchiseId || ""} onChange={(e) => setDraftFranchiseId(e.target.value || null)}>
                    <option value="">—</option>
                    {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                ) : <div className="text-sm mt-1">{display(fName)}</div>}
              </div>

              {/* Genre */}
              <div>
                <div className="text-xs font-semibold text-[#64748B]">Genre</div>
                {editing ? (
                  <select className="mt-1 w-full rounded-xl border p-2 text-sm" value={draftGenreId || ""} onChange={(e) => setDraftGenreId(e.target.value || null)}>
                    <option value="">—</option>
                    {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : <div className="text-sm mt-1">{display(gName)}</div>}
              </div>

              <Field label={isCardCategory ? "Card Number" : "UPC"} value={item?.upc} editing={editing} onChange={(v: string) => setItem((p: any) => ({...p, upc: v}))} />
              <Field label="Publisher" value={item?.publisher} editing={editing} onChange={(v: string) => setItem((p: any) => ({...p, publisher: v}))} />

              {/* Production Status */}
              <div>
                <div className="text-xs font-semibold text-[#64748B]">Production Status</div>
                {editing ? (
                  <select className="mt-1 w-full rounded-xl border p-2 text-sm" value={draftProductionStatus} onChange={(e) => setDraftProductionStatus(e.target.value)}>
                    {PRODUCTION_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : <div className="text-sm mt-1">{formatProductionStatus(item?.production_status)}</div>}
              </div>

              {/* Age Rating */}
              <div>
                <div className="text-xs font-semibold text-[#64748B]">Age Rating</div>
                {editing ? (
                  <select className="mt-1 w-full rounded-xl border p-2 text-sm" value={draftAgeRatingId || ""} onChange={(e) => setDraftAgeRatingId(e.target.value || null)}>
                    <option value="">—</option>
                    {ageRatings.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                ) : <div className="text-sm mt-1">{display(aName)}</div>}
              </div>

              <Field 
                label="Release Date" 
                value={formatPartialDate(item?.release_year ?? null, item?.release_month ?? null, item?.release_day ?? null)} 
                editing={false} 
              />
              <Field label="CollectorsHub ID" value={catalogItemId} editing={false} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
