// app/catalog/[id]/tabs/item_variants.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CatalogItemVariantRow = {
  id: string;
  name: string;
  upc: string | null;
  variant_name: string | null;
  variant_rank: number | null;
  variant_group_id: string | null;
  base_catalog_item_id: string | null;
};

export default function ItemVariantsTab({ catalogItemId }: { catalogItemId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [groupId, setGroupId] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItemVariantRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);
      setItems([]);
      setGroupId(null);

      // 1) Load current item (we need it regardless)
      const baseRes = await supabase
        .from("catalog_items")
        .select("id, name, upc, variant_name, variant_rank, variant_group_id, base_catalog_item_id")
        .eq("id", catalogItemId)
        .single();

      if (cancelled) return;

      if (baseRes.error) {
        setErr(baseRes.error.message || "Failed to load item.");
        setLoading(false);
        return;
      }

      const base = baseRes.data as any;

      // 2) Determine variant group id:
      //    - prefer the item's own variant_group_id
      //    - otherwise, try to derive from children where base_catalog_item_id = this id
      let vg: string | null = base?.variant_group_id ? String(base.variant_group_id) : null;

      if (!vg) {
        const childGroupRes = await supabase
          .from("catalog_items")
          .select("variant_group_id")
          .eq("base_catalog_item_id", catalogItemId)
          .not("variant_group_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (!childGroupRes.error) {
          vg = (childGroupRes.data as any)?.variant_group_id ? String((childGroupRes.data as any).variant_group_id) : null;
        }
      }

      setGroupId(vg);

      // If still no group id, then there truly are no linked variants
      if (!vg) {
        setItems([
          {
            id: String(base.id),
            name: String(base.name ?? "Item"),
            upc: base.upc ?? null,
            variant_name: base.variant_name ?? null,
            variant_rank: typeof base.variant_rank === "number" ? base.variant_rank : null,
            variant_group_id: base.variant_group_id ? String(base.variant_group_id) : null,
            base_catalog_item_id: base.base_catalog_item_id ? String(base.base_catalog_item_id) : null,
          },
        ]);
        setLoading(false);
        return;
      }

      // 3) Load all items in the group *OR* the current item id (in case the base has no group id stored)
      const itemsRes = await supabase
        .from("catalog_items")
        .select("id,name,upc,variant_name,variant_rank,variant_group_id,base_catalog_item_id")
        .or(`variant_group_id.eq.${vg},id.eq.${catalogItemId}`)
        .order("variant_rank", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true });

      if (cancelled) return;

      if (itemsRes.error) {
        setErr(itemsRes.error.message || "Failed to load variants.");
        setItems([]);
        setLoading(false);
        return;
      }

      const rows = (itemsRes.data ?? []) as any[];

      const normalized: CatalogItemVariantRow[] = rows.map((r) => ({
        id: String(r.id),
        name: String(r.name ?? "Variant"),
        upc: r.upc ?? null,
        variant_name: r.variant_name ?? null,
        variant_rank: typeof r.variant_rank === "number" ? r.variant_rank : null,
        variant_group_id: r.variant_group_id ? String(r.variant_group_id) : null,
        base_catalog_item_id: r.base_catalog_item_id ? String(r.base_catalog_item_id) : null,
      }));

      // Keep the current item first (nice UX), then others
      const current = normalized.find((x) => x.id === catalogItemId);
      const others = normalized.filter((x) => x.id !== catalogItemId);

      setItems(current ? [current, ...others] : normalized);
      setLoading(false);
    };

    if (catalogItemId) load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const rows = useMemo(() => items, [items]);

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
          groupId ? (
            rows.length ? (
              <div className="space-y-2">
                {rows.map((r) => {
                  const isCurrent = r.id === catalogItemId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => !isCurrent && router.push(`/catalog/${r.id}`)}
                      className={[
                        "w-full text-left rounded-xl border transition px-3 py-3",
                        isCurrent
                          ? "border-[#CBD5E1] bg-[#F8FAFC] cursor-default"
                          : "border-[#E5E9F2] bg-white hover:bg-[#F8FAFC]",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0F172A] truncate">
                            {r.name}
                            {isCurrent ? " (This item)" : ""}
                          </div>
                          <div className="mt-1 text-[11px] text-[#64748B]">
                            {r.variant_name ? r.variant_name : "variant"}
                            {typeof r.variant_rank === "number" ? ` • Rank: ${r.variant_rank}` : ""}
                            {r.upc ? ` • UPC: ${r.upc}` : ""}
                          </div>
                        </div>
                        {!isCurrent ? <div className="text-xs text-[#2563EB] shrink-0">Open →</div> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-[#64748B]">No variants in this group yet.</div>
            )
          ) : (
            <div className="text-sm text-[#64748B]">No variants linked yet.</div>
          )
        ) : null}
      </div>
    </div>
  );
}
