// components/catalog/add-item/blocks/FieldLabel.tsx
"use client";

import React from "react";

export default function FieldLabel({
  children,
  req,
}: {
  children: React.ReactNode;
  req?: boolean;
}) {
  return (
    <label className="font-medium">
      {children} {req ? <span className="text-red-600">*</span> : null}
    </label>
  );
}