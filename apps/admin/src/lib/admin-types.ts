export type AccessMode = "public" | "invite_only";
export type EventStatus = "draft" | "published";

export type EventFormValues = {
  slug: string;
  title: string;
  summary: string;
  location: string;
  startsAt: string;
  accessMode: AccessMode;
  eventQuota: string;
  defaultInviteLinkMaxRedemptions: string;
  imageUrlsText: string;
  status?: EventStatus;
};

export type EventCapacitySnapshot = {
  used: number;
  remaining: number | null;
};

export type EventDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  imageUrls: string[];
  startsAt: string | null;
  status: EventStatus;
  accessMode: AccessMode;
  eventQuota: number | null;
  defaultInviteLinkMaxRedemptions: number;
  capacity?: EventCapacitySnapshot;
  tiers?: TierRow[];
};

export type TierSelectionMode = "exclusive" | "addon";

export type TierRow = {
  id: string | null;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  quota: number | null;
  sortOrder: number;
  active: boolean;
  selectionMode: TierSelectionMode;
  sold?: number;
  placesRemaining?: number | null;
};

export type TierFormRow = {
  id: string | null;
  name: string;
  description: string;
  priceChf: string;
  quota: string;
  active: boolean;
  selectionMode: TierSelectionMode;
};

export type InviteLinkSummary = {
  id: string;
  token: string;
  maxRedemptions: number;
  usedRedemptions: number;
  remainingRedemptions: number;
  rotatedAt: string | null;
};

export type AdminInviteLinkSummary = {
  id: string;
  maxRedemptions: number;
  rotatedAt: string | null;
};

export type InviteeRow = {
  id: string;
  personId: string | null;
  inviterId: string | null;
  profilePending?: boolean;
  notes: string | null;
  revokedAt: string | null;
  hostInviteLink: InviteLinkSummary | null;
  adminInviteLinks: AdminInviteLinkSummary[];
  person: {
    id?: string | null;
    givenName: string;
    familyName: string;
    email: string | null;
    phone: string | null;
  };
};

export type InviteeUpsertForm = {
  givenName: string;
  familyName: string;
  email: string;
  phoneE164: string;
  notes: string;
};

export type InviteeEditForm = {
  notes: string;
};

export type PersonDetail = {
  id: string;
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  orders: {
    id: string;
    eventId: string;
    status: string;
    amountCents: number;
    createdAt: string;
    eventTitle: string;
  }[];
  invitees: {
    id: string;
    eventId: string;
    revokedAt: string | null;
    eventTitle: string;
  }[];
};

export type OrderTierLine = {
  id: string;
  name: string;
  selectionMode: TierSelectionMode;
  unitPriceCents: number;
};

export type OrderDetail = {
  id: string;
  eventId: string;
  status: string;
  amountCents: number;
  locale: string;
  stripePaymentIntentId: string | null;
  createdAt: string;
  person: {
    id: string;
    givenName: string;
    familyName: string;
    email: string | null;
    phone: string | null;
  };
  tiers: OrderTierLine[];
  event: { id: string; slug: string; title: string };
  admission: { id: string; checkedInAt: string | null } | null;
  inviteRedemption: { id: string; createdAt: string } | null;
};
