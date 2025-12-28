"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type OverviewRow = {
  catalog_item_id: string;
  summary: string | null;
  description: string | null;
  key_facts: Record<string, string> | null;
  checklist: string[] | null;
  sources: string[] | null;
};

function safeText(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s;
}

function SectionCard({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E5E9F2] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#0F172A]">{title}</h2>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function ItemOverviewTab({ catalogItemId }: { catalogItemId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [row, setRow] = useState<OverviewRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        if (!catalogItemId) throw new Error("Missing catalog item id.");

        const res = await supabase
          .from("catalog_item_overview")
          .select("catalog_item_id,summary,description,key_facts,checklist,sources")
          .eq("catalog_item_id", catalogItemId)
          .maybeSingle();

        if (res.error) throw res.error;

        if (cancelled) return;
        setRow((res.data as any) ?? null);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load overview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const hasContent = useMemo(() => {
    const r = row;
    if (!r) return false;
    return !!(
      safeText(r.summary) ||
      safeText(r.description) ||
      (r.key_facts && Object.keys(r.key_facts).length) ||
      (r.checklist && r.checklist.length) ||
      (r.sources && r.sources.length)
    );
  }, [row]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E9F2] bg-white p-4 text-sm text-[#64748B]">
        Loading overview…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {err}
      </div>
    );
  }

  if (!row || !hasContent) {
    return (
      <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-6 text-sm text-[#64748B]">
        No overview available yet.
      </div>
    );
  }

  const summary = safeText(row.summary);
  const description = safeText(row.description);
  const facts = row.key_facts ?? null;
  const checklist = Array.isArray(row.checklist) ? row.checklist.filter(Boolean) : [];
  const sources = Array.isArray(row.sources) ? row.sources.filter(Boolean) : [];

  return (
    <div className="space-y-4">
      {summary ? (
        <SectionCard title="Summary">
          <p className="text-sm leading-6 text-[#0F172A] whitespace-pre-wrap">{summary}</p>
        </SectionCard>
      ) : null}

      {description ? (
        <SectionCard title="Description">
          <p className="text-sm leading-6 text-[#0F172A] whitespace-pre-wrap">{description}</p>
        </SectionCard>
      ) : null}

      {facts && Object.keys(facts).length ? (
        <SectionCard title="Key Facts">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(facts).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[#E5E9F2] bg-[#F8FAFF] px-3 py-2">
                <dt className="text-[11px] font-semibold text-[#64748B]">{k}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-[#0F172A]">
                  {safeText(v) || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      ) : null}

      {checklist.length ? (
        <SectionCard title="Checklist">
          <ul className="space-y-2">
            {checklist.map((item, idx) => (
              <li key={`${idx}-${item}`} className="flex items-start gap-2 text-sm text-[#0F172A]">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#0F172A]/30" />
                <span className="leading-6">{String(item)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {sources.length ? (
        <SectionCard title="Sources">
          <ul className="space-y-2">
            {sources.map((s, idx) => (
              <li key={`${idx}-${s}`} className="text-sm text-[#0F172A] break-words">
                {/* Keep as plain text to avoid unsafe links; you can turn into <a> later */}
                {String(s)}
              </li>
            ))}
          </ul>
          <div className="mt-3 text-[11px] text-[#64748B]">
            Sources are displayed as-is. (We can sanitize + convert to clickable links later.)
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
