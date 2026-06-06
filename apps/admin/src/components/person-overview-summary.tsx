import type { PersonLinkCounts } from "@/lib/admin-api";

type PersonOverviewSummaryProps = {
  links: PersonLinkCounts | undefined;
  admissions: number;
  inviteRedemptions: number;
  isLoading?: boolean;
};

type SummaryItem = {
  id: string;
  label: string;
  value: number;
};

export function PersonOverviewSummary({
  links,
  admissions,
  inviteRedemptions,
  isLoading,
}: PersonOverviewSummaryProps) {
  const items: SummaryItem[] = [
    { id: "orders", label: "Orders", value: links?.orders ?? 0 },
    { id: "admissions", label: "Admissions", value: admissions },
    {
      id: "event-invites",
      label: "Event invites",
      value: links?.inviteesAsGuest ?? 0,
    },
    {
      id: "guest-invite-links",
      label: "Guest invite links",
      value: links?.inviteLinksAsHost ?? 0,
    },
    {
      id: "guests-invited",
      label: "Guests invited",
      value: links?.inviteesAsHost ?? 0,
    },
    {
      id: "invite-redemptions",
      label: "Invite redemptions",
      value: inviteRedemptions,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <a
          key={item.id}
          className="rounded-md border border-border p-3 text-sm transition-colors hover:bg-muted/40"
          href={`#person-${item.id}`}
        >
          <p className="text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {isLoading ? "—" : item.value}
          </p>
        </a>
      ))}
    </div>
  );
}
