import { cn } from "./utils";

/** Table and FK cell navigation links (list → detail). */
export const adminTableLinkClassName =
  "text-primary underline-offset-4 hover:underline";

export function adminTableLinkClass(className?: string): string {
  return cn(adminTableLinkClassName, className);
}
