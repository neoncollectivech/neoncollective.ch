export const adminKeys = {
  events: {
    all: ["admin", "events"] as const,
    list: (params?: Record<string, string>) =>
      ["admin", "events", "list", params] as const,
    detail: (id: string) => ["admin", "events", id] as const,
    invitees: (eventId: string) =>
      ["admin", "events", eventId, "invitees"] as const,
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
} as const;
