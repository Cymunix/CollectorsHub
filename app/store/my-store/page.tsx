// app/store/my-store/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/lib/useUserProfile";

type StoreProfileForm = {
  username: string;
  store_name: string;
  bio: string;
  location: string;
  profile_picture_url: string;
};

export default function MyStorePage() {
  const { user, loading: userLoading, error: userError } = useUserProfile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // ✅ FIX: AuthModal requires these
  const [authOpen, setAuthOpen] = useState(false);

  const [form, setForm] = useState<StoreProfileForm>({
    username: "",
    store_name: "",
    bio: "",
    location: "",
    profile_picture_url: "",
  });

  const role = String(user?.roleRaw ?? "").toLowerCase();
  const allowed = role === "store" || role === "pawn";
  const storeUserId = user?.userId ?? null;

  const publicUrl = useMemo(() => {
    return storeUserId ? `/stores/${storeUserId}` : "/stores";
  }, [storeUserId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr(null);
      setOk(null);

      if (!storeUserId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const res = await supabase
          .from("profiles")
          .select("username, profile_picture_url, store_name, bio, location")
          .eq("id", storeUserId)
          .maybeSingle();

        if (cancelled) return;

        if (res.error) {
          setErr(res.error.message);
          setLoading(false);
          return;
        }

        const row: any = res.data ?? {};

        setForm({
          username: row.username ?? "",
          store_name: row.store_name ?? "",
          bio: row.bio ?? "",
          location: row.location ?? "",
          profile_picture_url: row.profile_picture_url ?? "",
        });

        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load store profile");
        setLoading(false);
      }
    }

    if (!userLoading) load();

    return () => {
      cancelled = true;
    };
  }, [userLoading, storeUserId]);

  async function save() {
    setSaving(true);
    setErr(null);
    setOk(null);

    if (!storeUserId) {
      setSaving(false);
      setErr("Not logged in.");
      setAuthOpen(true);
      return;
    }

    const payload: any = {
      username: form.username.trim() || null,
      store_name: form.store_name.trim() || null,
      bio: form.bio.trim() || null,
      location: form.location.trim() || null,
      profile_picture_url: form.profile_picture_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const res = await supabase.from("profiles").update(payload).eq("id", storeUserId);

    if (res.error) {
      setSaving(false);
      setErr(res.error.message);
      return;
    }

    setSaving(false);
    setOk("Saved.");
  }

  return (
    <>
      <Header />
      <SecondaryNav />

      {/* ✅ FIX: pass required props */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-semibold">My Store</h1>
            <p className="text-sm text-gray-500">Edit your store profile and preview the public page.</p>
          </div>

          <div className="flex items-center gap-2">
            <Link href={publicUrl} className="px-4 py-2 rounded-xl border bg-white text-sm hover:bg-gray-50">
              View Public Page
            </Link>

            <button
              type="button"
              onClick={save}
              disabled={saving || userLoading || loading || !allowed}
              className="px-4 py-2 rounded-xl bg-[#0B1120] text-white text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {userLoading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">Loading session…</div>
        ) : !user ? (
          <div className="rounded-2xl border bg-white p-6">
            <div className="text-sm font-semibold">You’re not logged in</div>
            <div className="mt-2 text-sm text-gray-600">Open the login modal and sign in.</div>
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="mt-4 rounded-xl bg-[#0B1120] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Login
            </button>
          </div>
        ) : !allowed ? (
          <div className="rounded-2xl border bg-white p-6">
            <div className="text-sm font-semibold">Not authorized</div>
            <div className="mt-2 text-sm text-gray-600">
              This page is only for Store / Pawn accounts. Your role is: <span className="font-mono">{user.roleRaw}</span>
            </div>
          </div>
        ) : loading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
            Loading store profile…
            {userError ? <div className="mt-2 text-xs text-gray-500">{userError}</div> : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border bg-white p-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl overflow-hidden border bg-gray-50 flex items-center justify-center">
                  {form.profile_picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.profile_picture_url} alt="Store logo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-400">No logo</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{form.store_name?.trim() || "Store Name"}</div>
                  <div className="text-xs text-gray-500 truncate">
                    @{form.username?.trim() || "username"} · {role === "pawn" ? "Pawn Store" : "Store"}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{form.bio?.trim() || "Add a short bio about your store…"}</div>

              <div className="mt-3 text-xs text-gray-500">{form.location?.trim() || "Add a location (city)…"}</div>

              {(err || ok || userError) && (
                <div
                  className={`mt-4 rounded-xl border p-3 text-sm ${
                    err || userError ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
                  }`}
                >
                  {err ?? userError ?? ok}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 rounded-2xl border bg-white p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Store Name</label>
                  <input
                    value={form.store_name}
                    onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="e.g. Imperial Pawn & Collectibles"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="e.g. imperialpawn"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
                  <input
                    value={form.profile_picture_url}
                    onChange={(e) => setForm((f) => ({ ...f, profile_picture_url: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="https://…"
                  />
                  <div className="mt-1 text-[11px] text-gray-500">MVP: paste an image URL. Later we’ll add upload.</div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location (city)</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="e.g. Halifax, NS"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account Type</label>
                  <div className="w-full rounded-xl border px-3 py-2 text-sm bg-gray-50 text-gray-700">{role === "pawn" ? "Pawn Store" : "Store"}</div>
                  <div className="mt-1 text-[11px] text-gray-500">Controlled by profiles.role (store/pawn).</div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bio</label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    rows={5}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="What do you sell? What do you buy? Hours? Specialties?"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  Public URL: <span className="font-mono">{publicUrl}</span>
                </div>

                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#0B1120] text-white text-sm disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
