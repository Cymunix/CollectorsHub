"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type CatalogThemeSummary = {
  theme: {
    id: string;
    name: string;
    years: { min: number | null; max: number | null };
    counts: { subthemes: number; sets: number; minifigs: number };
    availability: { available: number; retired: number; pending: number };
  };
  pricing: {
    retail_total_cad: number | null;
    new_total_cad: number | null;
    used_total_cad: number | null;
    growth_pct: number | null;
    annual_growth_pct: number | null;
  };
  myCollection: {
    owned: number;
    paid_total_cad: number | null;
    value_total_cad: number | null;
    growth_pct: number | null;
  };
  subthemes: Array<{ id: string; name: string; sets: number; annual_growth_pct: number | null }>;
  yearly: Array<{ year: number; sets: number; retail_total_cad: number | null; value_total_cad: number | null }>;
};

export function useCatalogThemeSummary(activeFranchiseId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CatalogThemeSummary | null>(null);

  const load = async (franchiseId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("get_franchise_summary_v2", {
        p_franchise_id: franchiseId,
      });
      if (error) throw error;

      setSummary((data as any) ?? null);
    } catch (e: any) {
      setSummary(null);
      setError(e?.message ?? "Failed to load summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeFranchiseId) {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }
    load(activeFranchiseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFranchiseId]);

  return { loading, error, summary, reload: () => activeFranchiseId && load(activeFranchiseId) };
}
