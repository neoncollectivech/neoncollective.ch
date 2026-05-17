const eventsRoot = ["events"] as const;
const participantRoot = ["events", "participant"] as const;

export const eventsKeys = {
  root: eventsRoot,
  catalog: (inviteToken?: string) =>
    [...eventsRoot, "catalog", inviteToken ?? ""] as const,
  detail: (slug: string, inviteToken?: string) =>
    [...eventsRoot, "detail", slug, inviteToken ?? ""] as const,
  participant: {
    all: participantRoot,
    profile: (inviteToken?: string) =>
      [...participantRoot, "profile", inviteToken ?? ""] as const,
    session: () => [...participantRoot, "session"] as const,
  },
};
