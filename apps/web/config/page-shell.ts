/**
 * Page shell layout tokens. Marketing hero blocks (home) may use full-bleed
 * layouts outside this system; manifesto/engage blocks keep larger display type.
 */
export type PageShellWidth = "prose" | "wide" | "eventList" | "eventDetail";

export const pageShellClassNames = {
  outer: "py-16 md:py-28 px-6",
  inner: {
    prose: "max-w-3xl mx-auto w-full min-w-0",
    wide: "max-w-3xl lg:max-w-5xl mx-auto w-full min-w-0",
    eventList: "max-w-3xl mx-auto w-full min-w-0",
    eventDetail: "max-w-3xl lg:max-w-5xl mx-auto w-full min-w-0",
  },
} as const;

export function pageShellInnerClass(width: PageShellWidth): string {
  return pageShellClassNames.inner[width];
}
