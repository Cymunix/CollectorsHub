// app/catalog/[id]/blocks/item_description.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type InfoGrid = {
  franchise: string | null;
  release_date: string | null;
  publisher: string | null;

  card_number: string | null;
  production_status: string | null;

  epid_ebay: string | null;
  tcgplayer_id: string | null;
  collectorshub_id: string | null;
};

const EMPTY_INFO: InfoGrid = {
  franchise: null,
  release_date: null,
  publisher: null,
  card_number: null,
  production_status: null,
  epid_ebay: null,
  tcgplayer_id: null,
  collectorshub_id: null,
};

function normalizeInput(s: string) {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

function display(v: string | null | undefined) {
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}

function safeMergeInfo(input: any): InfoGrid {
  const obj = input && typeof input === "object" ? input : {};
  return {
    franchise: obj.franchise ?? null,
    release_date: obj.release_date ?? null,
    publisher: obj.publisher ?? null,
    card_number: obj.card_number ?? null,
    production_status: obj.production_status ?? null,
    epid_ebay: obj.epid_ebay ?? null,
    tcgplayer_id: obj.tcgplayer_id ?? null,
    collectorshub_id: obj.collectorshub_id ?? null,
  };
}

function Field({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string | null;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-[#64748B]">{label}</div>
      {editing ? (
        <input
          className="mt-1 w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-[#0F172A]/10"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
        />
      ) : (
        <div className="mt-1 text-sm text-[#0F172A] truncate" title={value ?? ""}>
          {display(value)}
        </div>
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // persisted values (what’s loaded/saved)
  const [description, setDescription] = useState<string>("");
  const [info, setInfo] = useState<InfoGrid>(EMPTY_INFO);

  // editing state (draft)
  const [editing, setEditing] = useState(false);
  const [draftDescription, setDraftDescription] = useState<string>("");
  const [draftInfo, setDraftInfo] = useState<InfoGrid>(EMPTY_INFO);

  // keep a snapshot for cancel
  const snapshot = useMemo(
    () => ({
      description,
      info,
    }),
    [description, info]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);
      setEditing(false);

      // Backward + forward compatible:
      // - old column: description
      // - new column: description_text
      // - new column: info (jsonb)
      const res = await supabase
        .from("catalog_item_descriptions")
        .select("description, description_text, info")
        .eq("catalog_item_id", catalogItemId)
        .maybeSingle();

      if (cancelled) return;

      if (res.error) {
        setErr(res.error.message || "Failed to load description.");
        setDescription("");
        setInfo(EMPTY_INFO);
        setDraftDescription("");
        setDraftInfo(EMPTY_INFO);
        setLoading(false);
        return;
      }

      const row: any = res.data ?? null;

      // Prefer description_text if it exists, fallback to description
      const loadedDesc = String(row?.description_text ?? row?.description ?? "");
      const loadedInfo = safeMergeInfo(row?.info);

      setDescription(loadedDesc);
      setInfo(loadedInfo);

      setDraftDescription(loadedDesc);
      setDraftInfo(loadedInfo);

      setLoading(false);
    };

    if (catalogItemId) load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  function startEdit() {
    setDraftDescription(snapshot.description);
    setDraftInfo(snapshot.info);
    setEditing(true);
    setErr(null);
  }

  function cancelEdit() {
    setDraftDescription(snapshot.description);
    setDraftInfo(snapshot.info);
    setEditing(false);
    setErr(null);
  }

  function setField<K extends keyof InfoGrid>(k: K, val: string) {
    setDraftInfo((prev) => ({ ...prev, [k]: normalizeInput(val) }));
  }

  async function save() {
    setSaving(true);
    setErr(null);

    const nextDesc = (draftDescription ?? "").trim();
    const nextInfo = draftInfo;

    // Write BOTH description_text and description for compatibility.
    // You can remove "description" later once fully migrated.
    const payload: any = {
      catalog_item_id: catalogItemId,
      description_text: nextDesc.length ? nextDesc : null,
      description: nextDesc.length ? nextDesc : null,
      info: nextInfo,
    };

    const res = await supabase
      .from("catalog_item_descriptions")
      .upsert(payload, { onConflict: "catalog_item_id" });

    setSaving(false);

    if (res.error) {
      setErr(res.error.message || "Failed to save.");
      return;
    }

    // Commit local state
    setDescription(nextDesc);
    setInfo(nextInfo);
    setEditing(false);
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
            {/* Info Grid */}
            <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field
                  label="Franchise"
                  value={editing ? draftInfo.franchise : info.franchise}
                  editing={editing}
                  onChange={(v) => setField("franchise", v)}
                />
                <Field
                  label="Release Date"
                  value={editing ? draftInfo.release_date : info.release_date}
                  editing={editing}
                  onChange={(v) => setField("release_date", v)}
                />
                <Field
                  label="Publisher"
                  value={editing ? draftInfo.publisher : info.publisher}
                  editing={editing}
                  onChange={(v) => setField("publisher", v)}
                />

                <Field
                  label="Card Number"
                  value={editing ? draftInfo.card_number : info.card_number}
                  editing={editing}
                  onChange={(v) => setField("card_number", v)}
                />
                <Field
                  label="Production Status"
                  value={editing ? draftInfo.production_status : info.production_status}
                  editing={editing}
                  onChange={(v) => setField("production_status", v)}
                />
                <div className="hidden md:block" />

                <Field
                  label="ePID (eBay)"
                  value={editing ? draftInfo.epid_ebay : info.epid_ebay}
                  editing={editing}
                  onChange={(v) => setField("epid_ebay", v)}
                />
                <Field
                  label="TCGPlayer ID"
                  value={editing ? draftInfo.tcgplayer_id : info.tcgplayer_id}
                  editing={editing}
                  onChange={(v) => setField("tcgplayer_id", v)}
                />
                <Field
                  label="CollectorsHub ID"
                  value={editing ? draftInfo.collectorshub_id : info.collectorshub_id}
                  editing={editing}
                  onChange={(v) => setField("collectorshub_id", v)}
                />
              </div>
            </div>

            {/* Free text description */}
            <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4">
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
          </>
        ) : null}
      </div>
    </div>
  );
}
