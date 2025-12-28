// components/Header.tsx
"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthModal from "./AuthModal";
import { useUserProfile } from "@/lib/useUserProfile";
import { useLanguage } from "@/lib/i18n";

export default function Header() {
  const { user, loading } = useUserProfile();
  const { lang, setLang, t } = useLanguage();

  const [showAuth, setShowAuth] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.refresh();
  };

  // Header search submit: send to catalog
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    // open=1 tells Catalog page to auto-open if exactly one match
    router.push(`/catalog?search=${encodeURIComponent(q)}&open=1`);
  };

  // Display Name
  const displayName = user?.username || user?.email || "Collector";

  // Initials
  const initials = (() => {
    if (user?.firstName || user?.lastName) {
      const f = user.firstName?.[0] ?? "";
      const l = user.lastName?.[0] ?? "";
      const combo = `${f}${l}`.trim();
      if (combo) return combo.toUpperCase();
    }
    if (displayName) return displayName[0]?.toUpperCase() ?? "U";
    return "U";
  })();

  // Address in the green pill: from profile if logged in, fallback if logged out
  const locationLabel = user
    ? user.addressLabel || t("header.location_default")
    : t("header.location_default");

  const goTo = (path: string) => {
    setMenuOpen(false);
    router.push(path);
  };

  const handleSelectLang = (code: "en" | "fr") => {
    setLang(code);
    setLangMenuOpen(false);
  };

  return (
    <>
      <header className="w-full bg-[#0B1120] text-white">
        <div className="flex items-center px-6 py-3">
          {/* CLICKABLE LOGO */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 hover:opacity-80 transition cursor-pointer"
          >
            <span className="text-lg font-extrabold tracking-tight text-[#3B82F6]">
              CH
            </span>
            <span className="text-lg font-semibold tracking-tight">
              CollectorsHub
            </span>
          </Link>

          {/* CENTER: Location + Search */}
          <div className="flex flex-1 items-center justify-center gap-3 px-6">
            {/* Location pill uses mailing/shipping address from profile */}
            <button className="hidden md:inline-flex items-center rounded-full bg-[#16A34A] px-4 py-1.5 text-xs font-semibold text-white shadow-sm max-w-xs truncate">
              {locationLabel} ⟳
            </button>

            <form
              className="relative w-full max-w-xl"
              onSubmit={handleSearchSubmit}
            >
              <span className="absolute inset-y-0 left-3 flex items-center text-sm text-[#9CA3AF]">
                🔍
              </span>
              <input
                className="w-full rounded-full bg-white px-10 py-2 text-sm text-[#0F172A] shadow-sm outline-none placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#3B82F6]"
                placeholder={t("header.search_placeholder")}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </form>
          </div>

          {/* RIGHT SECTION */}
          <div className="flex items-center gap-4 shrink-0 text-xs">
            {/* LANGUAGE DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-[#E5E7EB] hover:text-white"
              >
                🌐 {lang.toUpperCase()} ▾
              </button>
              {langMenuOpen && (
                <div className="absolute right-0 mt-2 w-32 rounded-lg bg-white py-1 shadow-lg border border-[#E5E9F2] text-[12px] text-[#111827] z-20">
                  <button
                    onClick={() => handleSelectLang("en")}
                    className={`block w-full px-3 py-1 text-left hover:bg-[#F3F4F6] ${
                      lang === "en" ? "font-semibold" : ""
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => handleSelectLang("fr")}
                    className={`block w-full px-3 py-1 text-left hover:bg-[#F3F4F6] ${
                      lang === "fr" ? "font-semibold" : ""
                    }`}
                  >
                    Français
                  </button>
                </div>
              )}
            </div>

            {/* USER AUTH */}
            {!loading && (
              <>
                {user ? (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen((o) => !o)}
                      className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-white/10"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4F46E5] text-xs font-bold">
                        {initials}
                      </div>
                      <div className="hidden md:block leading-tight text-[11px] text-left">
                        <div className="font-semibold text-white truncate max-w-[140px]">
                          {displayName}
                        </div>
                        <div className="text-[#9CA3AF]">{user.roleLabel}</div>
                      </div>
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white py-2 shadow-lg border border-[#E5E9F2] text-[13px] text-[#111827]">
                        <button
                          onClick={() => goTo("/settings")}
                          className="block w-full px-4 py-2 text-left hover:bg-[#F3F4F6]"
                        >
                          Settings
                        </button>
                        <button
                          onClick={() => goTo("/history/purchases")}
                          className="block w-full px-4 py-2 text-left hover:bg-[#F3F4F6]"
                        >
                          Purchase History
                        </button>
                        <button
                          onClick={() => goTo("/history/sales")}
                          className="block w-full px-4 py-2 text-left hover:bg-[#F3F4F6]"
                        >
                          Sales History
                        </button>
                        <div className="my-1 h-px bg-[#E5E7EB]" />
                        <button
                          onClick={handleLogout}
                          className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAuth(true)}
                    className="rounded-full bg-[#3B82F6] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2563EB]"
                  >
                    {t("header.login_button")}
                  </button>
                )}

                {/* Cart (links to /cart) */}
                <button
                  type="button"
                  onClick={() => router.push("/cart")}
                  className="hidden md:inline-flex items-center gap-2 text-[#E5E7EB] hover:text-white"
                >
                  <span>🛒 {t("header.cart")}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* AUTH MODAL */}
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}
