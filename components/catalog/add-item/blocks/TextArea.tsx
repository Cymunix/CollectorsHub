// components/catalog/add-item/blocks/TextArea.tsx
"use client";

import React from "react";

export default function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`w-full rounded-xl border px-3 py-2 text-xs ${className}`} />;
}
