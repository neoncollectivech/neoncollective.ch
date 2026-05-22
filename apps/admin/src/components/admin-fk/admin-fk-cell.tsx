import type { UseForeignKeyResult } from "@/hooks/use-foreign-key";

import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  formatForeignKeyDisplay,
  FK_SERVICE_REGISTRY,
  type ForeignKeyLookupRow,
  type ForeignKeyPresentation,
  type ForeignKeyService,
} from "@/lib/foreign-key-registry";
import { isUuid } from "@/lib/uuid";

type AdminFkCellProps = {
  fk: UseForeignKeyResult;
  foreignService: ForeignKeyService;
  foreignId: string | null | undefined;
  foreignDisplayField: string | readonly string[];
  presentation?: ForeignKeyPresentation;
  href?: (
    lookupId: string,
    row: ForeignKeyLookupRow | undefined,
  ) => string | undefined;
};

function truncateId(id: string): string {
  return isUuid(id) ? `${id.slice(0, 8)}…` : id;
}

export function AdminFkCell({
  fk,
  foreignService,
  foreignId,
  foreignDisplayField,
  presentation: presentationOverride,
  href: hrefOverride,
}: AdminFkCellProps) {
  const loading = fk.loading[foreignService];
  const isPending = loading?.isPending ?? false;
  const isFetching = loading?.isFetching ?? false;

  if (!foreignId) {
    return <span className="text-muted-foreground">—</span>;
  }

  const lookup = fk.lookups[foreignService]?.get(foreignId);
  const label =
    formatForeignKeyDisplay(lookup, foreignDisplayField) ??
    truncateId(foreignId);
  const presentation = presentationOverride ?? fk.presentation[foreignService];
  const href =
    hrefOverride?.(foreignId, lookup) ??
    fk.href(foreignService, foreignId, lookup);
  const defaultPresentation = FK_SERVICE_REGISTRY[foreignService].presentation;
  const effectivePresentation = presentation ?? defaultPresentation;

  const spinner = (
    <>
      {isPending ? (
        <span className="mr-2 inline-flex align-middle">
          <InlineSpinner />
        </span>
      ) : null}
    </>
  );

  const trailingSpinner =
    !isPending && isFetching ? (
      <span className="ml-2 inline-flex align-middle">
        <InlineSpinner />
      </span>
    ) : null;

  if (effectivePresentation === "badge") {
    if (!lookup) {
      return (
        <span className="inline-flex items-center font-mono text-xs">
          {spinner}
          <span className="text-muted-foreground">—</span>
          {trailingSpinner}
        </span>
      );
    }
    const badge = <Badge>{label}</Badge>;

    if (href && isUuid((lookup as { id?: string }).id ?? foreignId)) {
      return (
        <span className="inline-flex items-center font-mono text-xs">
          {spinner}
          <Link className="hover:opacity-90" to={href}>
            {badge}
          </Link>
          {trailingSpinner}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center font-mono text-xs">
        {spinner}
        {badge}
        {trailingSpinner}
      </span>
    );
  }

  const content =
    href && isUuid(foreignId) ? (
      <Link className="text-primary hover:underline" to={href}>
        {label}
      </Link>
    ) : (
      label
    );

  return (
    <span className="font-mono text-xs">
      {spinner}
      {content}
      {trailingSpinner}
    </span>
  );
}
