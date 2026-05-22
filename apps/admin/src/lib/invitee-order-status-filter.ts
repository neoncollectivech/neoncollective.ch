export const INVITEE_ORDER_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "empty", label: "No order" },
  { value: "has", label: "Has order" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
] as const;

export type InviteeOrderStatusFilterValue =
  (typeof INVITEE_ORDER_STATUS_FILTER_OPTIONS)[number]["value"];
