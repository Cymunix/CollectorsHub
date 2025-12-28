// app/providers.tsx
"use client";

import React from "react";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </ThemeProvider>
  );
}

// Optional default export – makes it safe even if something imports default
export default AppProviders;
