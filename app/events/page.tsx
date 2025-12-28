// app/events/page.tsx
"use client";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";

export default function EventsPage() {
  return (
    <>
      <Header />
      <SecondaryNav />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">Events</h1>
              <p className="mt-1 text-sm text-gray-600">
                Game nights, flea markets, conventions, and store-hosted events will appear here.
              </p>
            </div>

            <span className="inline-flex items-center rounded-full border bg-gray-50 px-3 py-1 text-xs text-gray-700">
              Coming soon
            </span>
          </div>

          <div className="mt-5 rounded-xl border bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              This page will let stores and organizers post upcoming events like:
            </p>

            <ul className="mt-3 list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Magic: The Gathering / Warhammer / tabletop nights</li>
              <li>Flea markets and vendor pop-ups</li>
              <li>Card shows and collectible conventions</li>
              <li>LEGO events and fan conventions</li>
            </ul>

            <div className="mt-4 rounded-xl border bg-white p-4">
              <p className="text-sm font-medium text-gray-900">Planned MVP features</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>Event card feed with date + location</li>
                <li>Filter by category (Cards, LEGO, TCG, Tabletop, etc.)</li>
                <li>Tap to view event details</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
