// app/settings/tabs/SecurityTab.tsx
"use client";

import React, { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserShape = { email: string };

function looksLikeRecentLoginError(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("recent login") ||
    m.includes("reauth") ||
    m.includes("requires") && m.includes("login") ||
    m.includes("auth") && m.includes("refresh")
  );
}

export default function SecurityTab({ user }: { user: UserShape }) {
  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  const handleUpdateEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailStatus(null);

    if (!newEmail || !confirmEmail) {
      setEmailStatus("Error: Please enter and confirm the new email.");
      return;
    }
    if (newEmail !== confirmEmail) {
      setEmailStatus("Error: New email and confirmation do not match.");
      return;
    }
    if (newEmail === user.email) {
      setEmailStatus("Error: New email must be different from the current email.");
      return;
    }

    setEmailSaving(true);

    const { error } = await supabase.auth.updateUser({ email: newEmail });

    if (error) {
      console.error("Email update error:", error);
      if (looksLikeRecentLoginError(error.message)) {
        setEmailStatus(
          "Error: For security, please sign out and sign back in, then try again."
        );
      } else {
        setEmailStatus(`Error: ${error.message}`);
      }
      setEmailSaving(false);
      return;
    }

    setEmailStatus("Email update requested. Check your inbox if confirmation is required.");
    setNewEmail("");
    setConfirmEmail("");
    setEmailSaving(false);
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!newPassword || !confirmPassword) {
      setPasswordStatus("Error: Please enter and confirm the new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus("Error: New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus("Error: New password should be at least 6 characters.");
      return;
    }

    setPasswordSaving(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      console.error("Password update error:", error);
      if (looksLikeRecentLoginError(error.message)) {
        setPasswordStatus(
          "Error: For security, please sign out and sign back in, then try again."
        );
      } else {
        setPasswordStatus(`Error: ${error.message}`);
      }
      setPasswordSaving(false);
      return;
    }

    setPasswordStatus("Password updated successfully.");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaving(false);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white dark:bg-[#020617] border border-[#E5E9F2] dark:border-[#1F2937] p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-2">
          Change Email
        </h2>
        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">
          Update the email associated with your account.
        </p>

        <form onSubmit={handleUpdateEmail} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              Current Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-gray-50 dark:bg-[#020617] px-3 py-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              New Email
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              Confirm New Email
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          {emailStatus && (
            <div
              className={`text-xs rounded-lg px-3 py-2 border ${
                emailStatus.startsWith("Error:")
                  ? "text-red-700 bg-red-50 border-red-200"
                  : "text-[#065F46] bg-emerald-50 border-emerald-100"
              }`}
            >
              {emailStatus}
            </div>
          )}

          <button
            type="submit"
            disabled={emailSaving}
            className="rounded-full bg-[#2563EB] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {emailSaving ? "Updating…" : "Update Email"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#020617] border border-[#E5E9F2] dark:border-[#1F2937] p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-2">
          Change Password
        </h2>

        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B5563] dark:text-[#D1D5DB] mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-[#E5E9F2] dark:border-[#1F2937] bg-white dark:bg-[#020617] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          {passwordStatus && (
            <div
              className={`text-xs rounded-lg px-3 py-2 border ${
                passwordStatus.startsWith("Error:")
                  ? "text-red-700 bg-red-50 border-red-200"
                  : "text-[#065F46] bg-emerald-50 border-emerald-100"
              }`}
            >
              {passwordStatus}
            </div>
          )}

          <button
            type="submit"
            disabled={passwordSaving}
            className="rounded-full bg-[#2563EB] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {passwordSaving ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </section>
  );
}
