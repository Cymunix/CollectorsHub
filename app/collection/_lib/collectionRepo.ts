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
import type { ConditionMeta, ConditionStatus } from "@/lib/pricingEngine";

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

function uniq(flags: string[]) {
  return Array.from(new Set((flags || []).map(String).filter(Boolean)));
}

function toStatusFromLegacyState(stateRaw: any, flags: string[]): ConditionStatus {
  const s = String(stateRaw ?? "").toLowerCase().trim();

  // flags win
  if (flags.includes("for_parts") || s.includes("for_parts")) return "for_parts";
  if (flags.some((f) => f.toLowerCase().startsWith("graded:")) || s === "graded") return "graded";
  if (s === "sealed" || s.includes("sealed")) return "sealed";

  // old states
  if (s.includes("incomplete")) return "incomplete";

  // open_complete, loose, empty -> treat as complete for meta
  return "complete";
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
 * ✅ Normalize whatever we have (condition_meta jsonb, legacy columns, meta blobs)
 * into pricingEngine ConditionMeta: { status, flags }
 */
function normalizeMetaFromRow(row: any): ConditionMeta | null {
  // ✅ FIRST: condition_meta jsonb column (your screenshot)
  // Expected: { "flags": [], "status": "complete" }
  const cm = row?.condition_meta ?? null;
  if (cm && typeof cm === "object") {
    const status = String((cm as any).status ?? "complete").toLowerCase().trim() as any;
    const flags = uniq(Array.isArray((cm as any).flags) ? (cm as any).flags.map(String) : []);
    return { status, flags };
  }
  const cmParsed = tryParseJSON(row?.condition_meta);
  if (cmParsed && typeof cmParsed === "object") {
    const status = String((cmParsed as any).status ?? "complete").toLowerCase().trim() as any;
    const flags = uniq(Array.isArray((cmParsed as any).flags) ? (cmParsed as any).flags.map(String) : []);
    return { status, flags };
  }

  // Legacy explicit columns (if you have them)
  const legacyState = row?.condition_state ?? null;
  const legacyGrade = row?.condition_grade ?? null;
  const legacyFlagsRaw = row?.condition_flags ?? null;

  const hasCols = legacyState || legacyGrade || legacyFlagsRaw;
  if (hasCols) {
    const flags = uniq(Array.isArray(legacyFlagsRaw) ? legacyFlagsRaw.map(String) : []);
    const gradeStr = String(legacyGrade ?? "").trim().toLowerCase();
    if (gradeStr) flags.push(`grade:${gradeStr}`);

    const status = toStatusFromLegacyState(legacyState, flags);
    return { status, flags: uniq(flags) };
  }

  // Otherwise try condition_json.data.condition_meta or conditionMeta
  const obj = tryParseJSON(row?.condition_json);
  const data = obj?.data ?? obj ?? null;

  const m = data?.condition_meta ?? data?.conditionMeta ?? null;
  if (m && typeof m === "object") {
    const flags = uniq(Array.isArray((m as any).flags) ? (m as any).flags.map(String) : []);

    // New shape inside meta already
    const statusRaw = (m as any).status ?? null;
    if (statusRaw) {
      const s = String(statusRaw).toLowerCase().trim();
      return { status: (s as any), flags };
    }

    // Legacy shape inside meta
    const st = (m as any).state ?? null;
    const gr = (m as any).grade ?? null;
    const gradeStr = String(gr ?? "").trim().toLowerCase();
    if (gradeStr) flags.push(`grade:${gradeStr}`);

    const status = toStatusFromLegacyState(st, flags);
    return { status, flags: uniq(flags) };
  }

  // If you store meta at top-level data (Path 2 simplified)
  if (data?.status || data?.flags) {
    const flags = uniq(Array.isArray(data?.flags) ? data.flags.map(String) : []);
    const status = String(data?.status ?? "complete").toLowerCase().trim() as any;
    return { status, flags };
  }

  // Legacy top-level data (state/grade/flags)
  if (data?.state || data?.grade || data?.flags) {
    const flags = uniq(Array.isArray(data?.flags) ? data.flags.map(String) : []);
    const gradeStr = String(data?.grade ?? "").trim().toLowerCase();
    if (gradeStr) flags.push(`grade:${gradeStr}`);

    const status = toStatusFromLegacyState(data?.state, flags);
    return { status, flags: uniq(flags) };
  }

  return null;
}

/**
 * Main mapping for Collection cards (DISPLAY ONLY):
 * - meta is {status, flags}, map it to a tier10 for display
 */
function metaToTier10(meta: ConditionMeta): number {
  const status = String(meta?.status ?? "").toLowerCase().trim();

  // If we preserved a legacy grade flag, use it
  const gradeFlag = (meta?.flags ?? []).find((f) => String(f).toLowerCase().startsWith("grade:"));
  const grade = gradeFlag ? String(gradeFlag.split(":")[1] ?? "").toLowerCase().trim() : "";

  const baseByGrade: Record<string, number> = {
    mint: 10,
    excellent: 9,
    good: 8,
    fair: 6,
    poor: 4,
  };

  let t = baseByGrade[grade] ?? 8;

  // Status nudges (simple + consistent)
  if (status === "sealed") t = Math.min(10, Math.max(t, 9));
  if (status === "complete") t = Math.max(1, t);
  if (status === "incomplete") t = Math.max(1, Math.min(t, 6));
  if (status === "for_parts") t = Math.max(1, Math.min(t, 3));
  if (status === "graded") t = Math.min(10, Math.max(t, 9));

  return clamp1to10(t);
}

function mapConditionFromRow(row: any): ConditionInfo {
  // 1) graded (new schema or legacy columns)
  const gradedInfo = parseGradedFromRow(row);
  if (gradedInfo) return gradedInfo;

  // 2) ✅ meta from condition_meta jsonb OR json blobs
  const meta = normalizeMetaFromRow(row);
  if (meta) {
    return { mode: "raw", raw: { score: metaToTier10(meta) } };
  }

  // 3) preferred: condition_score (0–100) column
  const score100 = row?.condition_score ?? row?.conditionScore ?? null;
  if (score100 !== null && score100 !== undefined && score100 !== "") {
    return { mode: "raw", raw: { score: score100ToTier10(score100, 8) } };
  }

  // 4) legacy building_blocks JSON fallback
  const bbTier = legacyBuildingBlocksToTier10(row?.condition_json);
  if (bbTier != null) return { mode: "raw", raw: { score: bbTier } };

  // 5) direct JSON fallback (old shapes)
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

async function safeSelectCopies() {
  // ✅ include condition_meta first (your real column)
  const res0 = await supabase
    .from(TABLE_COPIES)
    .select(
      "id,catalog_item_id,created_at,quantity,condition_json,condition_score,condition_meta,condition_state,condition_grade,condition_flags,for_sale,graded,grade"
    )
    .order("created_at", { ascending: false });

  if (!res0.error) return res0;

  // Schema with condition_meta but without legacy meta cols
  const res1 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json,condition_score,condition_meta,for_sale,graded,grade")
    .order("created_at", { ascending: false });

  if (!res1.error) return res1;

  // Schema without condition_meta but with legacy meta cols
  const res2 = await supabase
    .from(TABLE_COPIES)
    .select(
      "id,catalog_item_id,created_at,quantity,condition_json,condition_score,condition_state,condition_grade,condition_flags,for_sale,graded,grade"
    )
    .order("created_at", { ascending: false });

  if (!res2.error) return res2;

  // Schema without meta cols
  const res3 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json,condition_score,for_sale,graded,grade")
    .order("created_at", { ascending: false });

  if (!res3.error) return res3;

  // Old schema without condition_score
  const res4 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json,for_sale,graded,grade")
    .order("created_at", { ascending: false });

  if (!res4.error) return res4;

  // Oldest schema (no for_sale/graded/grade)
  const res5 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json")
    .order("created_at", { ascending: false });

  return res5;
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
      photoUrl: (item as any)?.image_url ?? null,
      copiesCount: sumQuantity(rows),
      condition: pickRepresentativeCondition(rows),
      kind,
      forSale: computeForSale(rows),
    };
  });

  // 4) pull minifigs from user_collection_item_minifigs
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
      const num = String((mf as any)?.minifig_number ?? "").trim();
      const nm = String((mf as any)?.name ?? "").trim();

      const displayName = nm || num ? `${nm || "Minifig"}${num ? ` (${num})` : ""}` : "Minifig";

      return {
        entity: "minifig",
        catalogItemId: mid,
        href: `/minifigs/${mid}`,
        name: displayName,
        photoUrl: (mf as any)?.image_url ?? null,
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
