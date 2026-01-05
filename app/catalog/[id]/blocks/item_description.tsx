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
  manufacture_id?: string | null; // (keeping your column name as-is)
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

function formatPartialDate(
  y: number | null | undefined,
  m: number | null | undefined,
  d: number | null | undefined
) {
  if (!y) return "—";
  const yy = String(y).padStart(4, "0");
  if (!m) return yy;
  const mm = String(m).padStart(2, "0");
  if (!d) return `${yy}-${mm}`;
  return `${yy}-${mm}-${String(d).padStart(2, "0")}`;
}

function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? (Math.trunc(n) as number) : null;
}

async function safeLookup(table: string): Promise<LookupRow[]> {
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return [];
    return (data || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.rating || r.name || r.label || r.title || r.code || ""),
    }));
  } catch {
    return [];
  }
}

const PRODUCTION_STATUSES = [
  { id: "in_production", name: "In production" },
  { id: "out_of_production", name: "Out of production" },
  { id: "discontinued", name: "Discontinued" },
  { id: "unknown", name: "Unknown" },
];

export default function ItemDescription({
  catalogItemId,
  isAdmin,
  categoryName = null,
}: any) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [item, setItem] = useState<CatalogItemRow | null>(null);

  // Lookups
  const [franchises, setFranchises] = useState<LookupRow[]>([]);
  const [cardSets, setCardSets] = useState<LookupRow[]>([]);
  const [genres, setGenres] = useState<LookupRow[]>([]);
  const [ageRatings, setAgeRatings] = useState<LookupRow[]>([]);
  const [manufacturers, setManufacturers] = useState<LookupRow[]>([]);

  // Admin edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CatalogItemRow | null>(null);

  const isCard = useMemo(() => {
    const c = String(categoryName ?? "").toLowerCase();
    return c.includes("card") || c.includes("tcg");
  }, [categoryName]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const { data: it, error: itErr } = await supabase
          .from("catalog_items")
          .select("*")
          .eq("id", catalogItemId)
          .maybeSingle();

        if (itErr) throw itErr;

        const [frs, sets, gen, age, mans] = await Promise.all([
          safeLookup("franchises"),
          safeLookup("card_sets"),
          safeLookup("genres"),
          safeLookup("age_ratings"),
          safeLookup("manufacturers"),
        ]);

        setFranchises(frs);
        setCardSets(sets);
        setGenres(gen);
        setAgeRatings(age);
        setManufacturers(mans);

        setItem(it as any);
        setDraft(it as any);
        setEditing(false);
      } catch (e: any) {
        setLoadError(e?.message || "Failed to load item.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [catalogItemId]);

  // Data resolution
  const fName = franchises.find((f) => f.id === item?.franchise_id)?.name;
  const sName = cardSets.find((s) => s.id === item?.card_set_id)?.name;
  const mName = manufacturers.find((m) => m.id === item?.manufacture_id)?.name;

  const gNames = (item?.genre_ids || [])
    .map((id) => genres.find((g) => g.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  const aName = ageRatings.find((a) => a.id === item?.age_rating_id)?.name;

  const showEndDate = ["out_of_production", "discontinued"].includes(
    item?.production_status?.toLowerCase() || ""
  );

  // UI bits
  const Section = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white p-5">
      {children}
    </div>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
      {children}
    </div>
  );

  const Value = ({ children, isLink, href, className = "" }: any) => (
    <div className={`text-sm text-[#0F172A] font-medium truncate ${className}`}>
      {isLink && href && children ? (
        <Link href={href} className="text-blue-600 hover:underline">
          {children}
        </Link>
      ) : (
        children || "—"
      )}
    </div>
  );

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 ${
        props.className || ""
      }`}
    />
  );

  const Textarea = (
    props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
  ) => (
    <textarea
      {...props}
      className={`w-full min-h-[110px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 ${
        props.className || ""
      }`}
    />
  );

  const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 ${
        props.className || ""
      }`}
    />
  );

  function startEdit() {
    setDraft(item ? { ...item } : null);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(item ? { ...item } : null);
    setSaveError(null);
    setEditing(false);
  }

  async function saveEdit() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);

    try {
      // Only send the columns we actually allow editing here
      const payload: Partial<CatalogItemRow> = {
        description: draft.description ?? null,
        franchise_id: draft.franchise_id ?? null,
        card_set_id: draft.card_set_id ?? null,

        publisher: draft.publisher ?? null,
        manufacture_id: draft.manufacture_id ?? null,

        upc: draft.upc ?? null,
        card_number: draft.card_number ?? null,

        genre_ids: draft.genre_ids ?? [],
        age_rating_id: draft.age_rating_id ?? null,

        release_year: draft.release_year ?? null,
        release_month: draft.release_month ?? null,
        release_day: draft.release_day ?? null,

        production_status: draft.production_status ?? null,

        end_year: draft.end_year ?? null,
        end_month: draft.end_month ?? null,
        end_day: draft.end_day ?? null,

        epid_ebay: draft.epid_ebay ?? null,
        tcgplayer_id: draft.tcgplayer_id ?? null,
      };

      const { data: updated, error } = await supabase
        .from("catalog_items")
        .update(payload)
        .eq("id", catalogItemId)
        .select("*")
        .single();

      if (error) throw error;

      setItem(updated as any);
      setDraft(updated as any);
      setEditing(false);
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 text-center animate-pulse text-slate-400 text-sm">
        Loading details...
      </div>
    );

  if (loadError)
    return (
      <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
        {loadError}
      </div>
    );

  const current = editing ? draft : item;

  return (
    <div className="flex flex-col gap-4">
      {/* Admin controls */}
      {isAdmin && (
        <div className="flex items-center justify-end gap-2">
          {!editing ? (
            <button
              onClick={startEdit}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Row 1: Free Text Description */}
      <Section>
        <Label>Free Text Description</Label>
        {!editing ? (
          <div className="text-sm text-[#334155] leading-relaxed whitespace-pre-wrap">
            {item?.description || "No description provided for this item."}
          </div>
        ) : (
          <Textarea
            value={current?.description ?? ""}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, description: e.target.value } : d))
            }
            placeholder="Write a short description..."
          />
        )}
      </Section>

      {/* Row 2: Identity & Connection */}
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label>Franchise</Label>
            {!editing ? (
              <Value isLink href={`/catalog?franchise=${item?.franchise_id}`}>
                {fName}
              </Value>
            ) : (
              <Select
                value={current?.franchise_id ?? ""}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          franchise_id: e.target.value || null,
                        }
                      : d
                  )
                }
              >
                <option value="">—</option>
                {franchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <Label>Set / Theme</Label>
            {!editing ? (
              <Value isLink href={`/catalog?set=${item?.card_set_id}`}>
                {sName}
              </Value>
            ) : (
              <Select
                value={current?.card_set_id ?? ""}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          card_set_id: e.target.value || null,
                        }
                      : d
                  )
                }
              >
                <option value="">—</option>
                {cardSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <Label>{isCard ? "Card Number" : "UPC"}</Label>
            {!editing ? (
              <Value>{isCard ? item?.card_number : item?.upc}</Value>
            ) : (
              <Input
                value={(isCard ? current?.card_number : current?.upc) ?? ""}
                onChange={(e) =>
                  setDraft((d) => {
                    if (!d) return d;
                    if (isCard) return { ...d, card_number: e.target.value };
                    return { ...d, upc: e.target.value };
                  })
                }
                placeholder={isCard ? "e.g. 123" : "e.g. 0123456789012"}
              />
            )}
          </div>
        </div>
      </Section>

      {/* Row 3: Classification */}
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label>Publisher / Manufacture</Label>
            {!editing ? (
              <Value>{item?.publisher || mName}</Value>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  value={current?.publisher ?? ""}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, publisher: e.target.value } : d))
                  }
                  placeholder="Publisher (optional)"
                />
                <Select
                  value={current?.manufacture_id ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            manufacture_id: e.target.value || null,
                          }
                        : d
                    )
                  }
                >
                  <option value="">— Manufacturer —</option>
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label>Genre</Label>
            {!editing ? (
              <Value>{gNames}</Value>
            ) : (
              <Select
                multiple
                value={current?.genre_ids ?? []}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map(
                    (o) => o.value
                  );
                  setDraft((d) => (d ? { ...d, genre_ids: opts } : d));
                }}
                className="h-[120px]"
              >
                {genres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <Label>Age Rating</Label>
            {!editing ? (
              <Value>{aName}</Value>
            ) : (
              <Select
                value={current?.age_rating_id ?? ""}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? { ...d, age_rating_id: e.target.value || null }
                      : d
                  )
                }
              >
                <option value="">—</option>
                {ageRatings.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </Section>

      {/* Row 4: Lifecycle */}
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label>Release Date</Label>
            {!editing ? (
              <Value>
                {formatPartialDate(
                  item?.release_year,
                  item?.release_month,
                  item?.release_day
                )}
              </Value>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Input
                  inputMode="numeric"
                  placeholder="YYYY"
                  value={current?.release_year ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, release_year: toIntOrNull(e.target.value) } : d
                    )
                  }
                />
                <Input
                  inputMode="numeric"
                  placeholder="MM"
                  value={current?.release_month ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, release_month: toIntOrNull(e.target.value) } : d
                    )
                  }
                />
                <Input
                  inputMode="numeric"
                  placeholder="DD"
                  value={current?.release_day ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, release_day: toIntOrNull(e.target.value) } : d
                    )
                  }
                />
              </div>
            )}
          </div>

          <div>
            <Label>Production Status</Label>
            {!editing ? (
              <Value className="capitalize">
                {item?.production_status?.replace(/_/g, " ")}
              </Value>
            ) : (
              <Select
                value={current?.production_status ?? ""}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? { ...d, production_status: e.target.value || null }
                      : d
                  )
                }
              >
                <option value="">—</option>
                {PRODUCTION_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <Label>End Date</Label>
            {!editing ? (
              showEndDate ? (
                <Value>
                  {formatPartialDate(item?.end_year, item?.end_month, item?.end_day)}
                </Value>
              ) : (
                <Value>—</Value>
              )
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Input
                  inputMode="numeric"
                  placeholder="YYYY"
                  value={current?.end_year ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, end_year: toIntOrNull(e.target.value) } : d
                    )
                  }
                />
                <Input
                  inputMode="numeric"
                  placeholder="MM"
                  value={current?.end_month ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, end_month: toIntOrNull(e.target.value) } : d
                    )
                  }
                />
                <Input
                  inputMode="numeric"
                  placeholder="DD"
                  value={current?.end_day ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, end_day: toIntOrNull(e.target.value) } : d
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Row 5: Technical Identifiers */}
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label>CollectorsHub ID</Label>
            <Value className="text-xs font-mono text-slate-500">{item?.id}</Value>
          </div>

          <div>
            <Label>ePID (eBay)</Label>
            {!editing ? (
              <Value>{item?.epid_ebay}</Value>
            ) : (
              <Input
                value={current?.epid_ebay ?? ""}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, epid_ebay: e.target.value } : d))
                }
                placeholder="eBay ePID"
              />
            )}
          </div>

          {isCard ? (
            <div>
              <Label>TCGPlayer ID</Label>
              {!editing ? (
                <Value>{item?.tcgplayer_id}</Value>
              ) : (
                <Input
                  value={current?.tcgplayer_id ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, tcgplayer_id: e.target.value } : d
                    )
                  }
                  placeholder="TCGPlayer ID"
                />
              )}
            </div>
          ) : (
            <div className="hidden md:block" />
          )}
        </div>
      </Section>
    </div>
  );
}
