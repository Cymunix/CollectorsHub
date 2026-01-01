"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fetchItemReviews, insertItemReview } from "../_lib/queries";

// ✅ derive the row type from the query function (no duplicate type drift)
type ReviewRow = Awaited<ReturnType<typeof fetchItemReviews>>[number];

function clampRating(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 5;
  return Math.max(1, Math.min(5, Math.round(x)));
}

function formatDateMaybe(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString();
}

export default function ReviewsTab({ catalogItemId }: { catalogItemId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);

  // add form
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchItemReviews(catalogItemId);
      setRows(data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId]);

  const avg = useMemo(() => {
    if (rows.length === 0) return null;
    const sum = rows.reduce((s, r) => s + (Number((r as any).rating) || 0), 0);
    return Math.round((sum / rows.length) * 10) / 10;
  }, [rows]);

  async function onSubmit() {
    setErr(null);
    setSavedMsg(null);

    const r = clampRating(rating);
    const t = title.trim();
    const b = body.trim();

    if (!b) {
      setErr("Write something in the review body.");
      return;
    }

    setSaving(true);
    try {
      await insertItemReview({
        catalog_item_id: catalogItemId,
        rating: r,
        title: t || null,
        body: b,
      });

      setTitle("");
      setBody("");
      setRating(5);
      setSavedMsg("Review added.");
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Reviews</div>
          <div className="text-sm text-gray-500">
            {avg ? (
              <>
                Average: <span className="font-medium text-gray-800">{avg}</span> / 5 • {rows.length} review
                {rows.length === 1 ? "" : "s"}
              </>
            ) : (
              "No reviews yet."
            )}
          </div>
        </div>
      </div>

      {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {savedMsg && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {savedMsg}
        </div>
      )}

      {/* Add review */}
      <div className="mt-4 rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Add a review</div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-xs text-gray-500">Rating</label>
            <select
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              <option value={5}>5 — Amazing</option>
              <option value={4}>4 — Good</option>
              <option value={3}>3 — Okay</option>
              <option value={2}>2 — Meh</option>
              <option value={1}>1 — Bad</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">Title (optional)</label>
            <input
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short headline"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs text-gray-500">Review</label>
            <textarea
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you like? What should people watch for?"
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium",
              saving ? "bg-gray-200 text-gray-600" : "bg-gray-900 text-white hover:bg-black",
            ].join(" ")}
          >
            {saving ? "Saving..." : "Post review"}
          </button>
        </div>
      </div>

      {/* Review list */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-20 rounded-2xl bg-gray-100" />
            <div className="h-20 rounded-2xl bg-gray-100" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-600">
            Be the first to review this item.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={(r as any).id} className="rounded-2xl border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stars n={clampRating((r as any).rating)} />
                    <div className="font-semibold">
                      {(r as any).title?.trim() ? (r as any).title : "Review"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDateMaybe((r as any).created_at)}
                    {(r as any).display_name ? ` • ${(r as any).display_name}` : ""}
                  </div>
                </div>
                {(r as any).body && <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{(r as any).body}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  const stars = Array.from({ length: 5 }, (_, i) => (i < n ? "★" : "☆"));
  return <div className="text-sm leading-none">{stars.join("")}</div>;
}
