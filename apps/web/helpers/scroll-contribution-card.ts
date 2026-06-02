/** Sticky site header + small gap (matches navbar `sticky top-0`). */
const TOP_INSET_PX = 88;

/** Mobile sticky contribution bar; desktop has no bottom chrome. */
const BOTTOM_INSET_MOBILE_PX = 104;
const BOTTOM_INSET_DESKTOP_PX = 24;

function bottomInsetPx(): number {
  if (typeof window === "undefined") {
    return BOTTOM_INSET_DESKTOP_PX;
  }

  return window.matchMedia("(min-width: 1024px)").matches
    ? BOTTOM_INSET_DESKTOP_PX
    : BOTTOM_INSET_MOBILE_PX;
}

/** Scroll so the full contribution card is visible, not an inner field or step. */
export function scrollContributionCardIntoView(elementId: string): void {
  const el = document.getElementById(elementId);
  if (!el) {
    return;
  }

  const bottomInset = bottomInsetPx();
  const rect = el.getBoundingClientRect();
  const availableHeight = window.innerHeight - TOP_INSET_PX - bottomInset;
  const cardHeight = rect.height;

  const targetScrollTop =
    cardHeight <= availableHeight
      ? window.scrollY +
        rect.top -
        (TOP_INSET_PX + (availableHeight - cardHeight) / 2)
      : window.scrollY + rect.top - TOP_INSET_PX;

  window.scrollTo({
    top: Math.max(0, targetScrollTop),
    behavior: "smooth",
  });
}
