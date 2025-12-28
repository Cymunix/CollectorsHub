// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "CollectorsHub",
  description:
    "CollectorsHub - manage your collection, showcase your grails, and connect with other collectors.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F4F7FD] text-[#0F172A] dark:bg-[#020617] dark:text-[#E5E7EB]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
