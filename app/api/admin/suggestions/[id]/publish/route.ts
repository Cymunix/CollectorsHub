import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const BRICKSET_ENDPOINT = "https://brickset.com/api/v3.asmx";

/**
 * ====== CONFIG: CHANGE THESE 3 IF YOUR COLUMN NAMES DIFFER ======
 * Look them up in Supabase table editor.
 */
const SET_MINIFIGS_TABLE = "catalog_building_block_set_minifigs";
const SET_MINIFIGS_COL_SET_ID = "catalog_item_id"; // could be catalog_item_id or building_block_set_id etc
const SET_MINIFIGS_COL_MINIFIG_ID = "minifig_id"; // could be catalog_minifig_id etc
const SET_MINIFIGS_COL_QTY = "qty"; // could be quantity

const MINIFIGS_TABLE = "catalog_minifigs";
const MINIFIGS_COL_ID = "id";
const MINIFIGS_COL_NUMBER = "minifig_number"; // could be number / bb_minifig_number
const MINIFIGS_COL_NAME = "name";

const MINIFIG_PHOTOS_TABLE = "catalog_minifig_photos";
const MINIFIG_PHOTOS_COL_MINIFIG_ID = "minifig_id";
const MINIFIG_PHOTOS_COL_URL = "url"; // could be image_url
const MINIFIG_PHOTOS_COL_SOURCE = "source"; // optional, if you have it

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
    throw new Error(
      `Brickset getSets failed (${res.status}): ${text || res.statusText}`
    );
  }

  const json = await res.json().catch(() => ({}));
  if (json?.status !== "success") throw new Error(json?.message || "Brickset error");
  return json as { status: "success"; matches: number; sets: any[] };
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isLegoSuggestion(s: any) {
  return !!(s?.bb_set_number && String(s.bb_set_number).trim().length);
}

/**
 * Derive canonical catalog_items.kind for non-LEGO suggestions.
 *
 * This uses categories.slug (preferred) or categories.name (fallback).
 *
 * IMPORTANT:
 * - The RETURN values MUST match your DB check constraint catalog_items_kind_chk exactly.
 * - Adjust map keys to match your category slugs/names.
 */
async function deriveKindFromCategory(
  supabase: ReturnType<typeof createClient>,
  category_id: string
) {
  const cat = await supabase
    .from("categories")
    .select("id,slug,name")
    .eq("id", category_id)
    .single();

  if (cat.error) throw cat.error;

  const raw = String(cat.data?.slug || cat.data?.name || "").trim().toLowerCase();
  if (!raw) throw new Error(`Category has no slug/name (id=${category_id})`);

  // Normalise common variations
  const key = raw
    .replace(/&/g, "and")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");

  // 🔥 Adjust these mappings to your categories + allowed kinds
  // Right-hand side MUST match allowed values in catalog_items_kind_chk
  const map: Record<string, string> = {
    lego: "lego",
    legos: "lego",
    building_blocks: "lego",

    cards: "card",
    trading_cards: "card",
    card: "card",

    comics: "comic",
    comic: "comic",

    games: "game",
    game: "game",
    video_games: "game",

    movies: "movie",
    movie: "movie",
    films: "movie",

    music: "music",
  };

  const kind = map[key];
  if (!kind) {
    // Fail loudly with useful context so you can fix mapping in one go
    throw new Error(
      `Cannot derive catalog_items.kind from category "${raw}" (normalised "${key}", id=${category_id}). ` +
        `Update deriveKindFromCategory() mapping or your category slugs.`
    );
  }

  return kind;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const apiKey = (process.env.BRICKSET_API_KEY || "").trim();
  const supabaseUrl = pickSupabaseUrl();
  const serviceKey = pickServiceKey();

  if (!apiKey) return NextResponse.json({ error: "Missing BRICKSET_API_KEY" }, { status: 500 });
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const reviewed_by_user_id = safeStr(body?.reviewed_by_user_id);
    if (!reviewed_by_user_id) {
      return NextResponse.json({ error: "reviewed_by_user_id is required" }, { status: 400 });
    }

    // 1) Load suggestion
    const sug = await supabase
      .from("catalog_item_suggestions")
      .select("*")
      .eq("id", id)
      .single();

    if (sug.error) throw sug.error;
    const s: any = sug.data;
    if (!s) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });

    // gate
    if (!s.name || !s.category_id || !s.subcategory_id) {
      return NextResponse.json(
        { error: "Assign name/category/subcategory before publishing." },
        { status: 400 }
      );
    }

    const lego = isLegoSuggestion(s);
    if (lego && (!s.franchise_id || !s.bb_set_number)) {
      return NextResponse.json(
        { error: "LEGO publish requires franchise_id and bb_set_number." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const catalogItemId = s.approved_catalog_item_id || crypto.randomUUID();

    // 2) Determine kind (REQUIRED)
    // - LEGO: hard set to "lego"
    // - non-LEGO: derive from category slug/name mapping
    const kind = lego ? "lego" : await deriveKindFromCategory(supabase, String(s.category_id));

    if (!kind) {
      return NextResponse.json({ error: "kind is required (failed to derive)" }, { status: 400 });
    }

    // Optional debug to catch future issues instantly
    console.log("PUBLISH catalog_items", {
      id: catalogItemId,
      kind,
      name: s.name,
      category_id: s.category_id,
      subcategory_id: s.subcategory_id,
      lego,
    });

    // 3) Upsert catalog_items (base publish)
    const upItem = await supabase
      .from("catalog_items")
      .upsert(
        {
          id: catalogItemId,
          kind, // ✅ FIX: REQUIRED + must satisfy catalog_items_kind_chk

          name: s.name,
          category_id: s.category_id,
          subcategory_id: s.subcategory_id,
          franchise_id: s.franchise_id,
          release_year: s.release_year,
          upc: s.upc,
          version: s.version,
          source_url: s.source_url,
          image_url: s.image_url, // will overwrite for LEGO below
          updated_at: nowIso,
        },
        { onConflict: "id" }
      );

    if (upItem.error) throw upItem.error;

    // 4) LEGO takeover: overwrite image + minifig links
    if (lego) {
      const setNumber = String(s.bb_set_number).trim();

      const bs = await bricksetGetSets(apiKey, {
        setNumber,
        extendedData: 1,
        pageSize: 1,
        pageNumber: 1,
      });

      const set = Array.isArray(bs.sets) ? bs.sets[0] : null;
      if (!set) throw new Error(`Brickset set not found for ${setNumber}`);

      // 4a) overwrite item image
      const bricksetImageUrl = set?.image?.imageURL || set?.image?.thumbnailURL || null;
      const updImg = await supabase
        .from("catalog_items")
        .update({ image_url: bricksetImageUrl, updated_at: nowIso })
        .eq("id", catalogItemId);

      if (updImg.error) throw updImg.error;

      // 4b) overwrite minifig connections
      const minifigs = Array.isArray(set?.minifigs) ? set.minifigs : [];

      // wipe existing connections for this set/item
      const delLinks = await supabase
        .from(SET_MINIFIGS_TABLE)
        .delete()
        .eq(SET_MINIFIGS_COL_SET_ID, catalogItemId);

      if (delLinks.error) throw delLinks.error;

      if (minifigs.length) {
        // Upsert minifigs into master table
        // We assume MINIFIGS_COL_NUMBER is unique or has a unique index.
        const minifigUpserts = minifigs
          .map((m: any) => {
            const number = m?.minifigNumber ?? m?.number ?? null;
            return {
              [MINIFIGS_COL_NUMBER]: number,
              [MINIFIGS_COL_NAME]: m?.name ?? null,
              source: "brickset",
              source_key: number,
              updated_at: nowIso,
            };
          })
          .filter((r: any) => !!r[MINIFIGS_COL_NUMBER]);

        if (minifigUpserts.length) {
          const upM = await supabase
            .from(MINIFIGS_TABLE)
            .upsert(minifigUpserts, { onConflict: MINIFIGS_COL_NUMBER });

          if (upM.error) throw upM.error;
        }

        // Fetch IDs for the minifigs we just upserted (so we can write join rows)
        const nums = minifigUpserts.map((r: any) => r[MINIFIGS_COL_NUMBER]);
        const gotM = await supabase
          .from(MINIFIGS_TABLE)
          .select(`${MINIFIGS_COL_ID},${MINIFIGS_COL_NUMBER}`)
          .in(MINIFIGS_COL_NUMBER, nums);

        if (gotM.error) throw gotM.error;

        const idByNumber = new Map<string, string>();
        for (const row of (gotM.data ?? []) as any[]) {
          idByNumber.set(String(row[MINIFIGS_COL_NUMBER]), String(row[MINIFIGS_COL_ID]));
        }

        // Insert join rows
        const linkRows = minifigs
          .map((m: any) => {
            const number = String(m?.minifigNumber ?? m?.number ?? "").trim();
            const minifigId = idByNumber.get(number);
            if (!minifigId) return null;

            return {
              [SET_MINIFIGS_COL_SET_ID]: catalogItemId,
              [SET_MINIFIGS_COL_MINIFIG_ID]: minifigId,
              [SET_MINIFIGS_COL_QTY]: m?.quantity ?? 1,
              source: "brickset",
              source_key: `${setNumber}::${number}`,
              created_at: nowIso,
            };
          })
          .filter(Boolean) as any[];

        if (linkRows.length) {
          const insLinks = await supabase.from(SET_MINIFIGS_TABLE).insert(linkRows);
          if (insLinks.error) throw insLinks.error;
        }

        // Optional: minifig photos if Brickset provides an image per minifig
        const photoRows = minifigs
          .map((m: any) => {
            const number = String(m?.minifigNumber ?? m?.number ?? "").trim();
            const minifigId = idByNumber.get(number);
            const url = m?.image?.imageURL || m?.imageURL || null;
            if (!minifigId || !url) return null;

            return {
              [MINIFIG_PHOTOS_COL_MINIFIG_ID]: minifigId,
              [MINIFIG_PHOTOS_COL_URL]: url,
              ...(MINIFIG_PHOTOS_COL_SOURCE
                ? { [MINIFIG_PHOTOS_COL_SOURCE]: "brickset" }
                : {}),
              created_at: nowIso,
            };
          })
          .filter(Boolean) as any[];

        if (photoRows.length) {
          const insPhotos = await supabase.from(MINIFIG_PHOTOS_TABLE).insert(photoRows);
          if (insPhotos.error) throw insPhotos.error;
        }
      }
    }

    // 5) Mark suggestion approved
    const updSug = await supabase
      .from("catalog_item_suggestions")
      .update({
        status: "approved",
        reviewed_by_user_id,
        reviewed_at: nowIso,
        approved_catalog_item_id: catalogItemId,
      })
      .eq("id", id);

    if (updSug.error) throw updSug.error;

    return NextResponse.json({ ok: true, catalog_item_id: catalogItemId }, { status: 200 });
  } catch (e: any) {
    console.error("Publish failed:", e);
    return NextResponse.json({ error: e?.message || "Publish failed" }, { status: 502 });
  }
}
