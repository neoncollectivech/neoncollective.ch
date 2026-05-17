"use client";

import type {
  InterventionFeedBlock,
  InterventionEntry,
} from "@/lib/content/types";
import type { Dictionary } from "@/i18n/getDictionary";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { SplitFlapText } from "@/components/split-flap-text";
import { NeonLink } from "@/components/neon-link";
import { useDictionary } from "@/i18n/DictionaryContext";
import { eventsApi, type EventCatalogItem } from "@/hooks/use-events-api";
import { eventDetailPath } from "@/helpers/eventRoutes";

/* ── Status ordering & styling ────────────────────────────── */

const STATUS_ORDER: InterventionEntry["status"][] = [
  "live",
  "incubation",
  "archived",
];

const STATUS_STYLES: Record<
  InterventionEntry["status"],
  { label: string; text: string; border: string }
> = {
  live: {
    label: "LIVE",
    text: "text-neon",
    border: "border-neon/60",
  },
  incubation: {
    label: "INCUBATION",
    text: "text-foreground/30",
    border: "border-foreground/10",
  },
  archived: {
    label: "ARCHIVED",
    text: "text-foreground/20",
    border: "border-foreground/6",
  },
};

/* ── Live UTC clock ───────────────────────────────────────── */

function useUtcClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toISOString().replace("T", " ").slice(0, 19) + "Z");

    tick();
    const id = setInterval(tick, 1000);

    return () => clearInterval(id);
  }, []);

  return time;
}

function rowIsPast(row: EventCatalogItem, nowMs: number): boolean {
  if (!row.startsAt) {
    return false;
  }

  return Date.parse(row.startsAt) < nowMs;
}

function compareStartsAsc(a: EventCatalogItem, b: EventCatalogItem): number {
  const ta = a.startsAt ? Date.parse(a.startsAt) : Number.POSITIVE_INFINITY;
  const tb = b.startsAt ? Date.parse(b.startsAt) : Number.POSITIVE_INFINITY;

  return ta - tb;
}

function compareStartsDesc(a: EventCatalogItem, b: EventCatalogItem): number {
  return compareStartsAsc(b, a);
}

function mapRowToEntry(
  row: EventCatalogItem,
  copy: Dictionary["events"],
  locale: string,
  nowMs: number,
): InterventionEntry {
  const past = rowIsPast(row, nowMs);
  const status = past ? "archived" : "live";
  const startsMs = row.startsAt ? Date.parse(row.startsAt) : NaN;
  const hasStart = Number.isFinite(startsMs);
  const coordinates = hasStart
    ? new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(startsMs)
    : copy.dispatchLogDateTbd;

  return {
    dispatchKey: `event:${row.slug}`,
    status,
    codename: row.title.toLocaleUpperCase(locale),
    objective: past
      ? copy.dispatchLogObjectivePast
      : copy.dispatchLogObjectiveLive,
    location: row.location?.trim() || copy.dispatchLogVenueLine,
    coordinates,
    ...(past
      ? {}
      : {
          cta: {
            label: copy.dispatchLogDossierCta,
            href: eventDetailPath(row.slug, row.inviteOnly),
            external: false,
          },
        }),
  };
}

function mergeDispatchEntries(
  cms: InterventionEntry[],
  apiRows: EventCatalogItem[],
  copy: Dictionary["events"],
  locale: string,
  nowMs: number,
): InterventionEntry[] {
  const upcoming = apiRows
    .filter((r) => !rowIsPast(r, nowMs))
    .sort(compareStartsAsc);
  const past = apiRows
    .filter((r) => rowIsPast(r, nowMs))
    .sort(compareStartsDesc);
  const liveEvents = upcoming.map((r) => mapRowToEntry(r, copy, locale, nowMs));
  const archivedEvents = past.map((r) => mapRowToEntry(r, copy, locale, nowMs));

  const liveCms = cms.filter((e) => e.status === "live");
  const incubationCms = cms.filter((e) => e.status === "incubation");
  const archivedCms = cms.filter((e) => e.status === "archived");

  return [
    ...liveCms,
    ...liveEvents,
    ...incubationCms,
    ...archivedCms,
    ...archivedEvents,
  ];
}

/* ── Entry card ───────────────────────────────────────────── */

function EntryCard({
  entry,
  index,
  locale,
}: {
  entry: InterventionEntry;
  index: number;
  locale: string;
}) {
  const style = STATUS_STYLES[entry.status];
  const cardDelay = index * 250;
  const isArchived = entry.status === "archived";
  const fieldLabel = isArchived ? "THE MISSION:" : "THE SITUATION:";

  return (
    <div
      className={`border-l-2 ${style.border} pl-5 py-4 transition-colors duration-500`}
    >
      {/* Codename */}
      <p className="font-mono font-medium text-sm md:text-base text-foreground/80 uppercase tracking-[0.2em] mb-2">
        <SplitFlapText delay={cardDelay} text={entry.codename} />
      </p>

      {/* Objective */}
      <p className="font-mono text-foreground/40 text-sm leading-relaxed mb-3">
        <span className="font-mono text-xs text-foreground/25 uppercase tracking-widest mr-2">
          {fieldLabel}
        </span>
        <SplitFlapText delay={cardDelay + 100} text={entry.objective} />
      </p>

      {/* Location + Coordinates */}
      <p className="font-mono text-xs text-foreground/20 tracking-wider mb-4">
        <span className="text-foreground/25 mr-1">LOC</span>
        {entry.coordinates && (
          <>
            <SplitFlapText delay={cardDelay + 200} text={entry.coordinates} />
            <span className="mx-1.5 text-foreground/10">{"//"}</span>
          </>
        )}
        <SplitFlapText delay={cardDelay + 250} text={entry.location} />
      </p>

      {/* CTA */}
      <div className="flex justify-end">
        {isArchived ? (
          <span className="font-mono text-[0.625rem] text-foreground/15 uppercase tracking-widest">
            ARCHIVED ✓
          </span>
        ) : (
          entry.cta && (
            <NeonLink
              href={
                entry.cta.external
                  ? entry.cta.href
                  : `/${locale}${entry.cta.href}`
              }
              isExternal={entry.cta.external}
            >
              {entry.cta.label}
            </NeonLink>
          )
        )}
      </div>
    </div>
  );
}

/* ── Main feed component ──────────────────────────────────── */

export function InterventionFeedBlockComponent({
  entries,
  locale,
}: InterventionFeedBlock & { locale: string }) {
  const utc = useUtcClock();
  const { dictionary } = useDictionary();
  const catalogQuery = useQuery(eventsApi.catalog());

  const mergedEntries = useMemo(() => {
    if (!catalogQuery.data) {
      return entries;
    }

    return mergeDispatchEntries(
      entries,
      catalogQuery.data,
      dictionary.events,
      locale,
      Date.now(),
    );
  }, [entries, catalogQuery.data, dictionary.events, locale]);

  // Group entries by status in the defined order.
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    style: STATUS_STYLES[status],
    items: mergedEntries.filter((e) => e.status === status),
  })).filter((g) => g.items.length > 0);

  const liveCount = mergedEntries.filter((e) => e.status === "live").length;

  let globalIndex = 0;

  return (
    <section className="mb-16 md:mb-24">
      {/* ── Header ──────────────────────────────────── */}
      <div className="border-b border-foreground/6 pb-4 mb-10">
        <p className="font-mono text-xs text-neon/40 tracking-[0.3em] uppercase">
          {"// DISPATCH LOG"}
          <span className="animate-cursor-blink ml-0.5">_</span>
        </p>
        <div className="flex items-baseline justify-between mt-2">
          <p className="font-mono text-xs text-foreground/20 tracking-wider">
            SYS.UTC {utc}
          </p>
          {liveCount > 0 && (
            <p className="font-mono text-xs text-neon/50 tracking-widest uppercase">
              {liveCount} LIVE
            </p>
          )}
        </div>
      </div>

      {/* ── Status groups ───────────────────────────── */}
      <div className="space-y-10">
        {grouped.map((group) => (
          <div key={group.status}>
            {/* Status header */}
            <p
              className={`font-mono text-xs ${group.style.text} tracking-[0.3em] uppercase mb-4`}
            >
              ▌ {group.style.label}
            </p>

            {/* Entry cards */}
            <div className="space-y-6">
              {group.items.map((entry) => {
                const idx = globalIndex++;

                return (
                  <EntryCard
                    key={entry.dispatchKey ?? entry.codename}
                    entry={entry}
                    index={idx}
                    locale={locale}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
