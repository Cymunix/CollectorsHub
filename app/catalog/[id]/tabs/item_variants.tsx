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

    // 2) Determine group id:
    //    - use base.variant_group_id if present
    //    - else derive from children (base_catalog_item_id)
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
      // Not linked yet
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

    // 3) Load group items, include base item even if its row lacks group_id
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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId]);

  const rows = useMemo(() => items, [items]);

  /* =========================
     Add-item style variant linking helpers
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
    // IMPORTANT:
    // If variant_groups has required NOT NULL columns, add them here (e.g. { name: "Auto group" }).
    const create = await supabase.from("variant_groups").insert([{}]).select("id").single();
    if (create.error) throw create.error;

    const vg = String((create.data as any)?.id ?? "");
    if (!vg) throw new Error("Failed to create variant group (no id returned).");
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

    // Repoint all items into the destination group; keep base rules consistent.
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
  };

  /* =========================
     Admin actions
     ========================= */

  const ensureGroup = async (): Promise<string> => {
    // If we already have a group id, just return it
    if (groupId) return groupId;

    // If base item already has one, use it
    if (baseItem?.variant_group_id) {
      setGroupId(baseItem.variant_group_id);
      return baseItem.variant_group_id;
    }

    // Otherwise create a real group row, then assign this item as base.
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

  const onCreateGroup = async () => {
    try {
      setAdminBusy(true);
      setAdminMsg(null);

      const vg = await ensureGroup();
      setAdminMsg(`Variant group created: ${vg}`);
      await load();
    } catch (e: any) {
      setAdminMsg(e?.message ?? "Failed to create variant group.");
    } finally {
      setAdminBusy(false);
    }
  };

  const onLinkExisting = async () => {
    const targetId = linkExistingId.trim();
    if (!targetId) {
      setAdminMsg("Enter an item id to link.");
      return;
    }
    if (targetId === catalogItemId) {
      setAdminMsg("You can’t link an item to itself.");
      return;
    }

    try {
      setAdminBusy(true);
      setAdminMsg(null);

      // Ensure current item has/creates a group (base group)
      const baseGroupId = await ensureGroup();

      // Check the target's existing group (if any)
      const targetGroupId = await fetchItemGroup(targetId);

      // Merge if target is in a different group already
      if (targetGroupId && targetGroupId !== baseGroupId) {
        await mergeGroups(targetGroupId, baseGroupId, catalogItemId);
      }

      // Link the target item into the group (treat as variant of current/base item)
      const payloadVariantName = linkVariantName.trim();
      const rk = linkVariantRank.trim();
      const rankVal = rk !== "" && Number.isFinite(Number(rk)) ? Number(rk) : null;

      await assignItemToGroup({
        itemId: targetId,
        groupId: baseGroupId,
        baseId: catalogItemId,
        makeBase: false,
        variantName: payloadVariantName ? payloadVariantName : undefined, // don't overwrite if blank
        variantRank: rankVal !== null ? rankVal : undefined,
      });

      setLinkExistingId("");
      setLinkVariantName("");
      setLinkVariantRank("");

      setAdminMsg(
        targetGroupId && targetGroupId !== baseGroupId
          ? "Linked existing item and merged its group into this group."
          : "Linked existing item into variants."
      );

      await load();
    } catch (e: any) {
      setAdminMsg(e?.message ?? "Failed to link existing item.");
    } finally {
      setAdminBusy(false);
    }
  };

  const onCreateNewVariant = async () => {
    if (!baseItem) {
      setAdminMsg("Base item not loaded yet.");
      return;
    }

    const vn = newVariantName.trim();
    if (!vn) {
      setAdminMsg("Enter a variant label/name (e.g. 'Steelbook', 'Greatest Hits', 'Holo', etc.).");
      return;
    }

    try {
      setAdminBusy(true);
      setAdminMsg(null);

      const vg = await ensureGroup();

      const rk = newVariantRank.trim();
      const rankVal = rk !== "" && Number.isFinite(Number(rk)) ? Number(rk) : null;

      const insertRes = await supabase
        .from("catalog_items")
        .insert([
          {
            name: baseItem.name,
            category_id: baseItem.category_id,
            subcategory_id: baseItem.subcategory_id,
            franchise_id: baseItem.franchise_id,
            upc: null,
            release_year: baseItem.release_year,
            version: baseItem.version,

            variant_group_id: vg,
            base_catalog_item_id: catalogItemId,
            variant_name: vn,
            variant_rank: rankVal,
          },
        ])
        .select("id")
        .single();

      if (insertRes.error) throw insertRes.error;

      const newId = String((insertRes.data as any)?.id ?? "");
      if (!newId) throw new Error("Created variant but did not get an id back.");

      setNewVariantName("");
      setNewVariantRank("");

      setAdminMsg("Variant created.");
      await load();

      router.push(`/catalog/${newId}`);
    } catch (e: any) {
      setAdminMsg(e?.message ?? "Failed to create variant.");
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div className="text-sm font-semibold text-[#0F172A]">Variants</div>
        <div className="text-[11px] text-[#64748B]">{rows.length ? `${rows.length}` : ""}</div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? <div className="text-sm text-[#64748B]">Loading…</div> : null}
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        {/* Admin tools */}
        {isAdmin ? (
          <div className="rounded-2xl border border-[#E5E9F2] bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">Admin tools</div>
                <div className="text-xs text-[#64748B]">
                  Create a variant group, link an existing item, or create a new variant.
                </div>
              </div>
              <button
                type="button"
                disabled={adminBusy}
                onClick={onCreateGroup}
                className="rounded-full px-3 py-2 text-xs font-semibold border transition bg-white text-[#0F172A] border-[#E5E9F2] hover:bg-[#F1F5F9] disabled:opacity-60"
              >
                {groupId ? "Group exists" : "Create group"}
              </button>
            </div>

            {adminMsg ? <div className="mt-3 text-xs text-[#0F172A]">{adminMsg}</div> : null}
            <div className="mt-3 text-[11px] text-[#64748B]">Group: {groupId ? groupId : "—"}</div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Link existing */}
              <div className="rounded-xl border border-[#E5E9F2] bg-white p-3">
                <div className="text-xs font-semibold text-[#0F172A]">Link existing item</div>
                <div className="mt-2 space-y-2">
                  <input
                    value={linkExistingId}
                    onChange={(e) => setLinkExistingId(e.target.value)}
                    placeholder="Existing catalog item id"
                    className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                  />
                  <input
                    value={linkVariantName}
                    onChange={(e) => setLinkVariantName(e.target.value)}
                    placeholder="Variant label (optional)"
                    className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                  />
                  <input
                    value={linkVariantRank}
                    onChange={(e) => setLinkVariantRank(e.target.value)}
                    placeholder="Rank (optional number)"
                    className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    disabled={adminBusy}
                    onClick={onLinkExisting}
                    className="w-full rounded-xl px-3 py-2 text-xs font-semibold border transition bg-[#0F172A] text-white border-[#0F172A] hover:opacity-95 disabled:opacity-60"
                  >
                    Link into group
                  </button>
                </div>
              </div>

              {/* Create new */}
              <div className="rounded-xl border border-[#E5E9F2] bg-white p-3">
                <div className="text-xs font-semibold text-[#0F172A]">Create new variant item</div>
                <div className="mt-2 space-y-2">
                  <input
                    value={newVariantName}
                    onChange={(e) => setNewVariantName(e.target.value)}
                    placeholder="Variant label (required)"
                    className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                  />
                  <input
                    value={newVariantRank}
                    onChange={(e) => setNewVariantRank(e.target.value)}
                    placeholder="Rank (optional number)"
                    className="w-full rounded-xl border border-[#E5E9F2] px-3 py-2 text-sm"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    disabled={adminBusy}
                    onClick={onCreateNewVariant}
                    className="w-full rounded-xl px-3 py-2 text-xs font-semibold border transition bg-[#0F172A] text-white border-[#0F172A] hover:opacity-95 disabled:opacity-60"
                  >
                    Create + open
                  </button>
                  <div className="text-[11px] text-[#64748B]">
                    This creates a minimal clone of the base item (classification fields only). You’ll edit the new item
                    after.
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Existing variants list */}
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
