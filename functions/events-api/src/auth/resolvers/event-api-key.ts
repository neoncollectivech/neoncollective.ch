/** Event-scoped API key auth — filled in by the Event API Keys plan. */
export type EventApiKeyAuth = {
  eventId: string;
  keyId: string;
};

/** Stub: returns null until event API keys are implemented. */
export async function resolveEventApiKey(_token: string): Promise<EventApiKeyAuth | null> {
  return null;
}
