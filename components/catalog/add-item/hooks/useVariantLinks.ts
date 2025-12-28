// components/catalog/add-item/hooks/useVariantLinks.ts
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CatalogSearchRow = {
  id: string;
  name: string;
  upc: string | null;
  release_year: number | null;
};

type VariantDraft = {
  target_id: string;
  target_name: string;
  link_type: string;
  label: string;
};

const LINK_TYPES = ["variant", "recolor", "reprint", "edition", "related"] as const;

export function useVariantLinks() {
  const [variantQuery, setVariantQuery] = useState("");
  const [variantSearching, setVariantSearching] = useState(false);
  const [variantResults, setVariantResults] = useState<CatalogSearchRow[]>([]);
  const [linkedVariants, setLinkedVariants] = useState<VariantDraft[]>([]);
  const [variantDefaultType, setVariantDefaultType] = useState<string>(LINK_TYPES[0] ?? "variant");
  const [variantDefaultLabel, setVariantDefaultLabel] = useState("");

  const addVariant = (row: CatalogSearchRow) => {
    setLinkedVariants((prev) => {
      if (prev.some((v) => v.target_id === row.id)) return prev;
      return [
        ...prev,
        {
          target_id: row.id,
          target_name: row.name,
          link_type: variantDefaultType || "variant",
          label: (variantDefaultLabel || "").trim(),
        },
      ];
    });
  };

  const removeVariant = (id: string) => setLinkedVariants((prev) => prev.filter((v) => v.target_id !== id));

  const updateVariant = (id: string, patch: Partial<VariantDraft>) =>
    setLinkedVariants((prev) => prev.map((v) => (v.target_id === id ? { ...v, ...patch } : v)));

  const searchVariants = async () => {
    const q = (variantQuery || "").trim();
    if (!q) return setVariantResults([]);

    setVariantSearching(true);
    try {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("id,name,upc,release_year")
        .or(`name.ilike.%${q}%,upc.ilike.%${q}%`)
        .order("name", { ascending: true })
        .limit(25);

      if (error) throw error;
      setVariantResults((data ?? []) as CatalogSearchRow[]);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Variant search failed.");
      setVariantResults([]);
    } finally {
      setVariantSearching(false);
    }
  };

  const resetVariants = () => {
    setVariantQuery("");
    setVariantResults([]);
    setLinkedVariants([]);
    setVariantDefaultType(LINK_TYPES[0] ?? "variant");
    setVariantDefaultLabel("");
    setVariantSearching(false);
  };

  return {
    // constants
    LINK_TYPES,

    // query/results
    variantQuery,
    setVariantQuery,
    variantSearching,
    variantResults,

    // defaults
    variantDefaultType,
    setVariantDefaultType,
    variantDefaultLabel,
    setVariantDefaultLabel,

    // linked
    linkedVariants,
    addVariant,
    removeVariant,
    updateVariant,

    // actions
    searchVariants,
    resetVariants,
  };
}
