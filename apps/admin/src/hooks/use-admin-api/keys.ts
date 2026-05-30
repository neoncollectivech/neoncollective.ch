export const adminKeys = {
  events: {
    all: ["admin", "events"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "events", "list", params] as const,
    detail: (id: string) => ["admin", "events", id] as const,
    salesAnalytics: (eventId: string) =>
      ["admin", "events", eventId, "sales-analytics"] as const,
  },
  orders: {
    all: ["admin", "orders"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "orders", "list", params] as const,
    detail: (id: string) => ["admin", "orders", id] as const,
  },
  people: {
    all: ["admin", "people"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "people", "list", params] as const,
    detail: (id: string) => ["admin", "people", id] as const,
  },
  eventInvitees: {
    all: ["admin", "event-invitees"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "event-invitees", "list", params] as const,
    detail: (id: string) => ["admin", "event-invitees", id] as const,
    treeAll: (eventId: string) =>
      ["admin", "event-invitees", "tree", eventId] as const,
  },
  eventTiers: {
    all: ["admin", "event-tiers"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "event-tiers", "list", params] as const,
  },
  orderTiers: {
    all: ["admin", "order-tiers"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "order-tiers", "list", params] as const,
  },
  admissions: {
    all: ["admin", "admissions"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "admissions", "list", params] as const,
  },
  inviteRedemptions: {
    all: ["admin", "invite-redemptions"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "invite-redemptions", "list", params] as const,
  },
  inviteLinks: {
    all: ["admin", "invite-links"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "invite-links", "list", params] as const,
  },
  maintenance: {
    all: ["admin", "maintenance"] as const,
    preview: ["admin", "maintenance", "preview"] as const,
  },
  promotionCodes: {
    all: ["admin", "promotion-codes"] as const,
    forEvent: (eventId: string) =>
      ["admin", "promotion-codes", "event", eventId] as const,
    detail: (id: string) => ["admin", "promotion-codes", id] as const,
  },
} as const;
