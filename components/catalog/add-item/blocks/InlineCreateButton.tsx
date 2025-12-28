// components/catalog/add-item/blocks/InlineCreateButton.tsx
"use client";

import React from "react";

export default function InlineCreateButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[11px] text-blue-600 hover:underline disabled:opacity-50"
    >
      {children}
    </button>
  );
}
