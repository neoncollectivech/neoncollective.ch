import { markdownPlainText } from "@/helpers/markdown-plain-text";

export function buildGoogleCalendarUrl(opts: {
  title: string;
  startsAt: string;
  location?: string | null;
  summary?: string | null;
}): string {
  const start = new Date(opts.startsAt);

  if (Number.isNaN(start.getTime())) {
    return "";
  }

  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });

  const location = opts.location?.trim();

  if (location) {
    params.set("location", location);
  }
  const details = opts.summary?.trim()
    ? markdownPlainText(opts.summary)
    : undefined;

  if (details) {
    params.set("details", details);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
