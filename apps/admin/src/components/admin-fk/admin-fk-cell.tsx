import type { UseForeignKeyResult } from "@/hooks/use-foreign-key";
import type { AdminFkServiceDefinition } from "@/lib/admin-fk-services";

import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  formatForeignKeyDisplay,
  type ForeignKeyLookupRow,
  type ForeignKeyPresentation,
} from "@/lib/admin-fk-services";
import { isUuid } from "@/lib/uuid";

type AdminFkCellProps = {
  fk: UseForeignKeyResult;
  fkService: AdminFkServiceDefinition;
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
  fkService,
  foreignId,
  foreignDisplayField,
  presentation: presentationOverride,
  href: hrefOverride,
}: AdminFkCellProps) {
  const loading = fk.loading[fkService.id];
  const isPending = loading?.isPending ?? false;
  const isFetching = loading?.isFetching ?? false;

  if (!foreignId) {
    return <span className="text-muted-foreground">—</span>;
  }

  const lookup = fk.lookups[fkService.id]?.get(foreignId);
  const label =
    formatForeignKeyDisplay(lookup, foreignDisplayField) ??
    truncateId(foreignId);
  const presentation =
    presentationOverride ??
    fk.presentation[fkService.id] ??
    fkService.presentation;
  const resolveHref = () =>
    hrefOverride?.(foreignId, lookup) ?? fk.href(fkService, foreignId, lookup);
  const effectivePresentation = presentation;

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
    const href = resolveHref();

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

  const href = resolveHref();
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
