import { NextResponse } from "next/server";

const ENDPOINT = "https://brickset.com/api/v3.asmx";

async function bricksetGetSets(apiKey: string, params: Record<string, any>) {
  const qs = new URLSearchParams({
    apiKey,
    userHash: "",
    params: JSON.stringify(params),
  });

  const res = await fetch(`${ENDPOINT}/getSets?${qs.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brickset getSets failed (${res.status}): ${text || res.statusText}`);
  }

  const json = await res.json();
  if (json?.status !== "success") throw new Error(json?.message || "Brickset error");
  return json as { status: "success"; matches: number; sets: any[] };
}

function normaliseThemeName(s: string) {
  return String(s || "").trim();
}

export async function POST(req: Request) {
  const apiKey = process.env.BRICKSET_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing BRICKSET_API_KEY" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const theme = normaliseThemeName(body?.theme);
  const subtheme = String(body?.subtheme || "").trim() || null;
  const year = Number.isFinite(Number(body?.year)) ? Number(body.year) : null;

  const pageSize = Math.min(Math.max(Number(body?.pageSize || 500), 1), 500);
  const pageNumber = Math.min(Math.max(Number(body?.pageNumber || 1), 1), 1000);

  // These two must be provided by your client/admin UI
  const category_id = String(body?.category_id || "").trim() || null;
  const subcategory_id = String(body?.subcategory_id || "").trim() || null;

  if (!theme) return NextResponse.json({ error: "theme is required" }, { status: 400 });
  if (!category_id || !subcategory_id) {
    return NextResponse.json({ error: "category_id and subcategory_id are required" }, { status: 400 });
  }

  // IMPORTANT: use service role on server so you can insert/update regardless of RLS
  // You likely already do this in /api/admin/suggestions/[id]/publish
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    const params: Record<string, any> = {
      theme, // Brickset filter
      pageSize,
      pageNumber,
      extendedData: 1,
    };
    if (subtheme) params.subtheme = subtheme;
    if (year) params.year = year;

    const result = await bricksetGetSets(apiKey, params);
    const sets = result.sets || [];

    // Transform into suggestion rows
    const rows = sets.map((set) => {
      const setNumber =
        set?.number != null && set?.numberVariant != null
          ? `${set.number}-${set.numberVariant}`
          : null;

      const retailCAD = set?.LEGOCom?.CA?.retailPrice ?? null;
      const retailUSD = set?.LEGOCom?.US?.retailPrice ?? null;

      return {
        status: "pending",
        name: set?.name ?? `LEGO Set ${setNumber ?? ""}`.trim(),
        category_id,
        subcategory_id,
        franchise_id: null,

        release_year: set?.year ?? null,
        upc: null,
        version: null,

        source_url: set?.bricksetURL ?? null,
        image_url: set?.image?.imageURL ?? null,

        // lego fields
        bb_set_number: setNumber,
        bb_piece_count: set?.pieces ?? null,
        bb_retail_cad: retailCAD,
        bb_retail_usd: retailUSD,

        // idempotency
        source: "brickset",
        source_key: setNumber, // unique key for upsert

        details_json: { brickset: set },
      };
    });

    // Upsert by (source, source_key) so importing the same theme twice won't duplicate
    const upsertRes = await supabase
      .from("catalog_item_suggestions")
      .upsert(rows, { onConflict: "source,source_key" });

    if (upsertRes.error) throw upsertRes.error;

    return NextResponse.json(
      { ok: true, imported: rows.length, matches: result.matches, pageNumber, pageSize },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Import failed" }, { status: 502 });
  }
}
