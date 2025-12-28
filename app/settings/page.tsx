// app/settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import { useUserProfile } from "@/lib/useUserProfile";
import { useLanguage } from "@/lib/i18n";

import SettingsTabs, { TabKey } from "./tabs/SettingsTabs";
import ProfileTab from "./tabs/ProfileTab";
import SecurityTab from "./tabs/SecurityTab";
import PreferencesTab from "./tabs/PreferencesTab";
import PrivacyTab from "./tabs/PrivacyTab";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useUserProfile();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A] dark:bg-[#020617] dark:text-[#E5E7EB]">
      <Header />
      <SecondaryNav />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-[#0F172A] dark:text-white mb-1">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-6">
          {t("settings.subtitle")}
        </p>

        <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />

        {loading || !user ? (
          <div className="mt-10 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Loading settings…
          </div>
        ) : (
          <>
            {activeTab === "profile" && (
              <ProfileTab
                user={{
                  userId: user.userId,
                  email: user.email,
                  roleLabel: user.roleLabel,
                  username: user.username ?? "",
                  firstName: user.firstName ?? "",
                  lastName: user.lastName ?? "",
                }}
              />
            )}

            {activeTab === "security" && (
              <SecurityTab user={{ email: user.email ?? "" }} />
            )}

            {activeTab === "preferences" && (
              <PreferencesTab user={{ userId: user.userId }} />
            )}

            {activeTab === "privacy" && (
              <PrivacyTab user={{ userId: user.userId }} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
