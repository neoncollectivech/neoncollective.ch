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

/** Flat event read row from CRUD `GET /admin/events/:id`. */
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
  createdAt: string;
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

/** Flat person read row from CRUD `GET /admin/people/:id`. */
export type PersonDetail = {
  id: string;
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
