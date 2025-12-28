// app/settings/tabs/PrivacyTab.tsx
"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserShape = { userId: string };

export default function PrivacyTab({ user }: { user: UserShape }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [profilePublic, setProfilePublic] = useState(false);
  const [showCollectionValue, setShowCollectionValue] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [allowFollowers, setAllowFollowers] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setStatus(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("profile_public,show_collection_value,show_wishlist,allow_followers")
        .eq("id", user.userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Privacy load error:", error);
        setStatus("Error: Could not load privacy settings.");
      } else {
        setProfilePublic(!!data?.profile_public);
        setShowCollectionValue(!!data?.show_collection_value);
        setShowWishlist(!!data?.show_wishlist);
        setAllowFollowers(!!data?.allow_followers);
      }

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user.userId]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        profile_public: profilePublic,
        show_collection_value: showCollectionValue,
        show_wishlist: showWishlist,
        allow_followers: allowFollowers,
      })
      .eq("id", user.userId);

    if (error) {
      console.error("Privacy save error:", error);
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus("Privacy settings updated.");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="mt-10 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
        Loading privacy…
      </div>
    );
  }

  return (
    <section className="space-y-6 max-w-3xl">
      <div className="rounded-2xl bg-white dark:bg-[#020617] border border-[#E5E9F2] dark:border-[#1F2937] p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-2">
          Privacy &amp; Data
        </h2>
        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">
          Control what other people can see.
        </p>

        <form onSubmit={save} className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profilePublic}
              onChange={(e) => setProfilePublic(e.target.checked)}
              className="h-4 w-4 rounded border-[#D1D5DB]"
            />
            <span>Public profile</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showCollectionValue}
              onChange={(e) => setShowCollectionValue(e.target.checked)}
              className="h-4 w-4 rounded border-[#D1D5DB]"
            />
            <span>Show collection value</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showWishlist}
              onChange={(e) => setShowWishlist(e.target.checked)}
              className="h-4 w-4 rounded border-[#D1D5DB]"
            />
            <span>Show wishlist</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowFollowers}
              onChange={(e) => setAllowFollowers(e.target.checked)}
              className="h-4 w-4 rounded border-[#D1D5DB]"
            />
            <span>Allow followers</span>
          </label>

          {status && (
            <div
              className={`text-xs rounded-lg px-3 py-2 border ${
                status.startsWith("Error:")
                  ? "text-red-700 bg-red-50 border-red-200"
                  : "text-[#065F46] bg-emerald-50 border-emerald-100"
              }`}
            >
              {status}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Privacy"}
          </button>
        </form>
      </div>
    </section>
  );
}
