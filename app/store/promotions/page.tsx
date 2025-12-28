"use client";

import { useParams } from "next/navigation";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";

export default function StorePromotionsPage() {
  const params = useParams();
  const storeUserId = String((params as any)?.storeUserId ?? "");

  return (
    <>
      <Header />
      <SecondaryNav />

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-10">
        {/* Page Header */}
        <header>
          <h1 className="text-2xl font-semibold">Sales & Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            Promotions and events hosted by this store.
          </p>
        </header>

        {/* Sales Placeholder */}
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Sales & Flyers</h2>
            <span className="text-xs text-gray-400">Coming soon</span>
          </div>

          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
            Stores will be able to post weekly flyers, discounts, and special
            promotions here.
            <br />
            <br />
            This section is currently a placeholder.
          </div>
        </section>

        {/* Events Placeholder */}
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Events</h2>
            <span className="text-xs text-gray-400">Coming soon</span>
          </div>

          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
            Stores will be able to advertise events such as:
            <ul className="mt-3 space-y-1 text-left inline-block">
              <li>• Game nights (Magic, Warhammer, Pokémon)</li>
              <li>• Flea markets & swap meets</li>
              <li>• Card shows & conventions</li>
              <li>• In-store launches & promos</li>
            </ul>

            <div className="mt-4">
              This section is currently a placeholder.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
