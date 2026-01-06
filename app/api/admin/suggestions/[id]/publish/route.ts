// app/api/admin/suggestions/[id]/publish/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const suggestionId = params.id;

  // If you want to record reviewer in the row, we accept it from body
  const body = await req.json().catch(() => ({}));
  const reviewedByUserId: string | null = body?.reviewed_by_user_id ?? null;

  // 1) Load suggestion
  const sugRes = await supabaseAdmin
    .from("catalog_item_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .single();

  if (sugRes.error || !sugRes.data) {
    return NextResponse.json(
      { error: sugRes.error?.message || "Suggestion not found." },
      { status: 404 }
    );
  }

  const s: any = sugRes.data;

  // 2) If already published, return existing
  if (s.approved_catalog_item_id) {
    return NextResponse.json({
      ok: true,
      catalog_item_id: s.approved_catalog_item_id,
      already: true,
    });
  }

  // 3) Validate minimum fields
  if (!s.name || !s.category_id || !s.subcategory_id) {
    return NextResponse.json(
      { error: "Missing required fields: name/category/subcategory." },
      { status: 400 }
    );
  }

  // LEGO-specific requirement: if it's a LEGO suggestion, enforce franchise + set number
  // We detect LEGO suggestions by presence of bb_set_number (works great for API imports)
  const isLego = !!(s.bb_set_number && String(s.bb_set_number).trim());

  if (isLego) {
    if (!s.franchise_id) {
      return NextResponse.json(
        { error: "LEGO suggestions require a Franchise before publishing." },
        { status: 400 }
      );
    }
    if (!s.bb_set_number) {
      return NextResponse.json(
        { error: "LEGO suggestions require a Set Number before publishing." },
        { status: 400 }
      );
    }
  }

  // 4) Insert into catalog_items
  const ins = await supabaseAdmin
    .from("catalog_items")
    .insert({
      name: s.name,
      category_id: s.category_id,
      subcategory_id: s.subcategory_id,
      franchise_id: s.franchise_id,
      release_year: s.release_year,
      upc: s.upc,
      version: s.version,
      image_url: s.image_url, // if you later move to a photos table, replace this

      // LEGO fields
      bb_theme_id: s.bb_theme_id ?? null,
      bb_subtheme_id: s.bb_subtheme_id ?? null,
      bb_set_number: s.bb_set_number ?? null,
      bb_piece_count: s.bb_piece_count ?? null,
      bb_retail_cad: s.bb_retail_cad ?? null,
      bb_retail_usd: s.bb_retail_usd ?? null,
    })
    .select("id")
    .single();

  if (ins.error || !ins.data) {
    return NextResponse.json(
      { error: ins.error?.message || "Failed to create catalog item." },
      { status: 500 }
    );
  }

  const catalogItemId = ins.data.id;

  // 5) Mark suggestion approved + link it
  const upd = await supabaseAdmin
    .from("catalog_item_suggestions")
    .update({
      status: "approved",
      approved_catalog_item_id: catalogItemId,
      reviewed_by_user_id: reviewedByUserId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  if (upd.error) {
    return NextResponse.json(
      { error: upd.error.message || "Failed to update suggestion after publishing." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, catalog_item_id: catalogItemId });
}
