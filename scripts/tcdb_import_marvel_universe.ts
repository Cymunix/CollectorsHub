import "dotenv/config";
import pLimit from "p-limit";
import * as crypto from "crypto";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

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

function fingerprintKey(r: Pick<CardRow, "franchise" | "set_name" | "release_year" | "subset" | "card_number">) {
  const key = `${r.franchise}|${r.set_name}|${r.release_year}|${r.subset}|${r.card_number}`.toLowerCase();
  return crypto.createHash("sha256").update(key).digest("hex");
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
      raw: { source_page: pageUrl, headers },
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

async function run() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  await ensureSource(supabase);

  // 🔥 Paste real TCDB checklist URLs here
  const targets: Target[] = [
    // { year: 1990, subset: "Base", url: "PASTE_TCDB_CHECKLIST_URL_HERE" },
    // { year: 1990, subset: "Hologram", url: "PASTE_TCDB_HOLOGRAM_URL_HERE" },
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

    const externalRows = batch.map((r) => ({
      source_code: "tcdb",
      external_id: r.external_id,
      external_url: r.external_url,
      raw_payload: r.raw,
      fingerprint: fingerprintKey(r),
    }));

    const catalogRows = batch.map((r) => ({
      franchise: r.franchise,
      set_name: r.set_name,
      release_year: r.release_year,
      subset: r.subset,
      card_number: r.card_number,
      card_name: r.card_name,
      name: `${r.release_year} ${r.set_name} — #${r.card_number} ${r.card_name} (${r.subset})`,
      kind: "card",
    }));

    const ex = await supabase.from("external_items").upsert(externalRows, { onConflict: "fingerprint" });
    if (ex.error) throw ex.error;

    const cat = await supabase
      .from("catalog_items")
      .upsert(catalogRows, { onConflict: "franchise,set_name,release_year,subset,card_number" });
    if (cat.error) throw cat.error;

    console.log(`Upserted batch ${i / BATCH + 1} (${batch.length} rows)`);
  }

  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
