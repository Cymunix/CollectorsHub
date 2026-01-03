// app/catalog/page.tsx
"use client";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import CatalogScreen from "@/components/catalog/CatalogScreen";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function CatalogPage() {
  const sp = useSearchParams();

  const filters = useMemo(() => {
    return {
      franchiseId: sp.get("franchise"),
      setId: sp.get("set"),
      publisher: sp.get("publisher"),
      upc: sp.get("upc"),
      q: sp.get("q") ?? "",
    };
  }, [sp]);

  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A]">
      <Header />
      <SecondaryNav />
      <CatalogScreen urlFilters={filters} />
    </main>
  );
}
