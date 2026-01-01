// scripts/tcdb_import_marvel_universe.ts
import "dotenv/config";
import pLimit from "p-limit";
import * as crypto from "crypto";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

/**
 * ENV REQUIRED:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TRADING_CARDS_CATEGORY_ID   (UUID)
 *   MARVEL_FRANCHISE_ID         (UUID)
 *
 * ENV OPTIONAL:
 *   TRADING_CARDS_SUBCATEGORY_ID (UUID)
 *
 * Run:
 *   npx ts-node scripts/tcdb_import_marvel_universe.ts
 */

type Target = { year: number; subset: string; url: string };

type CardRow = {
  franchise: "Marvel";
  set_name: "Marvel Universe";
  release_year: number;
  subset: string;
  card_number: string;
  card_name: string;
  external_url: string;
  external_id: string | null;
  raw: Record<string, any>;
};

function normSpace(s: string) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function normSubset(s: string) {
  const t = normSpace(s).toLowerCase();
  if (!t) return "Base";
  if (t.includes("holog")) return "Hologram";
  if (t.includes("promo")) return "Promo";
  if (t.includes("suspended")) return "Suspended Animation";
  if (t.includes("checklist")) return "Checklist";
  return normSpace(s);
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Fingerprint is the stable identity for dedupe across imports.
 * Use fields that won't change (set/year/subset/number).
 */
function fingerprintKey(r: Pick<CardRow, "franchise" | "set_name" | "release_year" | "subset" | "card_number">) {
  const key = `${r.franchise}|${r.set_name}|${r.release_year}|${r.subset}|${r.card_number}`.toLowerCase();
  return sha256(key);
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "CollectorsHubBot/0.1 (metadata import)",
      accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

/**
 * Parse a TCDB checklist page into CardRow[].
 * Heuristic: find a table containing "Card Number" and "Name" (or "Player").
 */
function parseChecklistPage(html: string, pageUrl: string, year: number, subsetLabel: string): CardRow[] {
  const $ = cheerio.load(html);

  let targetTable: cheerio.Cheerio | null = null;

  $("table").each((_, el) => {
    const text = normSpace($(el).text()).toLowerCase();
    if (text.includes("card number") && (text.includes("name") || text.includes("player"))) {
      targetTable = $(el);
      return false;
    }
  });

  if (!targetTable) return [];

  const headerCells = targetTable.find("tr").first().find("th,td");
  const headers: string[] = [];
  headerCells.each((_, h) => headers.push(normSpace($(h).text()).toLowerCase()));

  const idxCardNo = headers.findIndex((h) => h.includes("card") && h.includes("number"));
  const idxName = headers.findIndex((h) => h === "name" || h.includes("name") || h.includes("player"));

  const rows: CardRow[] = [];

  targetTable.find("tr").slice(1).each((_, tr) => {
    const cells = $(tr).find("td");
    if (!cells.length) return;

    const cardNo = normSpace(idxCardNo >= 0 ? $(cells[idxCardNo]).text() : $(cells[0]).text());
    const name = normSpace(idxName >= 0 ? $(cells[idxName]).text() : $(cells[1]).text());
    if (!cardNo || !name) return;

    // Try to grab a card detail link as external_id
    let linkHref: string | null = null;
    $(tr)
      .find("a")
      .each((_, a) => {
        const href = $(a).attr("href");
        if (href && href.toLowerCase().includes("viewcard.cfm")) linkHref = href;
      });

    const externalUrl = linkHref ? new URL(linkHref, pageUrl).toString() : pageUrl;
    const externalId = linkHref ? new URL(externalUrl).searchParams.get("cardid") : null;

    rows.push({
      franchise: "Marvel",
      set_name: "Marvel Universe",
      release_year: year,
      subset: normSubset(subsetLabel),
      card_number: cardNo,
      card_name: name,
      external_url: externalUrl,
      external_id: externalId,
      raw: {
        source_page: pageUrl,
        headers,
      },
    });
  });

  return rows;
}

async function ensureSource(supabase: any) {
  const { error } = await supabase
    .from("external_sources")
    .upsert({ code: "tcdb", name: "Trading Card Database", base_url: "https://www.tcdb.com" }, { onConflict: "code" });
  if (error) throw error;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env var: ${name}`);
  return String(v).trim();
}

async function run() {
  const SUPABASE_URL = requireEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const CATEGORY_ID_TRADING_CARDS = requireEnv("TRADING_CARDS_CATEGORY_ID");
  const FRANCHISE_ID_MARVEL = requireEnv("MARVEL_FRANCHISE_ID");
  const SUBCATEGORY_ID_OPTIONAL = (process.env.TRADING_CARDS_SUBCATEGORY_ID || "").trim() || null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  await ensureSource(supabase);

  /**
   * IMPORTANT:
   * Paste real TCDB checklist URLs here.
   * Start with 1 URL, verify "parsed N rows", then add more.
   */
  const targets: Target[] = [
    // Example placeholders — replace with real TCDB checklist URLs:
    // { year: 1990, subset: "Base", url: "https://www.tcdb.com/Checklist.cfm/sid/XXXX/1990-Marvel-Universe" },
    // { year: 1990, subset: "Hologram", url: "https://www.tcdb.com/Checklist.cfm/sid/YYYY/1990-Marvel-Universe-Holograms" },
  ];

  if (!targets.length) {
    console.log("No targets set. Paste TCDB checklist URLs into targets[] first.");
    process.exit(1);
  }

  const limit = pLimit(2);
  const all: CardRow[] = [];

  for (const t of targets) {
    const html = await limit(async () => await fetchHtml(t.url))();
    const rows = parseChecklistPage(html, t.url, t.year, t.subset);
    console.log(`${t.year} ${t.subset}: parsed ${rows.length} rows`);
    all.push(...rows);
  }

  // Dedupe by fingerprint
  const seen = new Map<string, CardRow>();
  for (const r of all) {
    const fp = fingerprintKey(r);
    if (!seen.has(fp)) seen.set(fp, r);
  }
  const unique = Array.from(seen.values());
  console.log(`Total unique: ${unique.length}`);

  // Write in batches
  const BATCH = 250;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);

    // 1) external_items (raw + dedupe)
    const externalRows = batch.map((r) => ({
      source_code: "tcdb",
      external_id: r.external_id,
      external_url: r.external_url,
      raw_payload: {
        ...r.raw,
        parsed: {
          franchise: r.franchise,
          set_name: r.set_name,
          release_year: r.release_year,
          subset: r.subset,
          card_number: r.card_number,
          card_name: r.card_name,
        },
      },
      fingerprint: fingerprintKey(r),
    }));

    // 2) catalog_items (THIS is what your app actually uses)
    const catalogRows = batch.map((r) => {
      const displayName = `${r.release_year} ${r.set_name} — #${r.card_number} ${r.card_name} (${r.subset})`;
      const fp = fingerprintKey(r);

      return {
        category_id: CATEGORY_ID_TRADING_CARDS,
        subcategory_id: SUBCATEGORY_ID_OPTIONAL,
        franchise_id: FRANCHISE_ID_MARVEL,

        name: displayName,
        release_year: r.release_year,

        // Optional: useful for quick filtering without digging into meta
        version: r.subset,

        kind: "card",
        production_status: "released",

        meta: {
          type: "trading_card",
          set_name: r.set_name,
          release_year: r.release_year,
          subset: r.subset,
          card_number: r.card_number,
          card_name: r.card_name,
          manufacturer: "Impel",
          source: "tcdb",
          tcdb_external_id: r.external_id,
          tcdb_url: r.external_url,
          tcdb_fingerprint: fp,
        },
      };
    });

    // Upsert external rows (dedupe by fingerprint)
    const ex = await supabase.from("external_items").upsert(externalRows, { onConflict: "fingerprint" });
    if (ex.error) throw ex.error;

    // Upsert catalog rows:
    // NOTE: Your catalog_items needs a UNIQUE index matching this conflict target.
    // Recommended: (franchise_id, release_year, kind, name)
    const cat = await supabase
      .from("catalog_items")
      .upsert(catalogRows, { onConflict: "franchise_id,release_year,kind,name" });
    if (cat.error) throw cat.error;

    console.log(`Upserted batch ${i / BATCH + 1} (${batch.length} rows)`);
  }

  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
