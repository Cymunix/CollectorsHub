// app/catalog/[id]/blocks/item_description.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CatalogItemRow = {
  id: string;

  description: string | null;

  franchise_id: string | null;

  // generic
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

  // card-only
  card_set_id?: string | null;
  card_number?: string | null;
  tcgplayer_id?: string | null;

  // legacy/odd columns may exist (NOT typed here on purpose):
  // platform_id, Platform_id
  // publisher_id, Publisher_Id
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
  const parts = cleaned
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);

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
      ) : clickable ? (
        <button
          type="button"
          onClick={onClick}
          className="mt-1 text-left text-sm truncate w-full text-[#2563EB] hover:underline"
          title={value}
        >
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
  try {
    const res = await supabase.from(table).select("id,name").order("name", { ascending: true });
    if (res.error) return [];
    return ((res.data ?? []) as any[]).map((r) => ({ id: String(r.id), name: String(r.name ?? "") })) as LookupRow[];
  } catch {
    return [];
  }
}

/**
 * Update helper that:
 * - tries with full payload
 * - if it fails due to unknown columns, retries with a reduced payload
 */
async function safeUpdateCatalogItem(
  catalogItemId: string,
  payload: Record<string, any>,
  fallbacks: Array<Record<string, any>>
) {
  const first = await supabase.from("catalog_items").update(payload).eq("id", catalogItemId);
  if (!first.error) return { ok: true as const };

  for (const fb of fallbacks) {
    const next = await supabase.from("catalog_items").update(fb).eq("id", catalogItemId);
    if (!next.error) return { ok: true as const };
  }

  return { ok: false as const, error: first.error };
}

/** pick the first key that exists on the row (handles weird casing) */
function pickExistingKey(row: any, keys: string[]): string | null {
  if (!row || typeof row !== "object") return null;
  for (const k of keys) {
    if (k in row) return k;
  }
  return null;
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
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [item, setItem] = useState<CatalogItemRow | null>(null);

  const [franchiseName, setFranchiseName] = useState<string>("");
  const [setName, setSetName] = useState<string>("");
  const [platformName, setPlatformName] = useState<string>("");
  const [publisherName, setPublisherName] = useState<string>("");

  const [franchises, setFranchises] = useState<LookupRow[]>([]);
  const [cardSets, setCardSets] = useState<LookupRow[]>([]);
  const [platforms, setPlatforms] = useState<LookupRow[]>([]);
  const [publishers, setPublishers] = useState<LookupRow[]>([]);

  const [editing, setEditing] = useState(false);

  // These store the *actual* column names that exist in your table for this row.
  // (e.g. platform_id vs Platform_id, Publisher_Id vs publisher_id)
  const [platformIdKey, setPlatformIdKey] = useState<string | null>(null);
  const [publisherIdKey, setPublisherIdKey] = useState<string | null>(null);

  // Draft fields (admin edits)
  const [draftDescription, setDraftDescription] = useState<string>("");

  const [draftFranchiseId, setDraftFranchiseId] = useState<string | null>(null);

  // generic (legacy text)
  const [draftPublisherText, setDraftPublisherText] = useState<string>("");
  const [draftUpc, setDraftUpc] = useState<string>("");
  const [draftEpid, setDraftEpid] = useState<string>("");

  // card-only
  const [draftSetId, setDraftSetId] = useState<string | null>(null);
  const [draftCardNumber, setDraftCardNumber] = useState<string>("");
  const [draftTcgPlayer, setDraftTcgPlayer] = useState<string>("");

  // ✅ platform (non-card) — read/write to detected key
  const [draftPlatformId, setDraftPlatformId] = useState<string | null>(null);

  // ✅ publisher (non-card) — if Publisher_Id exists, use that; else fallback to text input
  const [draftPublisherId, setDraftPublisherId] = useState<string | null>(null);

  const [draftReleaseDate, setDraftReleaseDate] = useState<string>("");
  const [draftProductionStatus, setDraftProductionStatus] = useState<string>("");
  const [draftEndDate, setDraftEndDate] = useState<string>("");

  const collectorsHubId = catalogItemId;

  const categoryKey = useMemo(() => String(categoryName ?? "").toLowerCase(), [categoryName]);

  const isCardCategory = useMemo(() => {
    const c = categoryKey;
    return c.includes("trading") || c.includes("sports card") || c === "cards" || c.includes("tcg");
  }, [categoryKey]);

  const makerLabel = useMemo(() => {
    const c = categoryKey;
    if (c.includes("lego") || c.includes("toy") || c.includes("figure") || c.includes("collectible")) return "Manufacturer";
    return "Publisher";
  }, [categoryKey]);

  const setOrPlatformLabel = useMemo(() => (isCardCategory ? "Set" : "Platform"), [isCardCategory]);
  const identifierLabel = useMemo(() => (isCardCategory ? "Card Number" : "UPC"), [isCardCategory]);
  const externalIdLabel = useMemo(() => (isCardCategory ? "TCGPlayer ID" : "External ID"), [isCardCategory]);

  const releaseDateDisplay = useMemo(() => {
    if (!item) return "—";
    return formatPartialDate(item.release_year, item.release_month, item.release_day);
  }, [item]);

  const endDateDisplay = useMemo(() => {
    if (!item) return "—";
    return formatPartialDate(item.end_year, item.end_month, item.end_day);
  }, [item]);

  function primeDraftFromLoaded(nextItem: CatalogItemRow | null, pKey: string | null, pubKey: string | null) {
    const row: any = nextItem as any;

    setDraftDescription(String(row?.description ?? ""));
    setDraftFranchiseId(row?.franchise_id ?? null);

    // generic
    setDraftPublisherText(String(row?.publisher ?? ""));
    setDraftUpc(String(row?.upc ?? ""));
    setDraftEpid(String(row?.epid_ebay ?? ""));

    // card-only
    setDraftSetId(row?.card_set_id ?? null);
    setDraftCardNumber(String(row?.card_number ?? ""));
    setDraftTcgPlayer(String(row?.tcgplayer_id ?? ""));

    // platform (non-card)
    setDraftPlatformId(pKey ? (row?.[pKey] ?? null) : (row?.platform_id ?? row?.Platform_id ?? null));

    // publisher (non-card)
    setDraftPublisherId(pubKey ? (row?.[pubKey] ?? null) : (row?.publisher_id ?? row?.Publisher_Id ?? null));

    setDraftReleaseDate(
      nextItem ? formatPartialDate(nextItem.release_year, nextItem.release_month, nextItem.release_day).replace("—", "") : ""
    );
    setDraftProductionStatus(String(row?.production_status ?? ""));
    setDraftEndDate(nextItem ? formatPartialDate(nextItem.end_year, nextItem.end_month, nextItem.end_day).replace("—", "") : "");
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);
      setEditing(false);

      try {
        const itemRes = await supabase.from("catalog_items").select("*").eq("id", catalogItemId).maybeSingle();
        if (itemRes.error) throw itemRes.error;

        const it = (itemRes.data as any) as CatalogItemRow | null;
        const row: any = it as any;

        // Detect the real column names that exist for this row
        const detectedPlatformKey = pickExistingKey(row, ["platform_id", "Platform_id", "game_platform_id"]);
        const detectedPublisherKey = pickExistingKey(row, ["publisher_id", "Publisher_Id", "Publisher_id", "game_publisher_id"]);

        const [frs, sets, plats, pubs] = await Promise.all([
          safeLookup("franchises"),
          safeLookup("card_sets"),
          safeLookup("game_platforms"),
          safeLookup("game_publishers"),
        ]);

        let fName = "";
        if (row?.franchise_id) fName = String(frs.find((x) => x.id === String(row.franchise_id))?.name ?? "");

        let sName = "";
        const cardSetId = row?.card_set_id ?? null;
        if (cardSetId) sName = String(sets.find((x) => x.id === String(cardSetId))?.name ?? "");

        let pName = "";
        const platId = detectedPlatformKey ? row?.[detectedPlatformKey] ?? null : null;
        if (platId) pName = String(plats.find((x) => x.id === String(platId))?.name ?? "");

        let pubName = "";
        const pubId = detectedPublisherKey ? row?.[detectedPublisherKey] ?? null : null;
        if (pubId) pubName = String(pubs.find((x) => x.id === String(pubId))?.name ?? "");

        if (cancelled) return;

        setItem(it);

        setPlatformIdKey(detectedPlatformKey);
        setPublisherIdKey(detectedPublisherKey);

        setFranchises(frs);
        setCardSets(sets);
        setPlatforms(plats);
        setPublishers(pubs);

        setFranchiseName(fName);
        setSetName(sName);
        setPlatformName(pName);
        setPublisherName(pubName);

        primeDraftFromLoaded(it, detectedPlatformKey, detectedPublisherKey);

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
    primeDraftFromLoaded(item, platformIdKey, publisherIdKey);
    setEditing(true);
    setErr(null);
  }

  function cancelEdit() {
    primeDraftFromLoaded(item, platformIdKey, publisherIdKey);
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

      const basePayload: Record<string, any> = {
        description: normalizeInput(draftDescription),
        franchise_id: draftFranchiseId,

        // keep legacy text publisher column populated too (it’s harmless and useful)
        publisher: normalizeInput(draftPublisherText),

        upc: normalizeInput(draftUpc),
        epid_ebay: normalizeInput(draftEpid),

        release_year: rel.y,
        release_month: rel.m,
        release_day: rel.d,

        production_status: normalizeInput(draftProductionStatus),

        end_year: end.y,
        end_month: end.m,
        end_day: end.d,
      };

      const cardPayload: Record<string, any> = {
        card_set_id: isCardCategory ? draftSetId : null,
        card_number: isCardCategory ? normalizeInput(draftCardNumber) : null,
        tcgplayer_id: isCardCategory ? normalizeInput(draftTcgPlayer) : null,
      };

      // platform writes to detected key only
      const platformPayload: Record<string, any> = {};
      if (!isCardCategory && platformIdKey) {
        platformPayload[platformIdKey] = draftPlatformId;
      }

      // publisher id writes to detected key only
      const publisherIdPayload: Record<string, any> = {};
      if (!isCardCategory && publisherIdKey) {
        publisherIdPayload[publisherIdKey] = draftPublisherId;
      }

      const tryFull = {
        ...basePayload,
        ...(isCardCategory ? cardPayload : {}),
        ...(!isCardCategory ? platformPayload : {}),
        ...(!isCardCategory ? publisherIdPayload : {}),
      };

      const fallbacks: Array<Record<string, any>> = [];
      fallbacks.push({ ...basePayload, ...(isCardCategory ? cardPayload : {}) });
      fallbacks.push({ ...basePayload, ...(!isCardCategory ? platformPayload : {}) });
      fallbacks.push({ ...basePayload, ...(!isCardCategory ? publisherIdPayload : {}) });
      fallbacks.push({ ...basePayload });

      const res = await safeUpdateCatalogItem(catalogItemId, tryFull, fallbacks);
      if (!res.ok) throw res.error;

      const merged: any = { ...(item as any), ...(tryFull as any) };
      setItem(merged);

      const fName = draftFranchiseId ? String(franchises.find((x) => x.id === draftFranchiseId)?.name ?? "") : "";
      const sName = isCardCategory && draftSetId ? String(cardSets.find((x) => x.id === draftSetId)?.name ?? "") : "";
      const pName = !isCardCategory && draftPlatformId ? String(platforms.find((x) => x.id === draftPlatformId)?.name ?? "") : "";
      const pubName =
        !isCardCategory && draftPublisherId ? String(publishers.find((x) => x.id === draftPublisherId)?.name ?? "") : "";

      setFranchiseName(fName);
      setSetName(sName);
      setPlatformName(pName);
      setPublisherName(pubName);

      setEditing(false);
      setSaving(false);
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message ?? "Failed to save.");
    }
  }

  const row1GridClass = "md:grid-cols-4";
  const row2GridClass = "md:grid-cols-3";
  const row3GridClass = "md:grid-cols-3";

  const pushFranchise = (id: string) => router.push(`/catalog?franchise=${id}`);
  const pushSet = (id: string) => router.push(`/catalog?set=${id}`);
  const pushPlatform = (id: string) => router.push(`/catalog?platform=${id}`);
  const pushPublisher = (id: string) => router.push(`/catalog?publisher=${id}`);

  // For non-card maker display, prefer publisherName when publisherId exists; else fall back to legacy text.
  const makerDisplayValue = useMemo(() => {
    if (isCardCategory) return "";
    if (publisherIdKey) return publisherName;
    return String(item?.publisher ?? "");
  }, [isCardCategory, publisherIdKey, publisherName, item]);

  const makerClickable = useMemo(() => {
    if (isCardCategory) return false;
    return !!(publisherIdKey && draftPublisherId && !editing);
  }, [isCardCategory, publisherIdKey, draftPublisherId, editing]);

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
              ) : (item?.description ?? "").trim().length ? (
                <div className="text-sm text-[#0F172A] whitespace-pre-wrap">{item?.description}</div>
              ) : (
                <div className="text-sm text-[#64748B]">No description saved yet.</div>
              )}
            </div>

            {/* Details grid */}
            <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
              {/* Row 1 */}
              <div className={`grid grid-cols-1 gap-4 ${row1GridClass}`}>
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
                        (item as any)?.franchise_id ? "text-[#2563EB] hover:underline" : "text-[#0F172A]"
                      }`}
                      onClick={() => {
                        const id = (item as any)?.franchise_id ?? null;
                        if (id) pushFranchise(String(id));
                      }}
                      title={franchiseName || "—"}
                    >
                      {display(franchiseName)}
                    </button>
                  )}
                </div>

                {/* Set / Platform */}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#64748B]">{setOrPlatformLabel}</div>

                  {isCardCategory ? (
                    editing ? (
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
                          (item as any)?.card_set_id ? "text-[#2563EB] hover:underline" : "text-[#0F172A]"
                        }`}
                        onClick={() => {
                          const id = (item as any)?.card_set_id ?? null;
                          if (id) pushSet(String(id));
                        }}
                        title={setName || "—"}
                      >
                        {display(setName)}
                      </button>
                    )
                  ) : editing ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm text-[#0F172A]"
                      value={draftPlatformId ?? ""}
                      onChange={(e) => setDraftPlatformId(e.target.value ? e.target.value : null)}
                    >
                      <option value="">—</option>
                      {platforms.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      className={`mt-1 text-left text-sm truncate w-full ${
                        platformName ? "text-[#2563EB] hover:underline" : "text-[#0F172A]"
                      }`}
                      onClick={() => {
                        const row: any = item as any;
                        const id = platformIdKey ? row?.[platformIdKey] ?? null : row?.platform_id ?? row?.Platform_id ?? null;
                        if (id) pushPlatform(String(id));
                      }}
                      title={platformName || "—"}
                    >
                      {display(platformName)}
                    </button>
                  )}
                </div>

                {/* Identifier */}
                {isCardCategory ? (
                  <Field
                    label={identifierLabel}
                    value={editing ? draftCardNumber : String((item as any)?.card_number ?? "")}
                    editing={editing}
                    onChange={setDraftCardNumber}
                  />
                ) : (
                  <Field label={identifierLabel} value={editing ? draftUpc : String(item?.upc ?? "")} editing={editing} onChange={setDraftUpc} />
                )}

                {/* Maker: Publisher (ID-aware) */}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#64748B]">{makerLabel}</div>

                  {isCardCategory ? (
                    <div className="mt-1 text-left text-sm truncate w-full text-[#0F172A]">—</div>
                  ) : editing ? (
                    publisherIdKey ? (
                      <select
                        className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm text-[#0F172A]"
                        value={draftPublisherId ?? ""}
                        onChange={(e) => setDraftPublisherId(e.target.value ? e.target.value : null)}
                      >
                        <option value="">—</option>
                        {publishers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-[#0F172A]/10"
                        value={draftPublisherText}
                        onChange={(e) => setDraftPublisherText(e.target.value)}
                        placeholder="—"
                      />
                    )
                  ) : publisherIdKey ? (
                    <button
                      type="button"
                      className={`mt-1 text-left text-sm truncate w-full ${
                        publisherName ? "text-[#2563EB] hover:underline" : "text-[#0F172A]"
                      }`}
                      onClick={() => {
                        const id = draftPublisherId;
                        if (id) pushPublisher(id);
                      }}
                      title={publisherName || "—"}
                    >
                      {display(publisherName)}
                    </button>
                  ) : (
                    <div className="mt-1 text-left text-sm truncate w-full text-[#0F172A]" title={String(item?.publisher ?? "")}>
                      {display(String(item?.publisher ?? ""))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2 */}
              <div className={`mt-4 grid grid-cols-1 gap-4 ${row2GridClass}`}>
                <Field
                  label="Production Status"
                  value={editing ? draftProductionStatus : String(item?.production_status ?? "")}
                  editing={editing}
                  onChange={setDraftProductionStatus}
                />
                <Field label="Release Date" value={editing ? draftReleaseDate : releaseDateDisplay} editing={editing} onChange={setDraftReleaseDate} />
                <Field label="End Date" value={editing ? draftEndDate : endDateDisplay} editing={editing} onChange={setDraftEndDate} />
              </div>

              {/* Row 3 */}
              <div className={`mt-4 grid grid-cols-1 gap-4 ${row3GridClass}`}>
                <Field label="CollectorsHub ID" value={collectorsHubId} editing={false} />
                <Field label="ePID (eBay)" value={editing ? draftEpid : String(item?.epid_ebay ?? "")} editing={editing} onChange={setDraftEpid} />

                {isCardCategory ? (
                  <Field
                    label={externalIdLabel}
                    value={editing ? draftTcgPlayer : String((item as any)?.tcgplayer_id ?? "")}
                    editing={editing}
                    onChange={setDraftTcgPlayer}
                  />
                ) : (
                  <Field label={externalIdLabel} value={""} editing={false} />
                )}
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
