// app/catalog/[id]/tabs/item_variants.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VariantLinkRow = {
  variant_catalog_item_id: string;
  link_type: string | null;
  label: string | null;
  sort_order: number | null;
};

type CatalogItemLite = {
  id: string;
  name: string;
  upc: string | null;
  version: string | null;
};

export default function ItemVariantsTab({ catalogItemId }: { catalogItemId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [links, setLinks] = useState<VariantLinkRow[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, CatalogItemLite>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);

      const linksRes = await supabase
        .from("catalog_item_variant_links")
        .select("variant_catalog_item_id,link_type,label,sort_order")
        .eq("catalog_item_id", catalogItemId)
        .order("sort_order", { ascending: true });

      if (cancelled) return;

      if (linksRes.error) {
        setErr(linksRes.error.message || "Failed to load variants.");
        setLinks([]);
        setItemsById({});
        setLoading(false);
        return;
      }

      const rows = (linksRes.data ?? []) as any[];
      const parsed: VariantLinkRow[] = rows.map((r) => ({
        variant_catalog_item_id: String(r.variant_catalog_item_id),
        link_type: r.link_type ?? null,
        label: r.label ?? null,
        sort_order: typeof r.sort_order === "number" ? r.sort_order : null,
      }));

      setLinks(parsed);

      const ids = parsed.map((r) => r.variant_catalog_item_id).filter(Boolean);
      if (!ids.length) {
        setItemsById({});
        setLoading(false);
        return;
      }

      const itemsRes = await supabase
        .from("catalog_items")
        .select("id,name,upc,version")
        .in("id", ids);

      if (cancelled) return;

      if (itemsRes.error) {
        setErr(itemsRes.error.message || "Failed to load variant items.");
        setItemsById({});
        setLoading(false);
        return;
      }

      const map: Record<string, CatalogItemLite> = {};
      for (const it of itemsRes.data ?? []) {
        const id = String((it as any).id);
        map[id] = {
          id,
          name: String((it as any).name ?? "Variant"),
          upc: (it as any).upc ?? null,
          version: (it as any).version ?? null,
        };
      }

      setItemsById(map);
      setLoading(false);
    };

    if (catalogItemId) load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const rows = useMemo(() => {
    return links.map((l) => {
      const it = itemsById[l.variant_catalog_item_id];
      return {
        ...l,
        itemName: it?.name ?? "Unknown item",
        upc: it?.upc ?? null,
        version: it?.version ?? null,
      };
    });
  }, [links, itemsById]);

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Variants</div>
        <div className="text-[11px] text-[#64748B]">{rows.length ? `${rows.length}` : ""}</div>
      </div>

      <div className="p-4">
        {loading ? <div className="text-sm text-[#64748B]">Loading…</div> : null}
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {!loading && !err ? (
          rows.length ? (
            <div className="space-y-2">
              {rows.map((r, idx) => (
                <button
                  key={`${r.variant_catalog_item_id}-${idx}`}
                  type="button"
                  onClick={() => router.push(`/catalog/${r.variant_catalog_item_id}`)}
                  className="w-full text-left rounded-xl border border-[#E5E9F2] bg-white hover:bg-[#F8FAFC] transition px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#0F172A] truncate">{r.itemName}</div>
                      <div className="mt-1 text-[11px] text-[#64748B]">
                        {r.link_type ? r.link_type : "variant"}
                        {r.label ? ` • ${r.label}` : ""}
                        {r.version ? ` • ${r.version}` : ""}
                        {r.upc ? ` • UPC: ${r.upc}` : ""}
                      </div>
                    </div>
                    <div className="text-xs text-[#2563EB] shrink-0">Open →</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[#64748B]">No variants linked yet.</div>
          )
        ) : null}
      </div>
    </div>
  );
}
