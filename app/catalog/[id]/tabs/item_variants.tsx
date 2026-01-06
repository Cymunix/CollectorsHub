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

type BaseItemLite = {
  id: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  franchise_id: string | null;
  upc: string | null;
  release_year: number | null;
  version: string | null;
  variant_group_id: string | null;
};

export default function ItemVariantsTab({
  catalogItemId,
  isAdmin,
}: {
  catalogItemId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [baseItem, setBaseItem] = useState<BaseItemLite | null>(null);

  const [groupId, setGroupId] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItemVariantRow[]>([]);

  // Admin form state
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  const [linkExistingId, setLinkExistingId] = useState("");
  const [linkVariantName, setLinkVariantName] = useState("");
  const [linkVariantRank, setLinkVariantRank] = useState<string>("");

  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantRank, setNewVariantRank] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setErr(null);
    setItems([]);
    setGroupId(null);
    setBaseItem(null);

    // 1) Load base item
    const baseRes = await supabase
      .from("catalog_items")
      .select("id,name,category_id,subcategory_id,franchise_id,upc,release_year,version,variant_group_id")
      .eq("id", catalogItemId)
      .single();

    if (baseRes.error) {
      setErr(baseRes.error.message || "Failed to load item.");
      setLoading(false);
      return;
    }

    const base = baseRes.data as any;
    const baseLite: BaseItemLite = {
      id: String(base.id),
      name: String(base.name ?? "Item"),
      category_id: base.category_id ?? null,
      subcategory_id: base.subcategory_id ?? null,
      franchise_id: base.franchise_id ?? null,
      upc: base.upc ?? null,
      release_year: base.release_year ?? null,
      version: base.version ?? null,
      variant_group_id: base.variant_group_id ? String(base.variant_group_id) : null,
    };
    setBaseItem(baseLite);

    // 2) Determine group id
    let vg: string | null = baseLite.variant_group_id;

    if (!vg) {
      const childGroupRes = await supabase
        .from("catalog_items")
        .select("variant_group_id")
        .eq("base_catalog_item_id", catalogItemId)
        .not("variant_group_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (!childGroupRes.error) {
        vg = (childGroupRes.data as any)?.variant_group_id
          ? String((childGroupRes.data as any).variant_group_id)
          : null;
      }
    }

    setGroupId(vg);

    if (!vg) {
      setItems([
        {
          id: baseLite.id,
          name: baseLite.name,
          upc: baseLite.upc,
          variant_name: null,
          variant_rank: null,
          variant_group_id: null,
          base_catalog_item_id: null,
        },
      ]);
      setLoading(false);
      return;
    }

    // 3) Load group items
    const itemsRes = await supabase
      .from("catalog_items")
      .select("id,name,upc,variant_name,variant_rank,variant_group_id,base_catalog_item_id")
      .or(`variant_group_id.eq.${vg},id.eq.${catalogItemId}`)
      .order("variant_rank", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true });

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

    const current = normalized.find((x) => x.id === catalogItemId);
    const others = normalized.filter((x) => x.id !== catalogItemId);
    setItems(current ? [current, ...others] : normalized);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!catalogItemId) return;
      await load();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [catalogItemId]);

  const rows = useMemo(() => items, [items]);

  /* =========================
     ADMIN HELPERS
     ========================= */

  const fetchItemGroup = async (itemId: string): Promise<string | null> => {
    const res = await supabase
      .from("catalog_items")
      .select("variant_group_id")
      .eq("id", itemId)
      .single();
    if (res.error) throw res.error;
    return res.data?.variant_group_id ? String(res.data.variant_group_id) : null;
  };

  const createVariantGroup = async (): Promise<string> => {
    const create = await supabase.from("variant_groups").insert([{}]).select("id").single();
    if (create.error) throw create.error;
    const vg = String((create.data as any)?.id ?? "");
    if (!vg) throw new Error("Failed to create variant group.");
    return vg;
  };

  const assignItemToGroup = async (args: {
    itemId: string;
    groupId: string;
    baseId: string;
    makeBase?: boolean;
    variantName?: string | null;
    variantRank?: number | null;
  }) => {
    const payload: any = {
      variant_group_id: args.groupId,
      base_catalog_item_id: args.makeBase ? null : args.baseId,
    };
    if (args.variantName !== undefined) payload.variant_name = args.variantName;
    if (args.variantRank !== undefined) payload.variant_rank = args.variantRank;

    const up = await supabase.from("catalog_items").update(payload).eq("id", args.itemId);
    if (up.error) throw up.error;
  };

  const mergeGroups = async (fromGroupId: string, intoGroupId: string, baseId: string) => {
    const res = await supabase.from("catalog_items").select("id").eq("variant_group_id", fromGroupId);
    if (res.error) throw res.error;
    const ids = (res.data ?? []).map((r: any) => String(r.id)).filter(Boolean);

    for (const id of ids) {
      const isBase = id === baseId;
      const up = await supabase
        .from("catalog_items")
        .update({
          variant_group_id: intoGroupId,
          base_catalog_item_id: isBase ? null : baseId,
        })
        .eq("id", id);
      if (up.error) throw up.error;
    }

    // CLEANUP: Delete the empty old group
    await supabase.from("variant_groups").delete().eq("id", fromGroupId);
  };

  const ensureGroup = async (): Promise<string> => {
    if (groupId) return groupId;
    if (baseItem?.variant_group_id) {
      setGroupId(baseItem.variant_group_id);
      return baseItem.variant_group_id;
    }
    const vg = await createVariantGroup();
    await assignItemToGroup({
      itemId: catalogItemId,
      groupId: vg,
      baseId: catalogItemId,
      makeBase: true,
    });
    setGroupId(vg);
    return vg;
  };

  const onLinkExisting = async () => {
    const targetId = linkExistingId.trim();
    if (!targetId || targetId === catalogItemId) return;
    try {
      setAdminBusy(true);
      setAdminMsg(null);
      const baseGroupId = await ensureGroup();
      const targetGroupId = await fetchItemGroup(targetId);

      if (targetGroupId && targetGroupId !== baseGroupId) {
        await mergeGroups(targetGroupId, baseGroupId, catalogItemId);
      }

      const rk = linkVariantRank.trim();
      await assignItemToGroup({
        itemId: targetId,
        groupId: baseGroupId,
        baseId: catalogItemId,
        makeBase: false,
        variantName: linkVariantName.trim() || undefined,
        variantRank: rk !== "" ? Number(rk) : undefined,
      });

      setLinkExistingId("");
      setLinkVariantName("");
      setLinkVariantRank("");
      setAdminMsg("Item linked successfully.");
      await load();
    } catch (e: any) {
      setAdminMsg(e?.message ?? "Link failed.");
    } finally {
      setAdminBusy(false);
    }
  };

  const onCreateNewVariant = async () => {
    if (!baseItem || !newVariantName.trim()) return;
    try {
      setAdminBusy(true);
      const vg = await ensureGroup();
      const rk = newVariantRank.trim();
      const insertRes = await supabase
        .from("catalog_items")
        .insert([{
          name: baseItem.name,
          category_id: baseItem.category_id,
          subcategory_id: baseItem.subcategory_id,
          franchise_id: baseItem.franchise_id,
          release_year: baseItem.release_year,
          version: baseItem.version,
          variant_group_id: vg,
          base_catalog_item_id: catalogItemId,
          variant_name: newVariantName.trim(),
          variant_rank: rk !== "" ? Number(rk) : null,
        }])
        .select("id")
        .single();

      if (insertRes.error) throw insertRes.error;
      router.push(`/catalog/${insertRes.data.id}`);
    } catch (e: any) {
      setAdminMsg(e?.message ?? "Creation failed.");
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Variants</div>
        <div className="text-[11px] text-[#64748B]">{rows.length || ""}</div>
      </div>

      <div className="p-4 space-y-4">
        {loading && <div className="text-sm text-[#64748B]">Loading…</div>}
        {err && <div className="text-sm text-red-700">{err}</div>}

        {isAdmin && (
          <div className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">Admin Controls</div>
                <div className="text-[10px] text-[#64748B]">Group ID: {groupId || "None"}</div>
              </div>
              {!groupId && (
                <button
                  onClick={() => ensureGroup().then(() => load())}
                  className="rounded-full px-3 py-1.5 text-[10px] font-bold border bg-white hover:bg-slate-50"
                >
                  Initialize Group
                </button>
              )}
            </div>

            {adminMsg && <div className="text-xs font-medium text-blue-600">{adminMsg}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400">Link Existing Item</div>
                <input
                  value={linkExistingId}
                  onChange={(e) => setLinkExistingId(e.target.value)}
                  placeholder="Catalog Item ID"
                  className="w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm"
                />
                <input
                  value={linkVariantName}
                  onChange={(e) => setLinkVariantName(e.target.value)}
                  placeholder="Label (e.g. Steelbook)"
                  className="w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm"
                />
                <button
                  disabled={adminBusy}
                  onClick={onLinkExisting}
                  className="w-full rounded-lg bg-[#0F172A] py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Link to this Group
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400">Create New Variant</div>
                <input
                  value={newVariantName}
                  onChange={(e) => setNewVariantName(e.target.value)}
                  placeholder="New Variant Label"
                  className="w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm"
                />
                <input
                  value={newVariantRank}
                  onChange={(e) => setNewVariantRank(e.target.value)}
                  placeholder="Rank (Numeric)"
                  className="w-full rounded-lg border border-[#E5E9F2] px-3 py-2 text-sm"
                />
                <button
                  disabled={adminBusy}
                  onClick={onCreateNewVariant}
                  className="w-full rounded-lg bg-[#0F172A] py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Create & Open
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {rows.map((r) => {
            const isCurrent = r.id === catalogItemId;
            return (
              <button
                key={r.id}
                disabled={isCurrent}
                onClick={() => router.push(`/catalog/${r.id}`)}
                className={`w-full text-left rounded-xl border p-3 transition ${
                  isCurrent ? "bg-slate-50 border-slate-200" : "bg-white hover:border-blue-400"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{r.name} {isCurrent && "(Current)"}</div>
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">
                      {r.variant_name || "Standard Edition"} • Rank {r.variant_rank ?? "—"}
                    </div>
                  </div>
                  {!isCurrent && <span className="text-blue-600 text-[10px] font-bold">VIEW →</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
