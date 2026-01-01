import "dotenv/config";
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env var: ${name}`);
  return String(v).trim();
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Brickset v3 is a SOAP/asmx endpoint but returns JSON payload strings.
// We call it via POST form fields.
const BRICKSET_ENDPOINT = "https://brickset.com/api/v3.asmx";

async function bricksetCall(method: string, params: Record<string, any>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));

  const res = await fetch(`${BRICKSET_ENDPOINT}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`Brickset ${method} HTTP ${res.status}`);

  const text = await res.text();

  // SOAP-ish wrapper contains a JSON string field like:
  // <getSetsResult>{"status":"success","matches":...}</getSetsResult>
  const open = `<${method}Result>`;
  const close = `</${method}Result>`;
  const i = text.indexOf(open);
  const j = text.indexOf(close);
  if (i === -1 || j === -1) throw new Error(`Unexpected response parsing ${method}`);
  const jsonStr = text.slice(i + open.length, j);

  const parsed = JSON.parse(jsonStr);
  if (parsed?.status !== "success") {
    throw new Error(`Brickset ${method} failed: ${parsed?.message || "unknown error"}`);
  }
  return parsed;
}

async function loginAndGetUserHash(apiKey: string, username: string, password: string) {
  const out = await bricksetCall("login", { apiKey, username, password });
  return out.hash as string;
}

async function run() {
  const SUPABASE_URL = requireEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const BRICKSET_API_KEY = requireEnv("BRICKSET_API_KEY");
  const BRICKSET_USERNAME = requireEnv("BRICKSET_USERNAME");
  const BRICKSET_PASSWORD = requireEnv("BRICKSET_PASSWORD");

  const LEGO_CATEGORY_ID = requireEnv("LEGO_CATEGORY_ID");
  const LEGO_FRANCHISE_ID = (process.env.LEGO_FRANCHISE_ID || "").trim() || null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const userHash = await loginAndGetUserHash(BRICKSET_API_KEY, BRICKSET_USERNAME, BRICKSET_PASSWORD);

  // Example: import by year (start small)
  const year = 1999;

  const setsResp = await bricksetCall("getSets", {
    apiKey: BRICKSET_API_KEY,
    userHash,
    params: JSON.stringify({ year }), // Brickset expects "params" JSON for getSets
  });

  const sets: any[] = setsResp?.sets || [];
  console.log(`Brickset: got ${sets.length} sets for year ${year}`);

  const rows = sets.map((s) => {
    const setNumber = String(s.number || "").trim();
    const setVariant = String(s.numberVariant ?? "").trim();
    const setNumFull = setVariant ? `${setNumber}-${setVariant}` : setNumber;

    const name = `${setNumFull} ${String(s.name || "").trim()}`.trim();

    // Stable identity for LEGO set
    const externalFingerprint = sha256(`brickset|set|${setNumFull}`.toLowerCase());

    return {
      category_id: LEGO_CATEGORY_ID,
      franchise_id: LEGO_FRANCHISE_ID,

      name,
      release_year: Number(s.year) || null,
      kind: "lego",
      production_status: "released",

      external_fingerprint: externalFingerprint,

      meta: {
        type: "lego_set",
        source: "brickset",
        brickset_setID: s.setID,
        set_number: setNumFull,
        name: s.name,
        theme: s.theme,
        subtheme: s.subtheme,
        pieces: s.pieces,
        minifigs: s.minifigs,
        image: s.image?.imageURL || s.image?.thumbnailURL || null,
        released: s.year,
        availability: s.availability,
        packagingType: s.packagingType,
      },
    };
  });

  // Upsert by external_fingerprint
  const { error } = await supabase.from("catalog_items").upsert(rows, { onConflict: "external_fingerprint" });
  if (error) throw error;

  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
