// lib/catalog/statusFormat.ts
export type StatusTone = "good" | "neutral" | "bad" | "muted";

export function formatProductionStatus(status?: string | null): { label: string; tone: StatusTone } {
  switch (status) {
    case "in_production":
      return { label: "In production", tone: "good" };
    case "retired":
      return { label: "Retired", tone: "neutral" };
    case "out_of_production":
      return { label: "Out of production", tone: "neutral" };
    case "cancelled":
      return { label: "Cancelled", tone: "bad" };
    default:
      return { label: "Status unknown", tone: "muted" };
  }
}
