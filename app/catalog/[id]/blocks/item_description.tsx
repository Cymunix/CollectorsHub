// app/catalog/[id]/blocks/item_description.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CatalogItemRow = {
  id: string;
  franchise_id: string | null;
  card_set_id: string | null;

  publisher: string | null;
  card_number: string | null;
  production_status: string | null;

  release_year: number | null;
  release_month: number | null;
  release_day: number | null;

  end_year: number | null;
  end_month: number | null;
  end_day: number | null;

  epid_ebay: string | null;
  tcgplayer_id: string | null;
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

/**
 * Accepts:
 * - "1992"
 * - "1992-03"
 * - "1992-03-15"
 * - also accepts "1992/03/15"
 * Returns {y,m,d} with missing parts null.
 */
function parsePartialDate(input: string): { y: number | null; m: number | null; d: number | null } {
  const raw = (input ?? "").trim();
  if (!raw) return { y: null, m: null, d: null };

  const cleaned = raw.replace(/\//g, "-");
  const parts = cleaned.split("-").map((p) => p.trim()).filter(Boolean);

  const y = parts[0] ? Number(parts[0]) : NaN;
  if (!Number.isFinite(y) || y < 0) return { y: null, m: null, d: null };

  const m = parts[1] ? Number(parts[1]) : null;
  const d = parts[2] ? Number(parts[2]) : null;

  const mm = m !== null && Number.isFinite(m) ? Math.max(1, Math.min(12, Math.floor(m))) : null;
  const dd = d !== null && Number.isFinite(d) ? Math.max(1, Math.min(31, Math.floor(d))) : null;

  return { y: Math.floor(y), m: mm, d: dd };
}

function Field({
  label,
  value,
  editing,
  onChange,
  onClick,
  clickable,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (v: string) => void;
  onClick?: () => void;
  clickable?: boolean;
}) {
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
      ) : (
        <button
          type="button"
          onClick={clickable ? onClick : undefined}
          className={`mt-1 text-left text-sm truncate w-full ${
            clickable ? "text-[#2563EB] hover:underline" : "text-[#0F172A]"
          }`}
          title={value}
        >
          {display(value)}
        </button>
      )}
    </div>
  );
}

export default function ItemDescription({
  catalogItemId,
  isAdmin,
}: {
  catalogItemId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [item, setItem] = useState<CatalogItemRow | null>(null);

  const [franchiseName, setFranchiseName] = useState<string>("");
  const [setName, setSetName] = useState<string>("");

  const [franchises, setFranchises] = useState<LookupRow[]>([]);
  const [cardSets, setCardSets] = useState<LookupRow[]>([]);

  const [description, setDescription] = useState<string>("");

  const [editing, setEditing] = useState(false);

  // Draft fields (admin edits)
  const [draftFranchiseId, setDraftFranchiseId] = useState<string | null>(null);
  const [draftSetId, setDraftSetId] = useState<string | null>(null);

  const [draftCardNumber, setDraftCardNumber] = useState<string>("");
  const [draftPublisher, setDraftPublisher] = useState<string>("");
  const [draftProductionStatus, setDraftProductionStatus] = useState<string>("");

  const [draftReleaseDate, setDraftReleaseDate] = useState<string>("");
  const [draftEndDate, setDraftEndDate] = useState<string>("");

  const [draftEpid, setDraftEpid] = useState<string>("");
  const [draftTcgPlayer, setDraftTcgPlayer] = useState<string>("");

  const [draftDescription, setDraftDescription] = useState<string>("");

  const collectorsHubId = catalogItemId;

  const releaseDateDisplay = useMemo(() => {
    if (!item) return "—";
    return formatPartialDate(item.release_year, item.release_month, item.release_day);
  }, [item]);

  const endDateDisplay = useMemo(() => {
    if (!item) return "—";
    return formatPartialDate(item.end_year, item.end_month, item.end_day);
  }, [item]);

  function primeDraftFromLoaded(nextItem: CatalogItemRow | null) {
    setDraftFranchiseId(nextItem?.franchise_id ?? null);
    setDraftSetId(nextItem?.card_set_id ?? null);

    setDraftCardNumber(String(nextItem?.card_number ?? ""));
    setDraftPublisher(String(nextItem?.publisher ?? ""));
    setDraftProductionStatus(String(nextItem?.production_status ?? ""));

    setDraftReleaseDate(
      nextItem ? formatPartialDate(nextItem.release_year, nextItem.release_month, nextItem.release_day).replace("—", "") : ""
    );
    setDraftEndDate(
      nextItem ? formatPartialDate(nextItem.end_year, nextItem.end_month, nextItem.end_day).replace("—", "") : ""
    );

    setDraftEpid(String(nextItem?.epid_ebay ?? ""));
    setDraftTcgPlayer(String(nextItem?.tcgplayer_id ?? ""));

    setDraftDescription(description ?? "");
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);
      setEditing(false);

      try {
        // Load catalog item (grid source of truth)
        const itemRes = await supabase
          .from("catalog_items")
          .select(
            "id, franchise_id, card_set_id, publisher, card_number, production_status, release_year, release_month, release_day, end_year, end_month, end_day, epid_ebay, tcgplayer_id"
          )
          .eq("id", catalogItemId)
          .maybeSingle();

        if (itemRes.error) throw itemRes.error;

        const it = (itemRes.data as any) as CatalogItemRow | null;

        // Load free text description
        const descRes = await supabase
          .from("catalog_item_descriptions")
          .select("description, description_text")
          .eq("catalog_item_id", catalogItemId)
          .maybeSingle();

        if (descRes.error) throw descRes.error;

        const descRow: any = descRes.data ?? null;
        const loadedDesc = String(descRow?.description_text ?? descRow?.description ?? "");

        // Lookups (for dropdown + names)
        const [frRes, setRes] = await Promise.all([
          supabase.from("franchises").select("id,name").order("name", { ascending: true }),
          supabase.from("card_sets").select("id,name").order("name", { ascending: true }),
        ]);

        if (frRes.error) throw frRes.error;
        if (setRes.error) throw setRes.error;

        // Resolve franchise/set display names
        let fName = "";
        if (it?.franchise_id) {
          const match = (frRes.data ?? []).find((x: any) => x.id === it.franchise_id);
          fName = String(match?.name ?? "");
        }

        let sName = "";
        if (it?.card_set_id) {
          const match = (setRes.data ?? []).find((x: any) => x.id === it.card_set_id);
          sName = String(match?.name ?? "");
        }

        if (cancelled) return;

        setItem(it);
        setDescription(loadedDesc);

        setFranchises((frRes.data ?? []) as any);
        setCardSets((setRes.data ?? []) as any);

        setFranchiseName(fName);
        setSetName(sName);

        // Prime drafts
        setDraftDescription(loadedDesc);
        primeDraftFromLoaded(it);

        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load item info.");
        setLoading(false);
      }
    };

    if (catalogItemId) load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId]);

  function startEdit() {
    primeDraftFromLoaded(item);
    setDraftDescription(description ?? "");
    setEditing(true);
    setErr(null);
  }

  function cancelEdit() {
    primeDraftFromLoaded(item);
    setDraftDescription(description ?? "");
    setEditing(false);
    setErr(null);
  }

  async function save() {
    if (!item) return;

    setSaving(true);
    setErr(null);

    try {
      const rel = parsePartialDate(draftReleaseDate);
      const end = parsePartialDate(draftEndDate);

      // 1) Update catalog_items (canonical grid data)
      const up1 = await supabase
        .from("catalog_items")
        .update({
          franchise_id: draftFranchiseId,
          card_set_id: draftSetId,

          card_number: normalizeInput(draftCardNumber),
          publisher: normalizeInput(draftPublisher),
          production_status: normalizeInput(draftProductionStatus),

          release_year: rel.y,
          release_month: rel.m,
          release_day: rel.d,

          end_year: end.y,
          end_month: end.m,
          end_day: end.d,

          epid_ebay: normalizeInput(draftEpid),
          tcgplayer_id: normalizeInput(draftTcgPlayer),
        })
        .eq("id", catalogItemId);

      if (up1.error) throw up1.error;

      // 2) Upsert free text description
      const desc = (draftDescription ?? "").trim();
      const up2 = await supabase
        .from("catalog_item_descriptions")
        .upsert(
          {
            catalog_item_id: catalogItemId,
            description_text: desc.length ? desc : null,
            description: desc.length ? desc : null, // keep backward compat
          },
          { onConflict: "catalog_item_id" }
        );

      if (up2.error) throw up2.error;

      // Reload minimal state locally (no refetch needed)
      const newItem: CatalogItemRow = {
        ...item,
        franchise_id: draftFranchiseId,
        card_set_id: draftSetId,

        card_number: normalizeInput(draftCardNumber),
        publisher: normalizeInput(draftPublisher),
        production_status: normalizeInput(draftProductionStatus),

        release_year: rel.y,
        release_month: rel.m,
        release_day: rel.d,

        end_year: end.y,
        end_month: end.m,
        end_day: end.d,

        epid_ebay: normalizeInput(draftEpid),
        tcgplayer_id: normalizeInput(draftTcgPlayer),
      };

      setItem(newItem);
      setDescription(desc);

      // Update display names from lookup arrays
      const fName = draftFranchiseId
        ? String(franchises.find((x) => x.id === draftFranchiseId)?.name ?? "")
        : "";
      const sName = draftSetId
        ? String(cardSets.find((x) => x.id === draftSetId)?.name ?? "")
        : "";

      setFranchiseName(fName);
      setSetName(sName);

      setEditing(false);
      setSaving(false);
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message ?? "Failed to save.");
    }
  }

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Description</div>

        {isAdmin ? (
          editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl bg-[#0F172A] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-xl border border-[#E5E9F2] px-3 py-1.5 text-sm font-semibold text-[#0F172A] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-xl border border-[#E5E9F2] px-3 py-1.5 text-sm font-semibold text-[#0F172A]"
            >
              Edit
            </button>
          )
        ) : null}
      </div>

      <div className="p-4 space-y-4">
        {loading ? <div className="text-sm text-[#64748B]">Loading…</div> : null}
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {!loading ? (
          <>
            {/* Free text description */}
            <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
              <div className="text-xs font-semibold text-[#64748B] mb-2">Free Text Description</div>
              {editing ? (
                <textarea
                  className="w-full rounded-xl border border-[#E5E9F2] p-3 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-[#0F172A]/10"
                  rows={6}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Write a description..."
                />
              ) : description.trim().length ? (
                <div className="text-sm text-[#0F172A] whitespace-pre-wrap">{description}</div>
              ) : (
                <div className="text-sm text-[#64748B]">No description saved yet.</div>
              )}
            </div>

            {/* Grid */}
            <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
              {/* Row 1: Franchise — Set — Card Number — Publisher */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {/* Franchise */}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#64748B]">Franchise</div>
                  {editing ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm text-[#0F172A]"
                      value={draftFranchiseId ?? ""}
                      onChange={(e) => setDraftFranchiseId(e.target.value ? e.target.value : null)}
                    >
                      <option value="">—</option>
                      {franchises.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      className={`mt-1 text-left text-sm truncate w-full ${
                        item?.franchise_id ? "text-[#2563EB] hover:underline" : "text-[#0F172A]"
                      }`}
                      onClick={() => {
                        if (item?.franchise_id) router.push(`/catalog?franchise=${item.franchise_id}`);
                      }}
                      title={franchiseName || "—"}
                    >
                      {display(franchiseName)}
                    </button>
                  )}
                </div>

                {/* Set */}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#64748B]">Set</div>
                  {editing ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm text-[#0F172A]"
                      value={draftSetId ?? ""}
                      onChange={(e) => setDraftSetId(e.target.value ? e.target.value : null)}
                    >
                      <option value="">—</option>
                      {cardSets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      className={`mt-1 text-left text-sm truncate w-full ${
                        item?.card_set_id ? "text-[#2563EB] hover:underline" : "text-[#0F172A]"
                      }`}
                      onClick={() => {
                        if (item?.card_set_id) router.push(`/catalog?set=${item.card_set_id}`);
                      }}
                      title={setName || "—"}
                    >
                      {display(setName)}
                    </button>
                  )}
                </div>

                <Field
                  label="Card Number"
                  value={editing ? draftCardNumber : String(item?.card_number ?? "")}
                  editing={editing}
                  onChange={setDraftCardNumber}
                />
                <Field
                  label="Publisher"
                  value={editing ? draftPublisher : String(item?.publisher ?? "")}
                  editing={editing}
                  onChange={setDraftPublisher}
                />
              </div>

              {/* Row 2: Release Date — Production Status — End Date */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field
                  label="Release Date"
                  value={editing ? draftReleaseDate : releaseDateDisplay}
                  editing={editing}
                  onChange={setDraftReleaseDate}
                />
                <Field
                  label="Production Status"
                  value={editing ? draftProductionStatus : String(item?.production_status ?? "")}
                  editing={editing}
                  onChange={setDraftProductionStatus}
                />
                <Field
                  label="End Date"
                  value={editing ? draftEndDate : endDateDisplay}
                  editing={editing}
                  onChange={setDraftEndDate}
                />
              </div>

              {/* Row 3: ePID — TCGPlayer — CollectorsHub ID */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field
                  label="ePID (eBay)"
                  value={editing ? draftEpid : String(item?.epid_ebay ?? "")}
                  editing={editing}
                  onChange={setDraftEpid}
                />
                <Field
                  label="TCGPlayer ID"
                  value={editing ? draftTcgPlayer : String(item?.tcgplayer_id ?? "")}
                  editing={editing}
                  onChange={setDraftTcgPlayer}
                />
                <Field label="CollectorsHub ID" value={collectorsHubId} editing={false} />
              </div>

              <div className="mt-3 text-[11px] text-[#64748B]">
                Date format accepts <code className="px-1">YYYY</code>, <code className="px-1">YYYY-MM</code>, or{" "}
                <code className="px-1">YYYY-MM-DD</code>.
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
