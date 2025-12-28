// app/settings/tabs/ProfileTab.tsx
"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserShape = {
  userId: string;
  email?: string | null;
  roleLabel?: string | null;
  username: string;
  firstName: string;
  lastName: string;
};

export default function ProfileTab({ user }: { user: UserShape }) {
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [username, setUsername] = useState(user.username);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);

  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setStatus(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("phone,bio,residential_address,shipping_address")
        .eq("id", user.userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Profile load error:", error);
        setStatus("Error: Could not load profile details.");
      } else {
        setPhone(data?.phone ?? "");
        setBio(data?.bio ?? "");
        setResidentialAddress(data?.residential_address ?? "");
        setShippingAddress(data?.shipping_address ?? "");
      }

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user.userId]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        username,
        first_name: firstName,
        last_name: lastName,
        phone,
        bio,
        residential_address: residentialAddress,
        shipping_address: shippingAddress,
      })
      .eq("id", user.userId);

    if (error) {
      console.error("Profile save error:", error);
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus("Profile updated.");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="mt-10 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
        Loading profile…
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-[#111827] dark:text-white mb-4">
        Basic Information
      </h2>

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              Email
            </label>
            <input
              type="email"
              value={user.email ?? ""}
              disabled
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-gray-50 dark:bg-[#020617] px-3 py-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              Role
            </label>
            <input
              type="text"
              value={user.roleLabel ?? ""}
              disabled
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-gray-50 dark:bg-[#020617] px-3 py-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
            Residential Address
          </label>
          <textarea
            value={residentialAddress}
            onChange={(e) => setResidentialAddress(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
            Default Shipping Address
          </label>
          <textarea
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

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
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </section>
  );
}
