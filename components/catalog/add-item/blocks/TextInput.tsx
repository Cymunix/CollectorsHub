// components/catalog/add-item/blocks/TextInput.tsx
"use client";

import React from "react";

export default function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`w-full rounded-xl border px-3 py-2 text-xs ${className}`} />;
}
