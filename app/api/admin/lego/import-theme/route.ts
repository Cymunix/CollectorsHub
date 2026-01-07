import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // force node runtime (so process.env behaves normally)

const BRICKSET_ENDPOINT = "https://brickset.com/api/v3.asmx";

function pickSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL ||
    ""
  ).trim();
}

function pickServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    ""
  ).trim();
}

async function bricksetGetSets(apiKey: string, params: Record<string, any>) {
  const qs = new URLSearchParams({
    apiKey,
    userHash: "",
    params: JSON.stringify(params),
  });

  const res = await fetch(`${BRICKSET_ENDPOINT}/getSets?${qs.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brickset getSets failed (${res.status}): ${text || res.statusText}`);
  }

  const json = await res.json().catch(() => ({}));
  if (json?.status !== "success") throw new Error(json?.message || "Brickset error");
  return json as { status: "success"; matches: number; sets: any[] };
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  const apiKey = (process.env.BRICKSET_API_KEY || "").trim();
  const supabaseUrl = pickSupabaseUrl();
  const serviceKey = pickServiceKey();

  if (debug) {
    return NextResponse.json(
      {
        ok: true,
        env_present: {
          BRICKSET_API_KEY: !!apiKey,
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_PROJECT_URL: !!process.env.SUPABASE_PROJECT_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
          SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
        },
        picked: {
          supabaseUrl: !!supabaseUrl,
          serviceKey: !!serviceKey,
        },
      },
      { status: 200 }
    );
  }

  const missing: string[] = [];
  if (!apiKey) missing.push("BRICKSET_API_KEY");
  if (!supabaseUrl) missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    return NextResponse.json(
      { error: `Missing env vars: ${missing.join(", ")}` },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const created_by_user_id = safeStr(body?.created_by_user_id);
  const theme = safeStr(body?.theme);
  const subtheme = safeStr(body?.subtheme) || null;
  const year = Number.isFinite(Number(body?.year)) ? Number(body.year) : null;

  const pageSize = Math.min(Math.max(toInt(body?.pageSize, 200), 1), 500);
  const pageNumber = Math.min(Math.max(toInt(body?.pageNumber, 1), 1), 5000);

  if (!created_by_user_id) {
    return NextResponse.json({ error: "created_by_user_id is required" }, { status: 400 });
  }
  if (!theme) {
    return NextResponse.json({ error: "theme is required" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const params: Record<string, any> = {
      theme,
      extendedData: 1,
      pageSize,
      pageNumber,
    };
    if (subtheme) params.subtheme = subtheme;
    if (year) params.year = year;

    const result = await bricksetGetSets(apiKey, params);
    const sets = Array.isArray(result.sets) ? result.sets : [];

    const rows = sets
      .map((set) => {
        const number = set?.number;
        const variant = set?.numberVariant;
        const setNumber = number != null && variant != null ? `${number}-${variant}` : null;
        if (!setNumber) return null;

        return {
          status: "pending",
          created_by_user_id,

          category_id: null,
          subcategory_id: null,
          franchise_id: null,

          name: set?.name ?? `LEGO ${setNumber}`,
          release_year: set?.year ?? null,
          upc: null,
          version: null,

          source_url: set?.bricksetURL ?? null,
          image_url: set?.image?.imageURL ?? null,

          bb_set_number: setNumber,
          bb_piece_count: set?.pieces ?? null,
          bb_retail_cad: set?.LEGOCom?.CA?.retailPrice ?? null,
          bb_retail_usd: set?.LEGOCom?.US?.retailPrice ?? null,

          source: "brickset",
          source_key: setNumber,

          details_json: { brickset: set },
        };
      })
      .filter(Boolean) as any[];

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: true, imported: 0, matches: result.matches, pageNumber, pageSize },
        { status: 200 }
      );
    }

    const up = await supabase
      .from("catalog_item_suggestions")
      .upsert(rows, { onConflict: "source,source_key" });

    if (up.error) throw up.error;

    return NextResponse.json(
      { ok: true, imported: rows.length, matches: result.matches, pageNumber, pageSize },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Import failed" }, { status: 502 });
  }
}
