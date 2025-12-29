export function normalizeText(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/['’]/g, "")         // kill apostrophes
    .replace(/[^a-z0-9\s]/g, " ") // punctuation -> spaces
    .replace(/\s+/g, " ")
    .trim();
}

const romanMap: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5,
  vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15,
};

export function parseSeriesNumberFromQuery(q: string): number | null {
  const n = normalizeText(q);
  const parts = n.split(" ");
  if (!parts.length) return null;

  const last = parts[parts.length - 1];

  // numeric
  if (/^\d{1,3}$/.test(last)) return Number(last);

  // roman
  if (romanMap[last]) return romanMap[last];

  return null;
}
