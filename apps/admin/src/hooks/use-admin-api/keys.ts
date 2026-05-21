export const adminKeys = {
  events: {
    all: ["admin", "events"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "events", "list", params] as const,
    byIds: (idIn: string) => ["admin", "events", "by-ids", idIn] as const,
    detail: (id: string) => ["admin", "events", id] as const,
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
    byIds: (idIn: string) => ["admin", "people", "by-ids", idIn] as const,
    detail: (id: string) => ["admin", "people", id] as const,
  },
  eventInvitees: {
    all: ["admin", "event-invitees"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "event-invitees", "list", params] as const,
    detail: (id: string) => ["admin", "event-invitees", id] as const,
  },
} as const;
