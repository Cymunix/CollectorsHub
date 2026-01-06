// app/api/suggest/lego/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type BricksetSet = {
  setID?: number;
  number?: string;            // e.g. "75313"
  numberVariant?: number;     // e.g. 1
  name?: string;
  year?: number;
  theme?: string;
  subtheme?: string;
  pieces?: number | null;
  image?: { thumbnailURL?: string; imageURL?: string };
  LEGOCom?: {
    CA?: { retailPrice?: number | null };
    US?: { retailPrice?: number | null };
  };
  barcode?: { UPC?: string; EAN?: string };
  bricksetURL?: string;
};

function normaliseSetNumber(input: string) {
  const s = String(input || "").trim();
  if (!s) return "";
  // Accept "75313" and coerce to "75313-1"
  if (/^\d{4,6}$/.test(s)) return `${s}-1`;
  return s;
}

async function fetchBricksetSet(setNumber: string): Promise<BricksetSet> {
  const apiKey = process.env.BRICKSET_API_KEY;
  if (!apiKey) throw new Error("Missing BRICKSET_API_KEY");

  // Brickset API v3 expects params as a JSON string, e.g. {"setNumber":"6876-1","extendedData":1}
  // setNumber param format is {number}-{variant}. :contentReference[oaicite:2]{index=2}
  const params = JSON.stringify({ setNumber, extendedData: 1, pageSize: 1, pageNumber: 1 });

  const url =
    "https://brickset.com/api/v3.asmx/getSets" +
    `?apiKey=${encodeURIComponent(apiKey)}` +
    `&userHash=` +
    `&params=${encodeURIComponent(params)}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Brickset getSets failed: HTTP ${res.status}`);

  const json = (await res.json().catch(() => null)) as any;
  if (!json || json.status !== "success") {
    throw new Error(json?.message || "Brickset response error");
  }

  const set = (json.sets ?? [])[0] as BricksetSet | undefined;
  if (!set) throw new Error("No matches for that set number");
  return set;
}

async function getOrCreateBbThemeId(themeName: string | null): Promise<string | null> {
  const name = String(themeName || "").trim();
  if (!name) return null;

  const existing = await supabaseAdmin
    .from("bb_themes")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (existing.data?.id) return existing.data.id;

  const created = await supabaseAdmin
    .from("bb_themes")
    .insert({ name })
    .select("id")
    .single();

  if (created.error) throw created.error;
  return created.data.id;
}

async function getOrCreateBbSubthemeId(subthemeName: string | null, themeId: string | null): Promise<string | null> {
  const name = String(subthemeName || "").trim();
  if (!name || !themeId) return null;

  const existing = await supabaseAdmin
    .from("bb_subthemes")
    .select("id")
    .eq("theme_id", themeId)
    .eq("name", name)
    .maybeSingle();

  if (existing.data?.id) return existing.data.id;

  const created = await supabaseAdmin
    .from("bb_subthemes")
    .insert({ theme_id: themeId, name })
    .select("id")
    .single();

  if (created.error) throw created.error;
  return created.data.id;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const setNumberRaw = String(body?.setNumber ?? "");
    const setNumber = normaliseSetNumber(setNumberRaw);
    if (!setNumber) {
      return NextResponse.json({ error: "setNumber is required" }, { status: 400 });
    }

    const legoCategoryId = process.env.LEGO_CATEGORY_ID;
    const legoSubcategoryId = process.env.LEGO_SUBCATEGORY_ID;
    if (!legoCategoryId || !legoSubcategoryId) {
      return NextResponse.json(
        { error: "Missing LEGO_CATEGORY_ID / LEGO_SUBCATEGORY_ID env vars" },
        { status: 500 }
      );
    }

    // 1) Fetch from Brickset
    const bs = await fetchBricksetSet(setNumber);

    // 2) Resolve theme/subtheme to your lookup tables
    const bbThemeId = await getOrCreateBbThemeId(bs.theme ?? null);
    const bbSubthemeId = await getOrCreateBbSubthemeId(bs.subtheme ?? null, bbThemeId);

    const name = (bs.name || "").trim() || `LEGO Set ${setNumber}`;
    const release_year = Number.isFinite(bs.year as any) ? (bs.year as number) : null;

    // Brickset image URLs live under image.thumbnailURL / image.imageURL :contentReference[oaicite:3]{index=3}
    const image_url = bs.image?.imageURL || bs.image?.thumbnailURL || null;

    // retail
    const bb_retail_cad = bs.LEGOCom?.CA?.retailPrice ?? null;
    const bb_retail_usd = bs.LEGOCom?.US?.retailPrice ?? null;

    // UPC
    const upc = bs.barcode?.UPC ?? null;

    // 3) Upsert into suggestions (idempotent on source/source_key)
    const source = "brickset";
    const source_key = `set:${setNumber}`;

    const payload = {
      source,
      source_key,

      status: "pending" as const,

      name,
      category_id: legoCategoryId,
      subcategory_id: legoSubcategoryId,

      // leave franchise null; admin sets it before publish
      franchise_id: null,

      release_year,
      upc,
      source_url: bs.bricksetURL ?? null,
      image_url,

      bb_theme_id: bbThemeId,
      bb_subtheme_id: bbSubthemeId,
      bb_set_number: setNumber,
      bb_piece_count: bs.pieces ?? null,
      bb_retail_cad,
      bb_retail_usd,

      // raw payload for debugging/enrichment
      details_json: bs,
    };

    // Supabase upsert requires a unique constraint/index on (source, source_key)
    const up = await supabaseAdmin
      .from("catalog_item_suggestions")
      .upsert(payload, { onConflict: "source,source_key" })
      .select("id,status,source,source_key")
      .single();

    if (up.error) {
      return NextResponse.json({ error: up.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, suggestion: up.data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
