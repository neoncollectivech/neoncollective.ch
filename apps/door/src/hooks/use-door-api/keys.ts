export const doorKeys = {
  all: ["door"] as const,
  outbox: {
    all: () => [...doorKeys.all, "outbox"] as const,
    stats: () => [...doorKeys.outbox.all(), "stats"] as const,
  },
  checkIn: {
    all: () => [...doorKeys.all, "checkIn"] as const,
  },
};
