/** Rows older than this are eligible for rate-limit cleanup. */
export const RATE_LIMIT_ATTEMPTS_OLDER_THAN_HOURS = 24;

/** Used OTP / verification rows older than this are removed. */
export const MAINTENANCE_USED_CODE_RETENTION_DAYS = 7;

/** Stripe webhook dedup rows older than this are removed. */
export const STRIPE_EVENTS_PROCESSED_RETENTION_DAYS = 90;

/** Pending/failed checkout orders older than this are removed. */
export const STALE_ORDERS_RETENTION_HOURS = 24;

/** Max rows deleted per table per batch during POST cleanup. */
export const MAINTENANCE_DELETE_BATCH_SIZE = 1000;

export const MAINTENANCE_MAX_BATCH_PASSES = 500;

export type MaintenanceCategoryKey =
  | "profile_verification_codes"
  | "registration_exchange_codes"
  | "participant_sessions"
  | "rate_limit_attempts"
  | "auth_verification"
  | "auth_session"
  | "stripe_events_processed"
  | "stale_orders";

export type MaintenanceCategoryMeta = {
  key: MaintenanceCategoryKey;
  label: string;
  description: string;
};

export const MAINTENANCE_CATEGORIES: MaintenanceCategoryMeta[] = [
  {
    key: "profile_verification_codes",
    label: "Profile verification codes",
    description: `Expired, or used more than ${MAINTENANCE_USED_CODE_RETENTION_DAYS} days ago`,
  },
  {
    key: "registration_exchange_codes",
    label: "Registration exchange codes",
    description: `Expired, or used more than ${MAINTENANCE_USED_CODE_RETENTION_DAYS} days ago`,
  },
  {
    key: "participant_sessions",
    label: "Participant sessions",
    description: "Session cookie expired",
  },
  {
    key: "rate_limit_attempts",
    label: "Rate limit attempts",
    description: `Older than ${RATE_LIMIT_ATTEMPTS_OLDER_THAN_HOURS} hours`,
  },
  {
    key: "auth_verification",
    label: "Admin auth verifications",
    description: "Better Auth verification tokens expired",
  },
  {
    key: "auth_session",
    label: "Admin auth sessions",
    description: "Better Auth sessions expired",
  },
  {
    key: "stripe_events_processed",
    label: "Stripe events processed",
    description: `Processed more than ${STRIPE_EVENTS_PROCESSED_RETENTION_DAYS} days ago`,
  },
  {
    key: "stale_orders",
    label: "Stale checkout orders",
    description: `Pending or failed, created more than ${STALE_ORDERS_RETENTION_HOURS} hours ago`,
  },
];
