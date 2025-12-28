// components/catalog/add-item/blocks/Select.tsx
"use client";

import React from "react";

export default function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select {...rest} className={`w-full rounded-xl border bg-white px-3 py-2 text-xs ${className}`} />;
}
