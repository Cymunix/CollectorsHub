"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type CatalogItemRow = {
  id: string;
  description: string | null;
  franchise_id: string | null;
  card_set_id?: string | null;
  genre_ids?: string[] | null;
  age_rating_id?: string | null;
  publisher: string | null;
  manufacture_id?: string | null;
  upc: string | null;
  card_number?: string | null;
  release_year: number | null;
  release_month: number | null;
  release_day: number | null;
  production_status: string | null;
  end_year: number | null;
  end_month: number | null;
  end_day: number | null;
  epid_ebay: string | null;
  tcgplayer_id?: string | null;
};

type LookupRow = { id: string; name: string };

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
  return `${yy}-${mm}-${String(d).padStart(2, "0")}`;
}

async function safeLookup(table: string): Promise<LookupRow[]> {
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return [];
    return (data || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name || r.rating || r.title || "")
    }));
  } catch { return []; }
}

export default function ItemDescription({ catalogItemId, isAdmin, categoryName = null }: any) {
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<CatalogItemRow | null>(null);
  
  // Lookups
  const [franchises, setFranchises] = useState<LookupRow[]>([]);
  const [cardSets, setCardSets] = useState<LookupRow[]>([]);
  const [genres, setGenres] = useState<LookupRow[]>([]);
  const [ageRatings, setAgeRatings] = useState<LookupRow[]>([]);
  const [manufacturers, setManufacturers] = useState<LookupRow[]>([]);

  const isCard = useMemo(() => {
    const c = String(categoryName ?? "").toLowerCase();
    return c.includes("card") || c.includes("tcg");
  }, [categoryName]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: it } = await supabase.from("catalog_items").select("*").eq("id", catalogItemId).maybeSingle();
      const [frs, sets, gen, age, mans] = await Promise.all([
        safeLookup("franchises"),
        safeLookup("card_sets"),
        safeLookup("genres"),
        safeLookup("age_ratings"),
        safeLookup("manufacturers")
      ]);

      setFranchises(frs);
      setCardSets(sets);
      setGenres(gen);
      setAgeRatings(age);
      setManufacturers(mans);
      setItem(it);
      setLoading(false);
    }
    load();
  }, [catalogItemId]);

  if (loading) return <div className="p-8 text-center animate-pulse text-slate-400 text-sm">Loading details...</div>;

  // Resolve Names
  const fName = franchises.find(f => f.id === item?.franchise_id)?.name;
  const sName = cardSets.find(s => s.id === item?.card_set_id)?.name;
  const mName = manufacturers.find(m => m.id === item?.manufacture_id)?.name;
  const gNames = (item?.genre_ids || []).map(id => genres.find(g => g.id === id)?.name).filter(Boolean).join(", ");
  const aName = ageRatings.find(a => a.id === item?.age_rating_id)?.name;

  const showEndDate = ["out_of_production", "discontinued"].includes(item?.production_status?.toLowerCase() || "");

  const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">{children}</div>
  );

  const Value = ({ children, isLink, href }: any) => (
    <div className="text-sm text-[#0F172A] font-medium truncate">
      {isLink && href ? (
        <Link href={href} className="text-blue-600 hover:underline">{children}</Link>
      ) : display(children)}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Free Text Description */}
      <div className="rounded-2xl border border-[#E5E9F2] bg-white p-5">
        <Label>Free Text Description</Label>
        <div className="text-sm text-[#334155] leading-relaxed whitespace-pre-wrap">
          {item?.description || "No description provided for this item."}
        </div>
      </div>

      {/* Row 2: Identity */}
      <div className="rounded-2xl border border-[#E5E9F2] bg-white p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <Label>Franchise</Label>
          <Value isLink href={`/catalog?franchise=${item?.franchise_id}`}>{fName}</Value>
        </div>
        <div>
          <Label>Set / Theme</Label>
          <Value isLink href={`/catalog?set=${item?.card_set_id}`}>{sName}</Value>
        </div>
        <div>
          <Label>{isCard ? "Card Number" : "UPC"}</Label>
          <Value>{isCard ? item?.card_number : item?.upc}</Value>
        </div>
      </div>

      {/* Row 3: Classification */}
      <div className="rounded-2xl border border-[#E5E9F2] bg-white p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <Label>Publisher / Manufacture</Label>
          <Value>{item?.publisher || mName}</Value>
        </div>
        <div>
          <Label>Genre</Label>
          <Value>{gNames}</Value>
        </div>
        <div>
          <Label>Age Rating</Label>
          <Value>{aName}</Value>
        </div>
      </div>

      {/* Row 4: Lifecycle */}
      <div className="rounded-2xl border border-[#E5E9F2] bg-white p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <Label>Release Date</Label>
          <Value>{formatPartialDate(item?.release_year ?? null, item?.release_month ?? null, item?.release_day ?? null)}</Value>
        </div>
        <div>
          <Label>Production Status</Label>
          <Value className="capitalize">{item?.production_status?.replace(/_/g, " ")}</Value>
        </div>
        {showEndDate && (
          <div>
            <Label>End Date</Label>
            <Value>{formatPartialDate(item?.end_year ?? null, item?.end_month ?? null, item?.end_day ?? null)}</Value>
          </div>
        )}
      </div>

      {/* Row 5: Identifiers */}
      <div className="rounded-2xl border border-[#E5E9F2] bg-white p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <Label>CollectorsHub ID</Label>
          <Value>{item?.id}</Value>
        </div>
        <div>
          <Label>ePID (eBay)</Label>
          <Value>{item?.epid_ebay}</Value>
        </div>
        {isCard && (
          <div>
            <Label>TCGPlayer ID</Label>
            <Value>{item?.tcgplayer_id}</Value>
          </div>
        )}
      </div>
    </div>
  );
}
