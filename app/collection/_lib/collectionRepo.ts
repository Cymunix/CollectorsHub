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

function uniq(flags: string[]) {
  return Array.from(new Set((flags || []).map(String).filter(Boolean)));
}

function toStatusFromLegacyState(stateRaw: any, flags: string[]): ConditionStatus {
  const s = String(stateRaw ?? "").toLowerCase().trim();

  if (flags.includes("for_parts") || s.includes("for_parts")) return "for_parts";
  if (flags.some((f) => f.toLowerCase().startsWith("graded:")) || s === "graded") return "graded";
  if (s === "sealed" || s.includes("sealed")) return "sealed";
  if (s.includes("incomplete")) return "incomplete";

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
 * Legacy LEGO fallback for numeric score ONLY (used only if present).
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
 * ✅ Read meta from:
 * - condition_meta jsonb column (primary)
 * - legacy columns
 * - condition_json blobs
 */
function normalizeMetaFromRow(row: any): ConditionMeta | null {
  // PRIMARY: condition_meta jsonb column (your screenshot)
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

  // Legacy explicit columns
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

  // condition_json meta
  const obj = tryParseJSON(row?.condition_json);
  const data = obj?.data ?? obj ?? null;

  const m = data?.condition_meta ?? data?.conditionMeta ?? null;
  if (m && typeof m === "object") {
    const flags = uniq(Array.isArray((m as any).flags) ? (m as any).flags.map(String) : []);
    const statusRaw = (m as any).status ?? (m as any).state ?? null;
    if (statusRaw) {
      const status = String(statusRaw).toLowerCase().trim() as any;
      return { status, flags };
    }
  }

  if (data?.status || data?.flags) {
    const flags = uniq(Array.isArray(data?.flags) ? data.flags.map(String) : []);
    const status = String(data?.status ?? "complete").toLowerCase().trim() as any;
    return { status, flags };
  }

  return null;
}

/**
 * Main mapping:
 * - meta.status stays status (NO numeric mapping)
 * - numeric score ONLY used when you actually have it
 */
function mapConditionFromRow(row: any): ConditionInfo {
  // 1) graded
  const gradedInfo = parseGradedFromRow(row);
  if (gradedInfo) return gradedInfo;

  // 2) meta -> raw.status (no score)
  const meta = normalizeMetaFromRow(row);
  if (meta) {
    return {
      mode: "raw",
      raw: {
        status: meta.status,
        flags: meta.flags,
      },
    } as any;
  }

  // 3) numeric score from condition_score ONLY if present
  const score100 = row?.condition_score ?? row?.conditionScore ?? null;
  if (score100 !== null && score100 !== undefined && score100 !== "") {
    // convert to tier10 because UI expects 1–10 if score is present
    const n = Number(score100);
    const tier10 = Number.isFinite(n) ? clamp1to10(Math.round(Math.max(0, Math.min(100, n)) / 10)) : 8;
    return { mode: "raw", raw: { score: tier10 } };
  }

  // 4) legacy numeric sources ONLY if present
  const bbTier = legacyBuildingBlocksToTier10(row?.condition_json);
  if (bbTier != null) return { mode: "raw", raw: { score: bbTier } };

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
  // ✅ include condition_meta (jsonb)
  const res0 = await supabase
    .from(TABLE_COPIES)
    .select(
      "id,catalog_item_id,created_at,quantity,condition_json,condition_score,condition_meta,condition_state,condition_grade,condition_flags,for_sale,graded,grade"
    )
    .order("created_at", { ascending: false });

  if (!res0.error) return res0;

  const res1 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json,condition_score,condition_meta,for_sale,graded,grade")
    .order("created_at", { ascending: false });

  if (!res1.error) return res1;

  const res2 = await supabase
    .from(TABLE_COPIES)
    .select(
      "id,catalog_item_id,created_at,quantity,condition_json,condition_score,condition_state,condition_grade,condition_flags,for_sale,graded,grade"
    )
    .order("created_at", { ascending: false });

  if (!res2.error) return res2;

  const res3 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json,condition_score,for_sale,graded,grade")
    .order("created_at", { ascending: false });

  if (!res3.error) return res3;

  const res4 = await supabase
    .from(TABLE_COPIES)
    .select("id,catalog_item_id,created_at,quantity,condition_json,for_sale,graded,grade")
    .order("created_at", { ascending: false });

  if (!res4.error) return res4;

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
  const copiesRes = await safeSelectCopies();
  if (copiesRes.error) throw new Error(copiesRes.error.message);

  const copies = (copiesRes.data ?? []) as CollectionCopyRow[];
  if (copies.length === 0) return [];

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

  const catalogRes = await safeSelectCatalog(catalogItemIds);
  if (catalogRes.error) throw new Error(catalogRes.error.message);

  const catalogRows = (catalogRes.data ?? []) as CatalogItemRow[];
  const catalogMap = new Map<string, CatalogItemRow>();
  for (const r of catalogRows) catalogMap.set(r.id, r);

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

  const ucimRes = await supabase
    .from(TABLE_UCIM)
    .select("id,user_collection_item_id,minifig_id,included,included_qty,created_at")
    .in("user_collection_item_id", copyIds);

  if (ucimRes.error) throw new Error(ucimRes.error.message);

  const ucimRows = (ucimRes.data ?? []) as CollectionItemMinifigRow[];

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

  return [...itemCards, ...minifigCards].sort((a, b) => a.name.localeCompare(b.name));
}
