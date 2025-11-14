export const REIMBURSEMENT_CATEGORIES = [
  { value: "food", label: "Food & Meals" },
  { value: "travel", label: "Travel" },
  { value: "stay", label: "Stay & Lodging" },
  { value: "transport", label: "Local Transport" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "internet", label: "Internet & Connectivity" },
  { value: "other", label: "Other" },
] as const;

export type ReimbursementCategoryValue =
  (typeof REIMBURSEMENT_CATEGORIES)[number]["value"];

export const REIMBURSEMENT_CATEGORY_LABELS = REIMBURSEMENT_CATEGORIES.reduce(
  (acc, category) => {
    acc[category.value] = category.label;
    return acc;
  },
  {} as Record<string, string>,
);

