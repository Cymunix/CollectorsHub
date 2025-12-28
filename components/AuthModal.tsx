// components/AuthModal.tsx
"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        if (password !== confirm) {
          throw new Error("Passwords do not match.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        const user = data.user;
        if (!user) throw new Error("Signup succeeded, but no user returned.");

        // create profiles row with default role "collector"
        const { error: profileError } = await supabase.from("profiles").insert([
          {
            id: user.id,
            username,
            role: "collector",
          },
        ]);

        if (profileError) throw profileError;
      }

      onClose();
      setEmail("");
      setPassword("");
      setConfirm("");
      setUsername("");
    } catch (err: any) {
      const msg = err?.message ?? "Something went wrong.";
      if (
        msg.toLowerCase().includes("already registered") ||
        msg.toLowerCase().includes("already exists")
      ) {
        setErrorMsg("This email is already registered. Try logging in instead.");
        setMode("login");
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "login" ? "Welcome Back" : "Create an Account";
  const description =
    mode === "login"
      ? "Log in to access your collection."
      : "Sign up to start tracking your collectibles.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#0F172A]">
              {title}
            </h2>
            <p className="text-sm text-[#6B7280]">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#111827]"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex rounded-full bg-[#F3F4F6] p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-full py-2 ${
              mode === "login"
                ? "bg-[#2563EB] text-white font-semibold"
                : "text-[#4B5563]"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-full py-2 ${
              mode === "signup"
                ? "bg-[#2563EB] text-white font-semibold"
                : "text-[#4B5563]"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[#4B5563] mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          {/* Username (SIGNUP ONLY) */}
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="choose a username"
                className="w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-[#4B5563] mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          {/* Confirm password (SIGNUP ONLY) */}
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-full bg-[#2563EB] py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Signing up..."
              : mode === "login"
              ? "Log In"
              : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
