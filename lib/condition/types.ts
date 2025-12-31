export type ConditionState = "sealed" | "open_complete" | "open_incomplete" | "loose";
export type ConditionGrade = "mint" | "excellent" | "good" | "fair" | "poor";

export type ConditionFlag =
  | "tested_working"
  | "not_tested"
  | "manual_missing"
  | "replacement_case"
  | "seal_imperfect"
  | "reseal_suspected"
  | "box_crushed"
  | "sticker_residue"
  | "smoke_smell";

export type ConditionPayload = {
  state: ConditionState;
  grade: ConditionGrade;
  flags: ConditionFlag[];
  // category-specific detail (disc scratches, box corners, etc)
  details?: Record<string, any>;
};
