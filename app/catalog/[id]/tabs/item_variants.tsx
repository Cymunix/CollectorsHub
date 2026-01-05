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

function uuid(): string {
  // Browser-safe UUID generator
  // (crypto.randomUUID exists in modern browsers)
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback: not perfect, but fine for non-critical use
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
        vg = (childGroupRes.data as any)?.variant_group_id ? String((childGroupRes.data as any).variant_group_id) : null;
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
     Admin actions
     ========================= */

  const ensureGroup = async (): Promise<string> => {
    // If we already have a group id, just return it
    if (groupId) return groupId;

    const vg = uuid();

    // Set on base item
    const upBase = await supabase
      .from("catalog_items")
      .update({ variant_group_id: vg })
      .eq("id", catalogItemId);

    if (upBase.error) throw upBase.error;

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

    try {
      setAdminBusy(true);
      setAdminMsg(null);

      const vg = await ensureGroup();

      // Link the target item into the group (treat as variant of current/base item)
      const payload: any = {
        variant_group_id: vg,
        base_catalog_item_id: catalogItemId,
      };

      const vn = linkVariantName.trim();
      if (vn) payload.variant_name = vn;

      const rk = linkVariantRank.trim();
      if (rk !== "" && Number.isFinite(Number(rk))) payload.variant_rank = Number(rk);

      const up = await supabase.from("catalog_items").update(payload).eq("id", targetId);

      if (up.error) throw up.error;

      setLinkExistingId("");
      setLinkVariantName("");
      setLinkVariantRank("");

      setAdminMsg("Linked existing item into variants.");
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
      const rankVal =
        rk !== "" && Number.isFinite(Number(rk)) ? Number(rk) : null;

      // Minimal clone: copy the core classification fields so it lands in the right place.
      // You can expand this later (photos, descriptions, etc).
      const insertRes = await supabase
        .from("catalog_items")
        .insert([
          {
            name: baseItem.name, // keep base name; variant_name differentiates it
            category_id: baseItem.category_id,
            subcategory_id: baseItem.subcategory_id,
            franchise_id: baseItem.franchise_id,
            upc: null, // variants often differ; leave blank unless you want to supply it
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

      // Jump straight to it so you can edit details immediately
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
            <div className="mt-3 text-[11px] text-[#64748B]">
              Group: {groupId ? groupId : "—"}
            </div>

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
                    This creates a minimal clone of the base item (classification fields only). You’ll edit the new item after.
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
