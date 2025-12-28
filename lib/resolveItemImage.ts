// lib/resolveItemImage.ts

export type PhotoRow = {
  image_url: string;
  is_primary: boolean | null;
  sort_order: number | null;
};

export function resolveItemImage(photos?: PhotoRow[] | null): string | null {
  if (!photos || photos.length === 0) return null;

  const sorted = [...photos].sort((a, b) => {
    // primary first
    const ap = a.is_primary ? 1 : 0;
    const bp = b.is_primary ? 1 : 0;
    if (ap !== bp) return bp - ap;

    // then sort_order asc (nulls last)
    const as = a.sort_order ?? 9999;
    const bs = b.sort_order ?? 9999;
    return as - bs;
  });

  return sorted[0]?.image_url ?? null;
}
