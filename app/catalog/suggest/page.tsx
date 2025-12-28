"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/lib/useUserProfile";

type Category = { id: string; name: string };
type Subcategory = { id: string; name: string; category_id: string };
type Franchise = { id: string; name: string };

type Status = "pending" | "needs_info" | "approved" | "rejected";

export default function SuggestItemPage() {
  const router = useRouter();
  const { user, loading: profileLoading } = useUserProfile();

  const [authOpen, setAuthOpen] = useState(false);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaErr, setMetaErr] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);

  // Form
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [franchiseId, setFranchiseId] = useState("");

  const [releaseYear, setReleaseYear] = useState("");
  const [upc, setUpc] = useState("");
  const [version, setVersion] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Minimal “details_json” inputs (optional, user-friendly)
  const [setNumber, setSetNumber] = useState(""); // LEGO sets
  const [minifigNumber, setMinifigNumber] = useState(""); // minifigs
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const filteredSubcategories = useMemo(() => {
    if (!categoryId) return subcategories;
    return subcategories.filter((s) => s.category_id === categoryId);
  }, [subcategories, categoryId]);

  useEffect(() => {
    // If category changes, clear subcategory
    setSubcategoryId("");
  }, [categoryId]);

  useEffect(() => {
    const load = async () => {
      setLoadingMeta(true);
      setMetaErr(null);

      try {
        const [catRes, subRes, franRes] = await Promise.all([
          supabase.from("categories").select("id,name").order("name"),
          supabase.from("subcategories").select("id,name,category_id").order("name"),
          supabase.from("franchises").select("id,name").order("name"),
        ]);

        if (catRes.error) throw catRes.error;
        if (subRes.error) throw subRes.error;

        setCategories((catRes.data ?? []) as Category[]);
        setSubcategories((subRes.data ?? []) as Subcategory[]);
        if (!franRes.error) setFranchises((franRes.data ?? []) as Franchise[]);
      } catch (e: any) {
        console.error(e);
        setMetaErr(e?.message ?? "Failed to load categories.");
      } finally {
        setLoadingMeta(false);
      }
    };

    load();
  }, []);

  const mustAuth = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) console.warn("auth.getUser:", error.message);
    if (!data.user) {
      setAuthOpen(true);
      return null;
    }
    return data.user.id;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBanner(null);

    // Require auth
    const uid = await mustAuth();
    if (!uid) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setBanner({ type: "err", msg: "Name is required." });
      return;
    }

    const yr = releaseYear.trim() ? Number(releaseYear.trim()) : null;
    const safeYear =
      yr !== null && Number.isFinite(yr) ? Math.max(1800, Math.min(2100, Math.trunc(yr))) : null;

    const details_json: Record<string, any> = {};
    if (setNumber.trim()) details_json.set_number = setNumber.trim();
    if (minifigNumber.trim()) details_json.minifig_number = minifigNumber.trim();
    if (notes.trim()) details_json.notes = notes.trim();

    setSaving(true);

    try {
      // Insert suggestion row
      const payload: any = {
        created_by_user_id: uid,
        status: "pending" as Status,
        name: trimmedName,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        franchise_id: franchiseId || null,
        release_year: safeYear,
        upc: upc.trim() || null,
        version: version.trim() || null,
        source_url: sourceUrl.trim() || null,
        image_url: imageUrl.trim() || null,
        details_json,
      };

      const ins = await supabase.from("catalog_item_suggestions").insert(payload).select("id").maybeSingle();
      if (ins.error) throw ins.error;

      setBanner({ type: "ok", msg: "Suggestion submitted ✅" });

      // reset
      setName("");
      setCategoryId("");
      setSubcategoryId("");
      setFranchiseId("");
      setReleaseYear("");
      setUpc("");
      setVersion("");
      setSourceUrl("");
      setImageUrl("");
      setSetNumber("");
      setMinifigNumber("");
      setNotes("");

      // push to "my suggestions"
      router.push("/catalog/my-suggestions");
    } catch (e: any) {
      console.error(e);
      setBanner({ type: "err", msg: e?.message ?? "Failed to submit suggestion." });
    } finally {
      setSaving(false);
    }
  };

  const userReady = !profileLoading && !!user;
  const showAuthHint = !profileLoading && !user;

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A] dark:bg-[#020617] dark:text-[#E5E7EB]">
      <Header />
      <SecondaryNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Suggest an Item</h1>
            <p className="mt-1 text-sm text-[#64748B] dark:text-[#9CA3AF]">
              This does not create a catalog item. It submits a suggestion for admin review.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/catalog/my-suggestions")}
            className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC] dark:hover:bg-[#0B1220]"
          >
            My Suggestions
          </button>
        </div>

        {metaErr ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {metaErr}
          </div>
        ) : null}

        {banner ? (
          <div
            className={`mt-4 rounded-2xl border p-4 text-sm ${
              banner.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {banner.msg}
          </div>
        ) : null}

        {showAuthHint ? (
          <div className="mt-4 rounded-2xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] p-4 text-sm text-[#64748B] dark:text-[#9CA3AF]">
            You’re not logged in. You can still fill the form, but you’ll be asked to log in on submit.
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-2xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="e.g., LEGO 75252 Star Destroyer"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={loadingMeta}
                className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">Subcategory</label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                disabled={loadingMeta}
                className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {filteredSubcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">Franchise</label>
              <select
                value={franchiseId}
                onChange={(e) => setFranchiseId(e.target.value)}
                disabled={loadingMeta}
                className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {franchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">Release year</label>
              <input
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                placeholder="e.g., 2020"
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">UPC</label>
              <input
                value={upc}
                onChange={(e) => setUpc(e.target.value)}
                className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                placeholder="optional"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">Version</label>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                placeholder="optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">Source URL</label>
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                placeholder="Brickset / eBay / official site (optional)"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">Image URL</label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm"
                placeholder="optional"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E9F2] dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#0B1220] p-4">
            <div className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-3">
              Optional Details (stored in <span className="font-mono">details_json</span>)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">
                  LEGO set number
                </label>
                <input
                  value={setNumber}
                  onChange={(e) => setSetNumber(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm"
                  placeholder="e.g., 75252"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">
                  Minifig number
                </label>
                <input
                  value={minifigNumber}
                  onChange={(e) => setMinifigNumber(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm"
                  placeholder="e.g., sw1234"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm"
                placeholder="Anything that helps the admin verify it."
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.push("/catalog")}
              className="rounded-xl border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-4 py-2 text-sm font-semibold hover:bg-[#F8FAFC] dark:hover:bg-[#0B1220]"
            >
              Back to Catalog
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {saving ? "Submitting…" : "Submit Suggestion"}
            </button>
          </div>

          {userReady ? null : (
            <div className="text-[11px] text-[#64748B] dark:text-[#9CA3AF]">
              Login status is checked on submit.
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
