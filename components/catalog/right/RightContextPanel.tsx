// components/catalog/right/RightContextPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CountRow = { id: string; name: string; count: number };
type DescSource = "override" | "inherited" | "none";

type Props = {
  franchiseId: string;
  categoryId: string;
  subcategoryId: string;
  toyBrandId: string;

  franchises: Array<{ id: string; name: string; description?: string | null }>;
  toyBrands: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  subcategories: Array<{ id: string; name: string; category_id?: string | null }>;

  setCategoryId: (v: string) => void;
  setSubcategoryId: (v: string) => void;

  isAdmin: boolean;
};

export default function RightContextPanel(p: Props) {
  const hasFranchiseFocus = !!p.franchiseId;

  const franchise = useMemo(
    () => p.franchises.find((f) => f.id === p.franchiseId) ?? null,
    [p.franchises, p.franchiseId]
  );

  const brand = useMemo(
    () => (p.toyBrandId ? p.toyBrands.find((b) => b.id === p.toyBrandId) ?? null : null),
    [p.toyBrands, p.toyBrandId]
  );

  const scopeLabel = useMemo(() => {
    if (!franchise) return "No focus";
    if (brand) return `${franchise.name} — ${brand.name}`;
    return franchise.name;
  }, [franchise, brand]);

  const focusKey = useMemo(() => {
    if (!p.franchiseId) return "none";
    return `franchise:${p.franchiseId}|brand:${p.toyBrandId || "none"}|cat:${p.categoryId || "none"}`;
  }, [p.franchiseId, p.toyBrandId, p.categoryId]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [countsByCategory, setCountsByCategory] = useState<CountRow[]>([]);
  const [countsBySubcategory, setCountsBySubcategory] = useState<CountRow[]>([]);

  const [descText, setDescText] = useState<string | null>(null);
  const [descSource, setDescSource] = useState<DescSource>("none");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(false);
    setDraft("");
    setSaving(false);
    setErr(null);
  }, [focusKey]);

  async function loadContext() {
    if (!p.franchiseId) {
      setCountsByCategory([]);
      setCountsBySubcategory([]);
      setDescText(null);
      setDescSource("none");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const base = (franchise as any)?.description ?? null;

      // override lookup (scope = toy brand)
      const { data: ovRows, error: ovErr } = await supabase.rpc("get_franchise_description_override", {
        p_franchise_id: p.franchiseId,
        p_brand_id: p.toyBrandId ? p.toyBrandId : null,
        p_category_id: null,
        p_subcategory_id: null,
      });

      if (ovErr) throw ovErr;

      const override = (ovRows?.[0]?.description ?? null) as string | null;

      if (override && override.trim()) {
        setDescText(override);
        setDescSource("override");
      } else if (base && String(base).trim()) {
        setDescText(String(base));
        setDescSource("inherited");
      } else {
        setDescText(null);
        setDescSource("none");
      }

      const { data: catRows, error: catErr } = await supabase.rpc("get_franchise_category_counts", {
        p_franchise_id: p.franchiseId,
      });
      if (catErr) throw catErr;
      setCountsByCategory((catRows ?? []) as CountRow[]);

      const { data: subRows, error: subErr } = await supabase.rpc("get_franchise_subcategory_counts", {
        p_franchise_id: p.franchiseId,
        p_category_id: p.categoryId ? p.categoryId : null,
      });
      if (subErr) throw subErr;
      setCountsBySubcategory((subRows ?? []) as CountRow[]);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load context.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  async function saveDescription() {
    if (!p.isAdmin) return;

    setSaving(true);
    setErr(null);

    const next = draft.trim();
    const value = next.length ? next : null;

    try {
      if (brand) {
        // scoped override
        const { error } = await supabase
          .from("franchise_description_overrides")
          .upsert(
            [
              {
                franchise_id: p.franchiseId,
                brand_id: p.toyBrandId,
                category_id: null,
                subcategory_id: null,
                description: value,
              },
            ],
            { onConflict: "franchise_id,brand_id,category_id,subcategory_id" }
          );

        if (error) throw error;

        if (value && value.trim()) {
          setDescText(value);
          setDescSource("override");
        } else {
          const base2 = (franchise as any)?.description ?? null;
          if (base2 && String(base2).trim()) {
            setDescText(String(base2));
            setDescSource("inherited");
          } else {
            setDescText(null);
            setDescSource("none");
          }
        }
      } else {
        // default franchise description
        const { error } = await supabase.from("franchises").update({ description: value }).eq("id", p.franchiseId);
        if (error) throw error;

        if (value && value.trim()) {
          setDescText(value);
          setDescSource("inherited");
        } else {
          setDescText(null);
          setDescSource("none");
        }
      }

      setEditing(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (!hasFranchiseFocus) {
    return (
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A]">Context</h3>
        <p className="mt-1 text-xs text-gray-500">Pick a franchise to see details, counts, and description.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-gray-500">Focus</div>
          <div className="mt-0.5 text-sm font-semibold text-[#0F172A]">{scopeLabel}</div>
        </div>
      </div>

      {/* Description */}
      <div className="mt-4 rounded-xl border bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold text-gray-600">Description</div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              {descSource === "override"
                ? "Using scoped override"
                : descSource === "inherited"
                ? "Using franchise default"
                : "No description"}
            </div>
          </div>

          {p.isAdmin && !editing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(descText ?? "");
                setEditing(true);
              }}
              className="text-[11px] font-semibold text-indigo-600 hover:underline"
            >
              {descText ? "Edit" : "Add"}
            </button>
          ) : null}
        </div>

        {!editing ? (
          <div className="mt-2 text-sm text-[#0F172A] whitespace-pre-wrap">
            {descText?.trim() ? descText : <span className="text-gray-400">No description yet.</span>}
          </div>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder={brand ? "Describe this franchise + brand slice…" : "Describe the franchise…"}
              maxLength={1200}
            />
            {err ? <div className="mt-2 text-xs text-red-600">{err}</div> : null}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={saveDescription}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft("");
                  setErr(null);
                }}
                disabled={saving}
                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {/* Counts by category */}
      <div className="mt-4 rounded-xl border bg-white p-3">
        <div className="text-[11px] font-semibold text-gray-600">Items by category</div>

        {loading ? (
          <div className="mt-2 text-xs text-gray-500">Loading…</div>
        ) : countsByCategory.length === 0 ? (
          <div className="mt-2 text-xs text-gray-500">No items found in this franchise.</div>
        ) : (
          <ul className="mt-2 space-y-1">
            {countsByCategory.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-gray-50 ${
                    p.categoryId === r.id ? "bg-gray-50 font-semibold" : ""
                  }`}
                  onClick={() => {
                    p.setCategoryId(r.id);
                    p.setSubcategoryId("");
                  }}
                >
                  <span className="text-gray-800">{r.name}</span>
                  <span className="float-right text-gray-500">{r.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Counts by subcategory */}
      <div className="mt-3 rounded-xl border bg-white p-3">
        <div className="text-[11px] font-semibold text-gray-600">
          Items by subcategory {p.categoryId ? "(selected category)" : "(all)"}
        </div>

        {loading ? (
          <div className="mt-2 text-xs text-gray-500">Loading…</div>
        ) : countsBySubcategory.length === 0 ? (
          <div className="mt-2 text-xs text-gray-500">No subcategories found.</div>
        ) : (
          <ul className="mt-2 max-h-64 space-y-1 overflow-auto pr-1">
            {countsBySubcategory.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-gray-50 ${
                    p.subcategoryId === r.id ? "bg-gray-50 font-semibold" : ""
                  }`}
                  onClick={() => p.setSubcategoryId(r.id)}
                >
                  <span className="text-gray-800">{r.name}</span>
                  <span className="float-right text-gray-500">{r.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {err ? <div className="mt-2 text-xs text-red-600">{err}</div> : null}
      </div>
    </div>
  );
}
