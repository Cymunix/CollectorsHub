// app/sales/page.tsx
"use client";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";

export default function SalesPage() {
  return (
    <>
      <Header />
      <SecondaryNav />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">Sales</h1>
              <p className="mt-1 text-sm text-gray-600">
                Store flyers and promotions will appear here.
              </p>
            </div>

            <span className="inline-flex items-center rounded-full border bg-gray-50 px-3 py-1 text-xs text-gray-700">
              Coming soon
            </span>
          </div>

          <div className="mt-5 rounded-xl border bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              This page will showcase active sales, weekly flyers, and special promotions
              from stores on the platform.
            </p>

            <ul className="mt-3 list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Image-based flyers</li>
              <li>Date-based sales visibility</li>
              <li>Tap to view full flyer</li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
