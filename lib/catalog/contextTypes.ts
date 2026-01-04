// lib/catalog/contextTypes.ts
export type ContextDescription = {
  text: string | null;
  source: "override" | "inherited" | "none";
  sourceLabel: string; // e.g. "Call of Duty — Mega Bloks" or "Call of Duty"
  canEditDefault: boolean;
  canCreateOverride: boolean;
  canEditOverride: boolean;
};

export type CountRow = { id: string; name: string; count: number };

export type FranchiseContext = {
  kind: "franchise";
  franchise: { id: string; name: string };
  scopeLabel: string; // "Call of Duty" or "Call of Duty — Mega Bloks"
  description: ContextDescription;
  totals: { items: number };
  countsByCategory: CountRow[];
  countsBySubcategory?: CountRow[]; // when category is chosen
};

export type ItemContext = {
  kind: "item";
  item: { id: string; name: string };
};

export type SidebarContext = FranchiseContext | ItemContext | { kind: "empty" };
