import type { Stripe } from "stripe";

import type { AdminSession } from "./resolvers/admin-session";
import type { EventApiKeyAuth } from "./resolvers/event-api-key";
import type { ResolvedParticipantSession } from "./resolvers/participant-session";

export type AppEnv = {
  Variables: {
    adminSession?: AdminSession;
    participantSession?: ResolvedParticipantSession;
    stripeEvent?: Stripe.Event;
    eventApiKey?: EventApiKeyAuth;
  };
};
