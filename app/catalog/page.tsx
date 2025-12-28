"use client";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import CatalogScreen from "@/components/catalog/CatalogScreen";

export default function CatalogPage() {
  return (
    <main className="min-h-screen w-full bg-[#F4F7FD] text-[#0F172A]">
      <Header />
      <SecondaryNav />
      <CatalogScreen />
    </main>
  );
}
