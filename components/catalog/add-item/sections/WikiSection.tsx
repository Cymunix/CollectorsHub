// components/catalog/add-item/sections/WikiSection.tsx
"use client";

import React from "react";
import TextInput from "../blocks/TextInput";
import TextArea from "../blocks/TextArea";

export default function WikiSection(props: {
  wikiSummary: string;
  setWikiSummary: (v: string) => void;
  wikiDescription: string;
  setWikiDescription: (v: string) => void;

  wikiFacts: { k: string; v: string }[];
  setWikiFacts: (v: { k: string; v: string }[]) => void;
  newFactKey: string;
  setNewFactKey: (v: string) => void;
  newFactVal: string;
  setNewFactVal: (v: string) => void;

  wikiChecklist: string[];
  setWikiChecklist: (v: string[]) => void;
  newChecklistItem: string;
  setNewChecklistItem: (v: string) => void;

  wikiSources: string[];
  setWikiSources: (v: string[]) => void;
  newSource: string;
  setNewSource: (v: string) => void;
}) {
  const {
    wikiSummary,
    setWikiSummary,
    wikiDescription,
    setWikiDescription,

    wikiFacts,
    setWikiFacts,
    newFactKey,
    setNewFactKey,
    newFactVal,
    setNewFactVal,

    wikiChecklist,
    setWikiChecklist,
    newChecklistItem,
    setNewChecklistItem,

    wikiSources,
    setWikiSources,
    newSource,
    setNewSource,
  } = props;

  return (
    <div className="rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold">Overview (Wiki)</h3>
        <span className="text-[11px] text-gray-500">Optional</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="md:col-span-2 space-y-1">
          <label className="font-medium">Summary</label>
          <TextInput value={wikiSummary} onChange={(e) => setWikiSummary(e.target.value)} />
        </div>

        <div className="md:col-span-2 space-y-1">
          <label className="font-medium">Description</label>
          <TextArea value={wikiDescription} onChange={(e) => setWikiDescription(e.target.value)} className="min-h-[90px]" />
        </div>

        <div className="space-y-2">
          <label className="font-medium">Key Facts</label>
          <div className="flex gap-2">
            <TextInput value={newFactKey} onChange={(e) => setNewFactKey(e.target.value)} className="w-1/2" placeholder="Fact" />
            <TextInput value={newFactVal} onChange={(e) => setNewFactVal(e.target.value)} className="w-1/2" placeholder="Value" />
          </div>

          <button
            type="button"
            className="rounded-xl border bg-white px-3 py-2 text-xs"
            onClick={() => {
              const k = (newFactKey || "").trim();
              const v = (newFactVal || "").trim();
              if (!k || !v) return;
              setWikiFacts([...wikiFacts, { k, v }]);
              setNewFactKey("");
              setNewFactVal("");
            }}
          >
            + Add Fact
          </button>

          {wikiFacts.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              {wikiFacts.map((kv, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                  <div>
                    <span className="font-semibold">{kv.k}:</span> <span className="text-gray-600">{kv.v}</span>
                  </div>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() => setWikiFacts(wikiFacts.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="font-medium">Checklist</label>
          <div className="flex gap-2">
            <TextInput value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} className="flex-1" />
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2 text-xs"
              onClick={() => {
                const t = (newChecklistItem || "").trim();
                if (!t) return;
                setWikiChecklist([...wikiChecklist, t]);
                setNewChecklistItem("");
              }}
            >
              Add
            </button>
          </div>

          {wikiChecklist.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              {wikiChecklist.map((t, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                  <span className="text-gray-700">{t}</span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() => setWikiChecklist(wikiChecklist.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="font-medium">Sources</label>
          <div className="flex gap-2">
            <TextInput value={newSource} onChange={(e) => setNewSource(e.target.value)} className="flex-1" placeholder="Link or note" />
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2 text-xs"
              onClick={() => {
                const t = (newSource || "").trim();
                if (!t) return;
                setWikiSources([...wikiSources, t]);
                setNewSource("");
              }}
            >
              Add
            </button>
          </div>

          {wikiSources.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              {wikiSources.map((t, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                  <span className="break-all text-gray-700">{t}</span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() => setWikiSources(wikiSources.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
