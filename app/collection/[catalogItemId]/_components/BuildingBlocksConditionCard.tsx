"use client";

import React, { useMemo } from "react";

/**
 * Building Blocks condition labels
 * (Do NOT use grading terms like Gem Mint)
 */
function getBuildingBlocksLabel(score: number): string {
  if (score >= 10) return "Sealed";
  if (score >= 9) return "Complete – Excellent";
  if (score >= 8) return "Complete – Very Good";
  if (score >= 7) return "Complete – Good";
  if (score >= 6) return "Mostly Complete";
  if (score >= 4) return "Incomplete";
  return "For Parts";
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * RULES:
 * - Sealed overrides everything → score = 10
 * - Sealed implies box included
 * - If sealed, internal condition is UNKNOWN (no stickers / grime / cracks / completeness)
 */
function computeBuildingBlocksScore(conditionJson: any): number | null {
  const bb = conditionJson?.building_blocks;
  if (!bb) return null;

  const type = String(bb?.type ?? "").toLowerCase().trim();
  if (type === "parts" || type === "for_parts" || type === "for parts") return 0;

  const sealed = bb?.sealed === true;
  if (sealed) return 10;

  const scores: number[] = [];

  const boxScore = toNum(bb?.box?.score);
  if (boxScore !== null) scores.push(boxScore);

  const stickerQuality = toNum(bb?.stickerQuality);
  if (stickerQuality !== null) scores.push(stickerQuality);

  let score = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 8;

  if (bb?.piecesComplete === false) score = Math.min(score, 5);
  if (bb?.grime === true) score -= 1;
  if (bb?.cracks === true) score -= 2;

  if (bb?.box?.included === false) score -= 1;

  return clamp(score, 0, 10);
}

export default function BuildingBlocksConditionCard({ conditionJson }: { conditionJson: any }) {
  const vm = useMemo(() => {
    const bb = conditionJson?.building_blocks ?? null;
    if (!bb) {
      return {
        score: null as number | null,
        label: "No condition set",
        tags: [] as Array<{ t: string; tone?: "bad" | "good" | "info" }>,
      };
    }

    const sealed = bb?.sealed === true;
    const score = computeBuildingBlocksScore(conditionJson);

    if (sealed) {
      const tags: Array<{ t: string; tone?: "bad" | "good" | "info" }> = [
        { t: "Sealed (box included)", tone: "good" },
      ];

      const boxScore = toNum(bb?.box?.score);
      if (boxScore !== null) tags.push({ t: `Box: ${boxScore}/10`, tone: "info" });

      return {
        score: 10,
        label: "Sealed",
        tags,
      };
    }

    if (score === null) {
      return {
        score: null,
        label: "No condition set",
        tags: [],
      };
    }

    const tags: Array<{ t: string; tone?: "bad" | "good" | "info" }> = [];

    if (bb?.piecesComplete === false) tags.push({ t: "Pieces incomplete", tone: "bad" });
    if (bb?.grime === true) tags.push({ t: "Grime", tone: "bad" });
    if (bb?.cracks === true) tags.push({ t: "Cracks", tone: "bad" });
    if (bb?.box?.included === false) tags.push({ t: "No box", tone: "bad" });

    const boxScore = toNum(bb?.box?.score);
    if (boxScore !== null) tags.push({ t: `Box: ${boxScore}/10`, tone: "info" });

    const stickerQuality = toNum(bb?.stickerQuality);
    if (stickerQuality !== null) tags.push({ t: `Stickers: ${stickerQuality}/10`, tone: "info" });

    return {
      score,
      label: getBuildingBlocksLabel(score),
      tags,
    };
  }, [conditionJson]);

  return (
    <div className="rounded-3xl border bg-white shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Set condition</div>
          <div className="text-xs text-gray-500">Completeness • box • wear</div>
        </div>
        <div className="text-sm font-semibold text-gray-900">{vm.label}</div>
      </div>

      {vm.score === null ? (
        <div className="mt-3 rounded-2xl border bg-gray-50 px-4 py-3 text-sm text-gray-600">
          No building blocks condition recorded.
        </div>
      ) : vm.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {vm.tags.map((x) => (
            <span
              key={x.t}
              className={[
                "text-xs rounded-full border px-2.5 py-1",
                x.tone === "good"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : x.tone === "bad"
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-slate-50 border-slate-200 text-slate-700",
              ].join(" ")}
            >
              {x.t}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-gray-500">No flags recorded.</div>
      )}
    </div>
  );
}
