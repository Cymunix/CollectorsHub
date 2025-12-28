import { supabase } from "@/lib/supabaseClient";
import type { MinifigCard } from "./minifigsTypes";

type PhotoRow = {
  image_url: string;
  is_primary: boolean | null;
  sort_order: number | null;
};

type Row = {
  minifig_id: string;
  included: boolean;
  included_qty: number;

  // joined
  catalog_minifigs: null | {
    id: string;
    name: string | null;
    minifig_number: string | null;
    image_url: string | null;
  };

  // joined through user_collection_item_id -> user_collection_items
  user_collection_items: null | {
    id: string; // this is the COPY id (user_collection_item_id)
    user_id: string;
    catalog_item_id: string; // <-- THIS is the SET id you must link to
    qty: number | null;

    // joined through catalog_item_id -> catalog_items
    catalog_items: null | {
      id: string; // same as catalog_item_id
      name: string | null;
      set_number: string | null;
      item_type: string | null;

      catalog_item_photos: PhotoRow[] | null;
    };
  };
};

function pickPrimaryPhoto(photos: PhotoRow[] | null | undefined): string | null {
  const list = Array.isArray(photos) ? photos : [];
  if (!list.length) return null;

  const sorted = [...list].sort((a, b) => {
    const ap = a.is_primary ? 1 : 0;
    const bp = b.is_primary ? 1 : 0;
    if (bp !== ap) return bp - ap;
    const as = a.sort_order ?? 9999;
    const bs = b.sort_order ?? 9999;
    return as - bs;
  });

  return sorted[0]?.image_url ?? null;
}

export async function loadMinifigCards(userId: string): Promise<MinifigCard[]> {
  if (!userId) return [];

  // IMPORTANT:
  // user_collection_item_minifigs -> user_collection_items (via user_collection_item_id)
  // user_collection_items -> catalog_items (via catalog_item_id)
  const res = await supabase
    .from("user_collection_item_minifigs")
    .select(
      `
      minifig_id,
      included,
      included_qty,
      catalog_minifigs!inner (
        id,
        name,
        minifig_number,
        image_url
      ),
      user_collection_items!inner (
        id,
        user_id,
        catalog_item_id,
        qty,
        catalog_items!inner (
          id,
          name,
          set_number,
          item_type,
          catalog_item_photos (
            image_url,
            is_primary,
            sort_order
          )
        )
      )
    `
    )
    .eq("user_collection_items.user_id", userId);

  if (res.error) throw new Error(res.error.message);

  const rows = (res.data ?? []) as unknown as Row[];

  const byMinifig = new Map<string, MinifigCard>();

  for (const r of rows) {
    const mf = r.catalog_minifigs;
    const uci = r.user_collection_items;
    const set = uci?.catalog_items;

    if (!mf || !uci || !set) continue;

    const minifigId = r.minifig_id;

    const card =
      byMinifig.get(minifigId) ??
      ({
        minifigId,
        minifigNumber: mf.minifig_number ?? "",
        name: mf.name ?? null,
        imageUrl: mf.image_url ?? null,
        includedQtyTotal: 0,
        sets: [],
      } satisfies MinifigCard);

    if (r.included) card.includedQtyTotal += Number(r.included_qty ?? 0);

    // THIS is the correct set id for /collection/[catalogItemId]
    const catalogItemId = uci.catalog_item_id; // <-- DO NOT use uci.id

    const copyQty = Number(uci.qty ?? 1);
    const setPhoto = pickPrimaryPhoto(set.catalog_item_photos ?? null);

    const found = card.sets.find((s) => s.catalogItemId === catalogItemId);
    if (!found) {
      card.sets.push({
        userCollectionItemId: uci.id, // copy id (fine to keep)
        catalogItemId, // set id (for routing)
        setName: set.name ?? "Unknown set",
        setNumber: set.set_number ?? null,
        itemType: set.item_type ?? null,
        copyQty,
        imageUrl: setPhoto,
        copiesCount: 1,
        copiesQtyTotal: copyQty,
      });
    } else {
      found.copiesCount += 1;
      found.copiesQtyTotal += copyQty;
    }

    byMinifig.set(minifigId, card);
  }

  const cards = Array.from(byMinifig.values()).map((c) => ({
    ...c,
    sets: [...c.sets].sort((a, b) => {
      const an = a.setNumber ?? "";
      const bn = b.setNumber ?? "";
      if (an !== bn) return an.localeCompare(bn);
      return String(a.setName ?? "").localeCompare(String(b.setName ?? ""));
    }),
  }));

  cards.sort((a, b) => {
    const an = a.minifigNumber ?? "";
    const bn = b.minifigNumber ?? "";
    if (an !== bn) return an.localeCompare(bn);
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });

  return cards;
}
