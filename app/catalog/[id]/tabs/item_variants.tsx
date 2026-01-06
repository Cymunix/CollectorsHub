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

  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  const [linkExistingId, setLinkExistingId] = useState("");
  const [linkVariantName, setLinkVariantName] = useState("");
  const [linkVariantRank, setLinkVariantRank] = useState("");

  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantRank, setNewVariantRank] = useState("");

  /* =========================
     Load
     ========================= */

  const load = async () => {
    setLoading(true);
    setErr(null);
    setItems([]);
    setGroupId(null);
    setBaseItem(null);

    const baseRes = await supabase
      .from("catalog_items")
      .select(
        "id,name,category_id,subcategory_id,franchise_id,upc,release_year,version,variant_group_id"
      )
      .eq("id", catalogItemId)
      .single();

    if (baseRes.error) {
      setErr(baseRes.error.message);
      setLoading(false);
      return;
    }

    const base: BaseItemLite = {
      id: String(baseRes.data.id),
      name: baseRes.data.name ?? "Item",
      category_id: baseRes.data.category_id ?? null,
      subcategory_id: baseRes.data.subcategory_id ?? null,
      franchise_id: baseRes.data.franchise_id ?? null,
      upc: baseRes.data.upc ?? null,
      release_year: baseRes.data.release_year ?? null,
      version: baseRes.data.version ?? null,
      variant_group_id: baseRes.data.variant_group_id
        ? String(baseRes.data.variant_group_id)
        : null,
    };

    setBaseItem(base);

    let vg = base.variant_group_id;

    if (!vg) {
      const childRes = await supabase
        .from("catalog_items")
        .select("variant_group_id")
        .eq("base_catalog_item_id", catalogItemId)
        .not("variant_group_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (!childRes.error && childRes.data?.variant_group_id) {
        vg = String(childRes.data.variant_group_id);
      }
    }

    setGroupId(vg);

    if (!vg) {
      setItems([
        {
          id: base.id,
          name: base.name,
          upc: base.upc,
          variant_name: null,
          variant_rank: null,
          variant_group_id: null,
          base_catalog_item_id: null,
        },
      ]);
      setLoading(false);
      return;
    }

    const itemsRes = await supabase
      .from("catalog_items")
      .select(
        "id,name,upc,variant_name,variant_rank,variant_group_id,base_catalog_item_id"
      )
      .or(`variant_group_id.eq.${vg},id.eq.${catalogItemId}`)
      .order("variant_rank", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true });

    if (itemsRes.error) {
      setErr(itemsRes.error.message);
      setLoading(false);
      return;
    }

    const rows: CatalogItemVariantRow[] = itemsRes.data.map((r: any) => ({
      id: String(r.id),
      name: r.name ?? "Variant",
      upc: r.upc ?? null,
      variant_name: r.variant_name ?? null,
      variant_rank:
        typeof r.variant_rank === "number" ? r.variant_rank : null,
      variant_group_id: r.variant_group_id
        ? String(r.variant_group_id)
        : null,
      base_catalog_item_id: r.base_catalog_item_id
        ? String(r.base_catalog_item_id)
        : null,
    }));

    const current = rows.find((r) => r.id === catalogItemId);
    const others = rows.filter((r) => r.id !== catalogItemId);

    setItems(current ? [current, ...others] : rows);
    setLoading(false);
  };

  useEffect(() => {
    if (!catalogItemId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId]);

  const rows = useMemo(() => items, [items]);

  /* =========================
     Variant Group (FIXED)
     ========================= */

  const ensureGroup = async (): Promise<string> => {
    if (groupId) return groupId;
    if (baseItem?.variant_group_id) {
      setGroupId(baseItem.variant_group_id);
      return baseItem.variant_group_id;
    }

    // 🔒 Create REAL variant group row
    const create = await supabase
      .from("variant_groups")
      .insert([{}])
      .select("id")
      .single();

    if (create.error) throw create.error;

    const vg = String(create.data.id);

    const upBase = await supabase
      .from("catalog_items")
      .update({
        variant_group_id: vg,
        base_catalog_item_id: null,
      })
      .eq("id", catalogItemId);

    if (upBase.error) throw upBase.error;

    setGroupId(vg);
    return vg;
  };

  /* =========================
     Admin Actions
     ========================= */

  const onCreateGroup = async () => {
    try {
      setAdminBusy(true);
      setAdminMsg(null);
      await ensureGroup();
      setAdminMsg("Variant group created.");
      await load();
    } catch (e: any) {
      setAdminMsg(e.message);
    } finally {
      setAdminBusy(false);
    }
  };

  const onLinkExisting = async () => {
    if (!linkExistingId.trim()) {
      setAdminMsg("Enter an item id.");
      return;
    }

    try {
      setAdminBusy(true);
      setAdminMsg(null);

      const vg = await ensureGroup();

      const payload: any = {
        variant_group_id: vg,
        base_catalog_item_id: catalogItemId,
      };

      if (linkVariantName.trim()) payload.variant_name = linkVariantName.trim();
      if (linkVariantRank && !isNaN(Number(linkVariantRank)))
        payload.variant_rank = Number(linkVariantRank);

      const up = await supabase
        .from("catalog_items")
        .update(payload)
        .eq("id", linkExistingId.trim());

      if (up.error) throw up.error;

      setLinkExistingId("");
      setLinkVariantName("");
      setLinkVariantRank("");
      setAdminMsg("Item linked.");
      await load();
    } catch (e: any) {
      setAdminMsg(e.message);
    } finally {
      setAdminBusy(false);
    }
  };

  const onCreateNewVariant = async () => {
    if (!baseItem) return;

    if (!newVariantName.trim()) {
      setAdminMsg("Variant name required.");
      return;
    }

    try {
      setAdminBusy(true);
      setAdminMsg(null);

      const vg = await ensureGroup();

      const insert = await supabase
        .from("catalog_items")
        .insert([
          {
            name: baseItem.name,
            category_id: baseItem.category_id,
            subcategory_id: baseItem.subcategory_id,
            franchise_id: baseItem.franchise_id,
            release_year: baseItem.release_year,
            version: baseItem.version,
            variant_group_id: vg,
            base_catalog_item_id: catalogItemId,
            variant_name: newVariantName.trim(),
            variant_rank:
              newVariantRank && !isNaN(Number(newVariantRank))
                ? Number(newVariantRank)
                : null,
          },
        ])
        .select("id")
        .single();

      if (insert.error) throw insert.error;

      setNewVariantName("");
      setNewVariantRank("");
      setAdminMsg("Variant created.");
      await load();

      router.push(`/catalog/${insert.data.id}`);
    } catch (e: any) {
      setAdminMsg(e.message);
    } finally {
      setAdminBusy(false);
    }
  };

  /* =========================
     Render
     ========================= */

  return (
    <div className="rounded-2xl border bg-white p-4">
      {loading && <div>Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}

      {isAdmin && (
        <div className="space-y-3">
          <button onClick={onCreateGroup} disabled={adminBusy}>
            Create group
          </button>

          <input
            placeholder="Existing item id"
            value={linkExistingId}
            onChange={(e) => setLinkExistingId(e.target.value)}
          />
          <button onClick={onLinkExisting} disabled={adminBusy}>
            Link existing
          </button>

          <input
            placeholder="Variant name"
            value={newVariantName}
            onChange={(e) => setNewVariantName(e.target.value)}
          />
          <button onClick={onCreateNewVariant} disabled={adminBusy}>
            Create variant
          </button>

          {adminMsg && <div>{adminMsg}</div>}
        </div>
      )}

      {rows.map((r) => (
        <div key={r.id} onClick={() => router.push(`/catalog/${r.id}`)}>
          {r.name} {r.variant_name ? `(${r.variant_name})` : ""}
        </div>
      ))}
    </div>
  );
}
