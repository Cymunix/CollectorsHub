"use client";

import { linkVariantToVariant } from "@/lib/catalog/variants";
import type { VariantFamily } from "@/lib/catalog/variantSearch";

export default function VariantGroupPanel({
  family,
  activeItemId,
  onUpdated,
}: {
  family: VariantFamily;
  activeItemId: string; // the item you're editing (e.g. Ultimate)
  onUpdated: () => void;
}) {
  async function linkTo(itemId: string) {
    if (itemId === activeItemId) return;

    await linkVariantToVariant({
      sourceItemId: activeItemId,
      targetItemId: itemId,
    });

    onUpdated();
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="mb-2 text-sm font-semibold">Variant Group</div>

      <div className="space-y-2">
        {family.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">{item.name}</div>
              {item.variant_name && (
                <div className="text-xs text-gray-500">
                  {item.variant_name}
                </div>
              )}
            </div>

            {item.id !== activeItemId && (
              <button
                onClick={() => linkTo(item.id)}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
              >
                Link here
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
