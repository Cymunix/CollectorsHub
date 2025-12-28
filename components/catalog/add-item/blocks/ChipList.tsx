// components/catalog/add-item/blocks/ChipList.tsx
"use client";

import React from "react";

export default function ChipList({
  items,
  getKey,
  render,
}: {
  items: any[];
  getKey: (x: any) => string;
  render: (x: any) => React.ReactNode;
}) {
  if (!items || items.length === 0) return <p className="text-xs text-gray-400">None selected.</p>;

  return <div className="flex flex-wrap gap-2">{items.map((x) => <div key={getKey(x)}>{render(x)}</div>)}</div>;
}
