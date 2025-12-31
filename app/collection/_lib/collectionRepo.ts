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

/** 0–100 -> 1–10 (display only) */
function score100ToTier10(score100: any, fallbackTier10 = 8) {
  const n = Number(score100);
  if (!Number.isFinite(n)) return clamp1to10(fallbackTier10);
  const t = Math.round(Math.max(0, Math.min(100, n)) / 10);
  return clamp1to10(t);
}

/**
 * Parse graded condition from NEW schema (condition_json.data.*)
 * Fallback to legacy row columns if they exist.
 */
function parseGradedFromRow(row: any): ConditionInfo | null {
  // ---- NEW SCHEMA ----
  const obj = tryParseJSON(row?.condition_json);
  const data = obj?.data ?? null;

  const isGraded = !!(data?.is_graded ?? data?.isGraded ?? data?.graded);
  if (isGraded) {
    const companyRaw =
      typeof data?.grading_company === "string"
        ? data.grading_company
        : typeof data?.gradingCompany === "string"
          ? data.gradingCompany
          : "";
    const company = String(companyRaw ?? "").trim();

    const gradeValueRaw = data?.grade_value ?? data?.gradeValue ?? data?.grade ?? null;
    const gradeValueText =
      gradeValueRaw !== null && gradeValueRaw !== undefined && gradeValueRaw !== ""
        ? String(gradeValueRaw).trim()
        : "";

    const labelRaw =
      typeof data?.grade_label === "string"
        ? data.grade_label
        : typeof data?.gradeLabel === "string"
          ? data.gradeLabel
          : "";

    // We keep the old ConditionInfo shape: company + grade string
    const gradeText =
      labelRaw.trim().length
        ? labelRaw.trim()
        : company && gradeValueText
          ? `${company} ${gradeValueText}`
          : gradeValueText
            ? `Graded ${gradeValueText}`
            : "Graded";

    return { mode: "graded", graded: { company, grade: gradeText } };
  }

  // ---- LEGACY COLUMNS (keep for now) ----
  if (!!row?.graded) {
    const g = String(row?.grade ?? "").trim();
    if (!g) return { mode: "graded", graded: { company: "", grade: "Graded" } };

    const upper = g.toUpperCase();
    const known = ["PSA", "BGS", "CGC", "SGC", "ACE", "TAG"];
    const hit = known.find((k) => upper.startsWith(k + " "));
    if (hit) return { mode: "graded", graded: { company: hit, grade: g.slice(hit.length).trim() } };

    return { mode: "graded", graded: { company: "", grade: g } };
  }

  return null;
}

/**
 * Legacy LEGO fallback: if you still have old JSON with building_blocks.box.score etc.
 * This is ONLY for old rows while migrating.
 */
function legacyBuildingBlocksToTier10(condition_json: any): number | null {
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

/**
 * Main mapping: use condition_score (0–100) if present, otherwise fallback to parsing JSON.
 * Output: ConditionInfo uses 1–10 for display.
 */
function mapConditionFromRow(row: any): ConditionInfo {
  // 1) graded (new schema or legacy columns)
  const gradedInfo = parseGradedFromRow(row);
  if (gradedInfo) return gradedInfo;

  // 2) preferred: condition_score (0–100) column
  const score100 = row?.condition_score ?? row?.conditionScore ?? null;
  if (score100 !== null && score100 !== undefined && score100 !== "") {
    return { mode: "raw", raw: { score: score100ToTier10(score100, 8) } };
  }

  // 3) legacy building_blocks JSON fallback
  const bbTier = legacyBuildingBlocksToTier10(row?.condition_json);
  if (bbTier != null) return { mode: "raw", raw: { score: bbTier } };

  // 4) direct JSON fallback (old shapes)
  const obj = tryParseJSON(row?.condition_json);
  const direct =
    obj?.score ??
    obj?.conditionScore ??
    obj?.condition_score ??
    obj?.raw?.score ??
    obj?.data?.tier10 ??
    null;

  if (direct != null) return { mode: "raw", raw: { score: clamp1to10(direct) } };

  return { mode: "unknown" };
}

function pickRepresentativeCondition(copies: any[]): ConditionInfo {
  const sorted = [...copies].sort((a, b) =>
    String(a.created_at ?? "") > String(b.created_at ?? "") ? -1 : 1
  );

  // Prefer graded copy if any
  const gradedRow = sorted.find((r) => {
    const obj = tryParseJSON((r as any)?.condition_json);
    const data = obj?.data ?? null;
    const isGraded = !!(data?.is_graded ?? data?.isGraded ?? data?.graded);
    return isGraded || (!!(r as any)?.graded && String((r as any)?.grade ?? "").trim().length > 0);
  });

  if (gradedRow) return mapConditionFromRow(gradedRow);

  return sorted[0] ? mapConditionFromRow(sorted[0]) : { mode: "unknown" };
}

function sumQuantity(rows: any[]): number {
  let n = 0;
  for (const r of rows) {
    const q = Number((r as any)?.quantity);
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

/**
 * We try the newest schema first (condition_score present),
 * then fall back to older selects.
 */
async function safeSelectCopies() {
  // New schema: includes condition_score
  const res1 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json,condition_score,for_sale,graded,grade")
    .order("created_at", { ascending: false });

  if (!res1.error) return res1;

  // Old schema without condition_score
  const res2 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json,for_sale,graded,grade")
    .order("created_at", { ascending: false });

  if (!res2.error) return res2;

  // Oldest schema (no for_sale/graded/grade)
  const res3 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json")
    .order("created_at", { ascending: false });

  return res3;
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
    const k = (c as any).catalog_item_id;
    if (!k) continue;
    const arr = byCatalogItem.get(k) ?? [];
    arr.push(c);
    byCatalogItem.set(k, arr);
  }

  const catalogItemIds = Array.from(byCatalogItem.keys());
  const copyIds = copies.map((c: any) => c.id);

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

  // 4) pull minifigs from user_collection_item_minifigs
  // Only included=true count towards “owned minifigs”.
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

      const displayName = nm || num ? `${nm || "Minifig"}${num ? ` (${num})` : ""}` : "Minifig";

      return {
        entity: "minifig",
        catalogItemId: mid,
        href: `/minifigs/${mid}`, // change if route differs
        name: displayName,
        photoUrl: mf?.image_url ?? null,
        copiesCount: minifigQty.get(mid) ?? 0,
        condition: { mode: "unknown" },
        kind: "minifig",
        forSale: null,
      };
    });
  }

  // 5) combine + sort
  const combined = [...itemCards, ...minifigCards].sort((a, b) => a.name.localeCompare(b.name));
  return combined;
}
