"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { QuickAddDefault } from "@/lib/catalog/types";

export function useQuickAddPreference() {
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState<QuickAddDefault>("collection");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id ?? null;

        if (!userId) {
          if (!cancelled) {
            setValue("collection");
            setLoading(false);
          }
          return;
        }

        // This column may not exist yet. If it doesn't, we just fall back.
        const res = await supabase
          .from("profiles")
          .select("quick_add_default")
          .eq("id", userId)
          .maybeSingle();

        if (cancelled) return;

        const vRaw = (res.data as any)?.quick_add_default;
        const v = String(vRaw ?? "").trim();

        if (v === "wishlist" || v === "collection" || v === "both" || v === "ask") {
          setValue(v);
        } else {
          setValue("collection");
        }

        setLoading(false);
      } catch {
        if (!cancelled) {
          setValue("collection");
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, value };
}
