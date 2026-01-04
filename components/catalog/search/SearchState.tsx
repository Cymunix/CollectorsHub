// components/catalog/search/SearchState.tsx
"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import type { Focus } from "@/lib/catalog/focus";

type SearchState = {
  query: string;
  setQuery: (s: string) => void;
  filters: Record<string, any>;
  setFilters: (f: Record<string, any>) => void;
  focus: Focus;
  setFocus: (f: Focus) => void;
};

const Ctx = createContext<SearchState | null>(null);

export function SearchStateProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [focus, setFocus] = useState<Focus>({ type: "none" });

  const value = useMemo(() => ({ query, setQuery, filters, setFilters, focus, setFocus }), [query, filters, focus]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearchState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSearchState must be used within SearchStateProvider");
  return v;
}
