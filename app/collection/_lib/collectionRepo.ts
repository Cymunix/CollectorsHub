// app/collection/_lib/collectionRepo.ts
import { supabase } from "@/lib/supabaseClient";
import type {
  CollectionCardModel,
  ConditionInfo,
  CollectionCopyRow,
  CatalogItemRow,
  CollectionItemMinifigRow,
  CatalogMinifigRow,
} from "./types";
import { clamp1to10 } from "./formatters";

const TABLE_COPIES = "user_collection_items";
const TABLE_CATALOG = "catalog_items";
const TABLE_UCIM = "user_collection_item_minifigs";
const TABLE_MINIFIGS = "catalog_minifigs";

/* -------------------- condition helpers -------------------- */

function tryParseJSON(v: any): any | null {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function parseGraded(graded: boolean | null, grade: string | null): ConditionInfo | null {
  if (!graded) return null;

  const g = String(grade ?? "").trim();
  if (!g) return { mode: "graded", graded: { company: "", grade: "Graded" } };

  const upper = g.toUpperCase();
  const known = ["PSA", "BGS", "CGC", "SGC", "ACE", "TAG"];
  const hit = known.find((k) => upper.startsWith(k + " "));
  if (hit) return { mode: "graded", graded: { company: hit, grade: g.slice(hit.length).trim() } };

  return { mode: "graded", graded: { company: "", grade: g } };
}

function buildingBlocksToRawScore(condition_json: any): number | null {
  const obj = tryParseJSON(condition_json);
  const bb = obj?.building_blocks;
  if (!bb || typeof bb !== "object") return null;

  const scores: number[] = [];
  const boxScore = bb?.box?.score;
  const instScore = bb?.instructions?.score;

  if (Number.isFinite(Number(boxScore))) scores.push(Number(boxScore));
  if (Number.isFinite(Number(instScore))) scores.push(Number(instScore));

  if (scores.length === 0) return null;

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return clamp1to10(avg);
}

function mapConditionFromRow(row: any): ConditionInfo {
  const gradedInfo = parseGraded(row.graded ?? null, row.grade ?? null);
  if (gradedInfo) return gradedInfo;

  const bbScore = buildingBlocksToRawScore(row.condition_json);
  if (bbScore != null) return { mode: "raw", raw: { score: bbScore } };

  const obj = tryParseJSON(row.condition_json);
  const directScore =
    obj?.score ?? obj?.conditionScore ?? obj?.condition_score ?? obj?.raw?.score ?? null;

  if (directScore != null) return { mode: "raw", raw: { score: clamp1to10(directScore) } };

  return { mode: "unknown" };
}

function pickRepresentativeCondition(copies: any[]): ConditionInfo {
  const sorted = [...copies].sort((a, b) =>
    String(a.created_at ?? "") > String(b.created_at ?? "") ? -1 : 1
  );

  const gradedRow = sorted.find((r) => !!r.graded && String(r.grade ?? "").trim().length > 0);
  if (gradedRow) return mapConditionFromRow(gradedRow);

  return sorted[0] ? mapConditionFromRow(sorted[0]) : { mode: "unknown" };
}

function sumQuantity(rows: any[]): number {
  let n = 0;
  for (const r of rows) {
    const q = Number(r.quantity);
    n += Number.isFinite(q) && q > 0 ? q : 1;
  }
  return n;
}

function computeForSale(rows: any[]): boolean | null {
  let seenAny = false;
  for (const r of rows) {
    if (typeof (r as any)?.for_sale === "boolean") {
      seenAny = true;
      if ((r as any).for_sale) return true;
    }
  }
  return seenAny ? false : null;
}

/* -------------------- safe selects -------------------- */

async function safeSelectCopies() {
  const res1 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,graded,grade,quantity,condition_json,for_sale")
    .order("created_at", { ascending: false });

  if (!res1.error) return res1;

  const res2 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,graded,grade,quantity,condition_json")
    .order("created_at", { ascending: false });

  return res2;
}

async function safeSelectCatalog(catalogItemIds: string[]) {
  const res1 = await supabase.from(TABLE_CATALOG).select("id,name,image_url,kind").in("id", catalogItemIds);
  if (!res1.error) return res1;

  const res2 = await supabase.from(TABLE_CATALOG).select("id,name,image_url").in("id", catalogItemIds);
  return res2;
}

/* -------------------- main loader -------------------- */

export async function loadCollectionCards(): Promise<CollectionCardModel[]> {
  // 1) copies (user_collection_items)
  const copiesRes = await safeSelectCopies();
  if (copiesRes.error) throw new Error(copiesRes.error.message);

  const copies = (copiesRes.data ?? []) as CollectionCopyRow[];
  if (copies.length === 0) return [];

  // group copies by catalog_item_id
  const byCatalogItem = new Map<string, any[]>();
  for (const c of copies as any[]) {
    const k = c.catalog_item_id;
    if (!k) continue;
    const arr = byCatalogItem.get(k) ?? [];
    arr.push(c);
    byCatalogItem.set(k, arr);
  }

  const catalogItemIds = Array.from(byCatalogItem.keys());
  const copyIds = copies.map((c) => c.id);

  // 2) catalog_items for names/photos (+kind if exists)
  const catalogRes = await safeSelectCatalog(catalogItemIds);
  if (catalogRes.error) throw new Error(catalogRes.error.message);

  const catalogRows = (catalogRes.data ?? []) as CatalogItemRow[];
  const catalogMap = new Map<string, CatalogItemRow>();
  for (const r of catalogRows) catalogMap.set(r.id, r);

  // 3) build main item cards
  const itemCards: CollectionCardModel[] = catalogItemIds.map((id) => {
    const item = catalogMap.get(id);
    const rows = byCatalogItem.get(id) ?? [];
    const kind = (item as any)?.kind ?? null;

    return {
      entity: "catalog_item",
      catalogItemId: id,
      href: `/collection/${id}`,
      name: item?.name ?? "Unknown Item",
      photoUrl: item?.image_url ?? null,
      copiesCount: sumQuantity(rows),
      condition: pickRepresentativeCondition(rows),
      kind,
      forSale: computeForSale(rows),
    };
  });

  // 4) pull minifigs from user_collection_item_minifigs (THIS is what you asked for)
  // Only minifigs that are included=true count towards “owned minifigs” here.
  const ucimRes = await supabase
    .from(TABLE_UCIM)
    .select("id,user_collection_item_id,minifig_id,included,included_qty,created_at")
    .in("user_collection_item_id", copyIds);

  if (ucimRes.error) throw new Error(ucimRes.error.message);

  const ucimRows = (ucimRes.data ?? []) as CollectionItemMinifigRow[];

  // aggregate qty by minifig_id
  const minifigQty = new Map<string, number>();
  for (const r of ucimRows as any[]) {
    if (!r?.minifig_id) continue;
    if (r?.included === false) continue;

    const qRaw = Number(r?.included_qty);
    const q = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1;

    minifigQty.set(r.minifig_id, (minifigQty.get(r.minifig_id) ?? 0) + q);
  }

  const minifigIds = Array.from(minifigQty.keys());

  let minifigCards: CollectionCardModel[] = [];

  if (minifigIds.length > 0) {
    const mfRes = await supabase
      .from(TABLE_MINIFIGS)
      .select("id,name,minifig_number,image_url")
      .in("id", minifigIds);

    if (mfRes.error) throw new Error(mfRes.error.message);

    const mfRows = (mfRes.data ?? []) as CatalogMinifigRow[];
    const mfMap = new Map<string, CatalogMinifigRow>();
    for (const r of mfRows) mfMap.set(r.id, r);

    minifigCards = minifigIds.map((mid) => {
      const mf = mfMap.get(mid);
      const num = String(mf?.minifig_number ?? "").trim();
      const nm = String(mf?.name ?? "").trim();

      const displayName =
        nm || num ? `${nm || "Minifig"}${num ? ` (${num})` : ""}` : "Minifig";

      return {
        entity: "minifig",
        catalogItemId: mid,
        href: `/minifigs/${mid}`, // ✅ change this if your route differs
        name: displayName,
        photoUrl: mf?.image_url ?? null,
        copiesCount: minifigQty.get(mid) ?? 0,
        condition: { mode: "unknown" }, // minifigs don’t have copy-condition yet in this model
        kind: "minifig",
        forSale: null,
      };
    });
  }

  // 5) combine + sort
  const combined = [...itemCards, ...minifigCards].sort((a, b) => a.name.localeCompare(b.name));
  return combined;
}
