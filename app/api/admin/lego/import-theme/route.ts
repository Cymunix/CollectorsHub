import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BRICKSET_ENDPOINT = "https://brickset.com/api/v3.asmx";

async function bricksetGetSets(apiKey: string, params: Record<string, any>) {
  const qs = new URLSearchParams({
    apiKey,
    userHash: "",
    params: JSON.stringify(params), // Brickset expects params JSON string
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

/**
 * IMPORTANT DB NOTES (do this in Supabase SQL editor):
 *
 * -- Idempotency for suggestions import (required for upsert)
 * create unique index if not exists catalog_item_suggestions_source_source_key_uniq
 * on catalog_item_suggestions (source, source_key);
 *
 * -- Make theme creation safe from duplicates (strongly recommended)
 * create unique index if not exists bb_themes_name_uniq on bb_themes (lower(name));
 * create unique index if not exists bb_subthemes_theme_name_uniq on bb_subthemes (theme_id, lower(name));
 */

export async function POST(req: Request) {
  const apiKey = process.env.BRICKSET_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) return NextResponse.json({ error: "Missing BRICKSET_API_KEY" }, { status: 500 });
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));

  const created_by_user_id = safeStr(body?.created_by_user_id);
  if (!created_by_user_id) {
    return NextResponse.json({ error: "created_by_user_id is required" }, { status: 400 });
  }

  const theme = safeStr(body?.theme);
  const subtheme = safeStr(body?.subtheme) || null;
  const year = Number.isFinite(Number(body?.year)) ? Number(body.year) : null;

  const pageSize = Math.min(Math.max(toInt(body?.pageSize, 200), 1), 500);
  const pageNumber = Math.min(Math.max(toInt(body?.pageNumber, 1), 1), 5000);

  if (!theme) return NextResponse.json({ error: "theme is required" }, { status: 400 });

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Caches to avoid hammering DB
  const themeIdCache = new Map<string, string>(); // lower(name) -> id
  const subthemeIdCache = new Map<string, string>(); // `${themeId}::${lower(name)}` -> id

  const getOrCreateTheme = async (name: string): Promise<string | null> => {
    const n = safeStr(name);
    if (!n) return null;
    const key = n.toLowerCase();
    if (themeIdCache.has(key)) return themeIdCache.get(key)!;

    // Try find
    const found = await supabase
      .from("bb_themes")
      .select("id,name")
      .ilike("name", n) // good enough; recommended unique index on lower(name)
      .limit(1)
      .maybeSingle();

    if (found.error) throw found.error;
    if (found.data?.id) {
      themeIdCache.set(key, found.data.id);
      return found.data.id;
    }

    // Try insert
    const ins = await supabase.from("bb_themes").insert({ name: n }).select("id").single();
    if (!ins.error && ins.data?.id) {
      themeIdCache.set(key, ins.data.id);
      return ins.data.id;
    }

    // If insert failed due to race/duplicate, select again
    const found2 = await supabase
      .from("bb_themes")
      .select("id,name")
      .ilike("name", n)
      .limit(1)
      .maybeSingle();

    if (found2.error) throw found2.error;
    if (found2.data?.id) {
      themeIdCache.set(key, found2.data.id);
      return found2.data.id;
    }

    return null;
  };

  const getOrCreateSubtheme = async (theme_id: string, name: string): Promise<string | null> => {
    const n = safeStr(name);
    if (!theme_id || !n) return null;
    const key = `${theme_id}::${n.toLowerCase()}`;
    if (subthemeIdCache.has(key)) return subthemeIdCache.get(key)!;

    const found = await supabase
      .from("bb_subthemes")
      .select("id,name,theme_id")
      .eq("theme_id", theme_id)
      .ilike("name", n)
      .limit(1)
      .maybeSingle();

    if (found.error) throw found.error;
    if (found.data?.id) {
      subthemeIdCache.set(key, found.data.id);
      return found.data.id;
    }

    const ins = await supabase
      .from("bb_subthemes")
      .insert({ theme_id, name: n })
      .select("id")
      .single();

    if (!ins.error && ins.data?.id) {
      subthemeIdCache.set(key, ins.data.id);
      return ins.data.id;
    }

    const found2 = await supabase
      .from("bb_subthemes")
      .select("id,name,theme_id")
      .eq("theme_id", theme_id)
      .ilike("name", n)
      .limit(1)
      .maybeSingle();

    if (found2.error) throw found2.error;
    if (found2.data?.id) {
      subthemeIdCache.set(key, found2.data.id);
      return found2.data.id;
    }

    return null;
  };

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

    // Build suggestion rows (UNCLASSIFIED: category/subcategory/franchise are null)
    const rows: any[] = [];

    for (const set of sets) {
      const number = set?.number;
      const variant = set?.numberVariant;

      const setNumber = number != null && variant != null ? `${number}-${variant}` : null;
      if (!setNumber) continue;

      const themeName = safeStr(set?.theme);
      const subthemeName = safeStr(set?.subtheme);

      const bb_theme_id = themeName ? await getOrCreateTheme(themeName) : null;
      const bb_subtheme_id =
        bb_theme_id && subthemeName ? await getOrCreateSubtheme(bb_theme_id, subthemeName) : null;

      const retailCAD = set?.LEGOCom?.CA?.retailPrice ?? null;
      const retailUSD = set?.LEGOCom?.US?.retailPrice ?? null;

      rows.push({
        status: "pending",
        created_by_user_id,

        // unclassified on purpose (you assign in admin UI)
        category_id: null,
        subcategory_id: null,
        franchise_id: null,

        // basic fields from Brickset
        name: set?.name ?? `LEGO ${setNumber}`,
        release_year: set?.year ?? null,
        upc: null,
        version: null,

        source_url: set?.bricksetURL ?? null,
        image_url: set?.image?.imageURL ?? null,

        // LEGO fields
        bb_set_number: setNumber,
        bb_piece_count: set?.pieces ?? null,
        bb_retail_cad: retailCAD,
        bb_retail_usd: retailUSD,

        bb_theme_id,
        bb_subtheme_id,

        // idempotency
        source: "brickset",
        source_key: setNumber,

        // audit/debug
        details_json: { brickset: set },
      });
    }

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
      {
        ok: true,
        imported: rows.length,
        matches: result.matches,
        pageNumber,
        pageSize,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Import failed" }, { status: 502 });
  }
}
