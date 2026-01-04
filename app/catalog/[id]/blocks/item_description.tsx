"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CatalogItemRow = {
  id: string;
  description: string | null;
  franchise_id: string | null;
  genre_id?: string | null;      // Added
  age_rating_id?: string | null; // Added
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

// Helper functions (kept from your working code)
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

function parsePartialDate(input: string) {
  const raw = (input ?? "").trim();
  if (!raw) return { y: null, m: null, d: null };
  const cleaned = raw.replace(/\//g, "-");
  const parts = cleaned.split("-").map(p => p.trim()).filter(Boolean);
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

function normaliseProductionStatus(raw: string | null | undefined) {
  return String(raw ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
}

function formatProductionStatus(raw: string | null | undefined) {
  const cleaned = normaliseProductionStatus(raw);
  const known: Record<string, string> = {
    in_production: "In production",
    out_of_production: "Out of production",
    discontinued: "Discontinued",
    prototype: "Prototype",
    unknown: "Unknown",
  };
  return known[cleaned] || (cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1).replace(/_/g, " ") : "—");
}

function Field({ label, value, editing, onChange, onClick, clickable }: any) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-[#64748B]">{label}</div>
      {editing ? (
        <input
          className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-[#0F172A]/10"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="—"
        />
      ) : clickable ? (
        <button type="button" onClick={onClick} className="mt-1 text-left text-sm truncate w-full text-[#2563EB] hover:underline" title={value}>
          {display(value)}
        </button>
      ) : (
        <div className="mt-1 text-left text-sm truncate w-full text-[#0F172A]" title={value}>
          {display(value)}
        </div>
      )}
    </div>
  );
}

async function safeLookup(table: string): Promise<LookupRow[]> {
  const res = await supabase.from(table).select("id, name").order("name");
  return (res.data || []).map((r: any) => ({ id: String(r.id), name: String(r.name || r.rating || "") }));
}

export default function ItemDescription({ catalogItemId, isAdmin, categoryName = null }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [item, setItem] = useState<CatalogItemRow | null>(null);
  const [editing, setEditing] = useState(false);

  // Lookups
  const [franchises, setFranchises] = useState<LookupRow[]>([]);
  const [genres, setGenres] = useState<LookupRow[]>([]);
  const [ageRatings, setAgeRatings] = useState<LookupRow[]>([]);
  const [cardSets, setCardSets] = useState<LookupRow[]>([]);

  // Display Names
  const [franchiseName, setFranchiseName] = useState("");
  const [genreName, setGenreName] = useState("");
  const [ageRatingName, setAgeRatingName] = useState("");

  // Drafts
  const [draftDescription, setDraftDescription] = useState("");
  const [draftFranchiseId, setDraftFranchiseId] = useState<string | null>(null);
  const [draftGenreId, setDraftGenreId] = useState<string | null>(null);
  const [draftAgeRatingId, setDraftAgeRatingId] = useState<string | null>(null);
  const [draftReleaseDate, setDraftReleaseDate] = useState("");
  const [draftProductionStatus, setDraftProductionStatus] = useState("");

  const categoryKey = String(categoryName ?? "").toLowerCase();
  const isCardCategory = categoryKey.includes("card") || categoryKey.includes("tcg");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: it, error } = await supabase.from("catalog_items").select("*").eq("id", catalogItemId).maybeSingle();
        if (error) throw error;

        const [frs, gen, age, sets] = await Promise.all([
          safeLookup("franchises"),
          safeLookup("genres"),
          safeLookup("age_ratings"),
          safeLookup("card_sets"),
        ]);

        setFranchises(frs);
        setGenres(gen);
        setAgeRatings(age);
        setCardSets(sets);
        setItem(it);

        // Set initial display names
        setFranchiseName(frs.find(f => f.id === String(it?.franchise_id))?.name || "");
        setGenreName(gen.find(g => g.id === String(it?.genre_id))?.name || "");
        setAgeRatingName(age.find(a => a.id === String(it?.age_rating_id))?.name || "");

        // Prime drafts
        setDraftDescription(it?.description || "");
        setDraftFranchiseId(it?.franchise_id || null);
        setDraftGenreId(it?.genre_id || null);
        setDraftAgeRatingId(it?.age_rating_id || null);
        setDraftProductionStatus(normaliseProductionStatus(it?.production_status));
        setDraftReleaseDate(formatPartialDate(it?.release_year, it?.release_month, it?.release_day).replace("—", ""));

        setLoading(false);
      } catch (e: any) {
        setErr(e.message);
        setLoading(false);
      }
    }
    load();
  }, [catalogItemId]);

  async function save() {
    setSaving(true);
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

      setItem({ ...item, ...payload } as any);
      setFranchiseName(franchises.find(f => f.id === draftFranchiseId)?.name || "");
      setGenreName(genres.find(g => g.id === draftGenreId)?.name || "");
      setAgeRatingName(ageRatings.find(a => a.id === draftAgeRatingId)?.name || "");
      
      setEditing(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Description</div>
        {isAdmin && (
          <button
            onClick={editing ? save : () => setEditing(true)}
            className="rounded-xl bg-[#0F172A] px-3 py-1.5 text-sm font-semibold text-white"
          >
            {editing ? (saving ? "Saving..." : "Save") : "Edit"}
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {loading ? <div className="text-sm text-[#64748B]">Loading…</div> : (
          <>
            <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
              <div className="text-xs font-semibold text-[#64748B] mb-2">Free Text Description</div>
              {editing ? (
                <textarea
                  className="w-full rounded-xl border border-[#E5E9F2] p-3 text-sm text-[#0F172A] outline-none"
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
                ) : <div className="text-sm mt-1">{display(franchiseName)}</div>}
              </div>

              {/* Genre */}
              <div>
                <div className="text-xs font-semibold text-[#64748B]">Genre</div>
                {editing ? (
                  <select className="mt-1 w-full rounded-xl border p-2 text-sm" value={draftGenreId || ""} onChange={(e) => setDraftGenreId(e.target.value || null)}>
                    <option value="">—</option>
                    {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : <div className="text-sm mt-1">{display(genreName)}</div>}
              </div>

              {/* UPC / Identifier */}
              <Field label={isCardCategory ? "Card Number" : "UPC"} value={item?.upc} editing={false} />

              {/* Publisher */}
              <Field label="Publisher" value={item?.publisher} editing={false} />

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
                ) : <div className="text-sm mt-1">{display(ageRatingName)}</div>}
              </div>

              <Field label="Release Date" value={formatPartialDate(item?.release_year, item?.release_month, item?.release_day)} editing={false} />
              <Field label="CollectorsHub ID" value={catalogItemId} editing={false} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
