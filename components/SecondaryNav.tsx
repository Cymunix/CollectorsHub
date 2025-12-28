// components/SecondaryNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo } from "react";
import { useUserProfile } from "@/lib/useUserProfile";

type Tab = { name: string; href: string };

const collectorTabs: Tab[] = [
  { name: "My Collection", href: "/collection" },
  { name: "Catalog", href: "/catalog" },
  { name: "Stores", href: "/stores" },
  { name: "Wishlist", href: "/wishlist" },
  { name: "Sales", href: "/sales" },
  { name: "Events", href: "/events" },
];

// 🔧 Set this to your real inventory route
const STORE_INVENTORY_HREF = "/store/tab/inventory"; // or "/store/inventory"

const storeTabs: Tab[] = [
  { name: "Inventory", href: STORE_INVENTORY_HREF },
  { name: "Catalog", href: "/catalog" },
  { name: "My Store", href: "/store/my-store" },
  { name: "Promotions", href: "/store/promotions" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SecondaryNav() {
  const pathname = usePathname();
  const { user, loading } = useUserProfile();

  const role = String(user?.roleRaw ?? "").trim().toLowerCase();
  const isStore = role === "store" || role === "pawn";

  // Don’t block UI while loading; just show collector nav until role is known
  const tabs = !loading && isStore ? storeTabs : collectorTabs;

  const debug = useMemo(() => {
    if (loading) return "role: loading…";
    if (!user) return "role: not logged in";
    return `role: ${user.roleRaw}`;
  }, [loading, user]);

  return (
    <nav className="w-full bg-transparent py-4 flex flex-col items-center gap-2">
      <div className="flex gap-2 sm:gap-4 flex-wrap justify-center">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 sm:px-6 py-2 rounded-xl text-sm font-medium transition
                ${active ? "bg-[#0B1120] text-white" : "bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]"}
              `}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>

      <div className="text-[11px] text-gray-500">{debug}</div>
    </nav>
  );
}
