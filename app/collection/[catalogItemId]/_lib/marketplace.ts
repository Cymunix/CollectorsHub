import { supabase } from "@/lib/supabaseClient";

export async function createMarketplaceListing(args: {
  userCollectionItemId: string;
  catalogItemId: string;
  title: string;
  priceCad: number;
  description?: string | null;
}) {
  const auth = await supabase.auth.getUser();
  const user = auth.data.user;
  if (!user) throw new Error("Not signed in.");

  const payload = {
    user_id: user.id,
    seller_user_id: user.id,

    user_collection_item_id: args.userCollectionItemId,
    catalog_item_id: args.catalogItemId,

    title: args.title,
    price_cad: Number(args.priceCad),
    description: args.description ?? null,
    status: "active",
  };

  const { data, error } = await supabase
    .from("marketplace_listings")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data as { id: string };
}

export async function saveListingMinifigs(args: {
  listingId: string;
  rows: { minifig_id: string; included_qty: number }[];
}) {
  const payload = (args.rows ?? []).map((r) => ({
    listing_id: args.listingId,
    minifig_id: String(r.minifig_id),
    included_qty: Math.max(0, Math.floor(Number(r.included_qty ?? 0))),
  }));

  // Upsert selected minifigs
  if (payload.length > 0) {
    const { error } = await supabase
      .from("marketplace_listing_minifigs")
      .upsert(payload, { onConflict: "listing_id,minifig_id" });

    if (error) throw new Error(error.message);
  }

  // Delete unselected ones (keep table clean)
  const keepIds = payload.map((p) => p.minifig_id);

  if (keepIds.length === 0) {
    const { error } = await supabase
      .from("marketplace_listing_minifigs")
      .delete()
      .eq("listing_id", args.listingId);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("marketplace_listing_minifigs")
    .delete()
    .eq("listing_id", args.listingId)
    .not("minifig_id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);

  if (error) throw new Error(error.message);
}
