"use client";

import Header from "@/components/Header";
import SecondaryNav from "@/components/SecondaryNav";
import AuthModal from "@/components/AuthModal";
import CollectionScreen from "./_components/CollectionScreen";

export default function CollectionPage() {
  return (
    <>
      <Header />
      <SecondaryNav />
      <AuthModal />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <CollectionScreen />
      </main>
    </>
  );
}
