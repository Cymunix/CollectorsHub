// app/wishlist/page.tsx
"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";
import WishlistScreen from "./_components/WishlistScreen";

export default function WishlistPage() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <Header />
      <SecondaryNav />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <WishlistScreen onRequireAuth={() => setAuthOpen(true)} />
      </main>
    </>
  );
}
