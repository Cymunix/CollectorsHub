// app/page.tsx
import React from "react";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import TrendingItemsSection from "./trending-items-section";

export default function Home() {
  return (
    <main
      className="
        min-h-screen w-full bg-[#F4F7FD] text-[#0F172A]
        dark:bg-[#020617] dark:text-[#E5E7EB]
      "
    >
      <Header />
      <SecondaryNav />

      {/* ---------------------- TITLE ---------------------- */}
      <div className="text-center mt-6 mb-8 px-6">
        <h1 className="text-4xl font-semibold tracking-tight text-[#0F172A] dark:text-[#E5E7EB]">
          CollectorsHub
        </h1>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
          Track, Value, and Trade Your Collectibles
        </p>
      </div>

      {/* ---------------------- MAIN SECTIONS ---------------------- */}
      <div className="px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 w-full">
          <Section title="Events Near You" columns={3} />
          <TrendingItemsSection columns={4} />
          <Section title="Sales Near You" columns={3} />
        </div>
      </div>
    </main>
  );
}

function Section({ title, columns }: { title: string; columns: number }) {
  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
          {title}
        </h2>
        <button className="text-xs text-[#2563EB] hover:underline">View all</button>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns * 2 }).map((_, i) => (
          <PlaceholderCard key={i} />
        ))}
      </div>
    </section>
  );
}

function PlaceholderCard() {
  return (
    <div
      className="
        aspect-[3/4] rounded-xl bg-white dark:bg-[#111827]
        shadow-sm border border-[#E5E9F2] dark:border-[#1F2937]
      "
    />
  );
}
