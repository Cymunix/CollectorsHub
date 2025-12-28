import { supabase } from "@/lib/supabaseClient";

/**
 * IMPORTANT:
 * Adjust table/column names here to match your schema.
 * Keep components clean — all “what table is it?” decisions live in this file.
 */

export async function fetchCatalogItemSummary(catalogItemId: string) {
  // Example assumes:
  // catalog_items(id, name, set_number, year, ...)
  // plus maybe joined meta tables if you have them
  const res = await supabase
    .from("catalog_items")
    .select("id,name,set_number,year")
    .eq("id", catalogItemId)
    .single();

  if (res.error) throw res.error;

  const row = res.data as any;

  return {
    id: row.id,
    name: row.name ?? "Catalog Item",
    set_number: row.set_number ?? null,
    year: row.year ?? null,
    category_name: row.category_name ?? null,
    theme: row.theme ?? null,
    subtheme: row.subtheme ?? null,
  };
}

export async function fetchItemVariants(catalogItemId: string) {
  // Example assumes:
  // catalog_variant_links(id, catalog_item_id, label, url, source)
  const res = await supabase
    .from("catalog_variant_links")
    .select("id,label,url,source")
    .eq("catalog_item_id", catalogItemId)
    .order("label", { ascending: true });

  if (res.error) throw res.error;

  return (res.data ?? []).map((r: any) => ({
    id: r.id,
    label: r.label ?? "Variant",
    url: r.url ?? null,
    source: r.source ?? null,
  }));
}

export async function fetchItemReviews(catalogItemId: string) {
  // Example assumes:
  // catalog_item_reviews(id, catalog_item_id, rating, title, body, created_at, display_name)
  const res = await supabase
    .from("catalog_item_reviews")
    .select("id,rating,title,body,created_at,display_name")
    .eq("catalog_item_id", catalogItemId)
    .order("created_at", { ascending: false });

  if (res.error) throw res.error;

  return (res.data ?? []).map((r: any) => ({
    id: r.id,
    rating: Number(r.rating) || 5,
    title: r.title ?? null,
    body: r.body ?? null,
    created_at: r.created_at,
    display_name: r.display_name ?? null,
  }));
}

export async function insertItemReview(input: {
  catalog_item_id: string;
  rating: number;
  title: string | null;
  body: string;
}) {
  // You probably want RLS that allows authenticated users to insert their own reviews.
  const res = await supabase.from("catalog_item_reviews").insert({
    catalog_item_id: input.catalog_item_id,
    rating: input.rating,
    title: input.title,
    body: input.body,
  });

  if (res.error) throw res.error;
  return true;
}

export async function fetchItemSalesHistory(catalogItemId: string) {
  // Example assumes:
  // catalog_item_sales(id, catalog_item_id, sold_at, price_cad, source, url, condition_note)
  const res = await supabase
    .from("catalog_item_sales")
    .select("id,sold_at,price_cad,source,url,condition_note")
    .eq("catalog_item_id", catalogItemId)
    .order("sold_at", { ascending: false })
    .limit(100);

  if (res.error) throw res.error;

  return (res.data ?? []).map((r: any) => ({
    id: r.id,
    sold_at: r.sold_at,
    price_cad: r.price_cad === null ? null : Number(r.price_cad),
    source: r.source ?? null,
    url: r.url ?? null,
    condition_note: r.condition_note ?? null,
  }));
}
