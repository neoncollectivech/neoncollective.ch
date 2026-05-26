import { createLogger } from "@neon/server-kit";
import { Hono } from "hono";

import {
  MAINTENANCE_CATEGORIES,
  type MaintenanceCategoryKey,
} from "../../../config/maintenance";
import { authSessionService } from "../../../services/auth-session.service";
import { authVerificationService } from "../../../services/auth-verification.service";
import { ordersService } from "../../../services/orders.service";
import { participantSessionsService } from "../../../services/participant-sessions.service";
import { profileVerificationCodesService } from "../../../services/profile-verification-codes.service";
import {
  countMaintenanceEligibleRateLimitAttempts,
  purgeMaintenanceEligibleRateLimitAttempts,
} from "../../../services/rate-limit.service";
import { registrationExchangeCodesService } from "../../../services/registration-exchange-codes.service";
import { stripeEventsProcessedService } from "../../../services/stripe-events-processed.service";

const log = createLogger("maintenance");

export type MaintenanceCategoryPreview = {
  key: MaintenanceCategoryKey;
  label: string;
  description: string;
  count: number;
};

export type MaintenancePreview = {
  categories: MaintenanceCategoryPreview[];
  totalRows: number;
};

export type MaintenanceCategoryResult = {
  key: MaintenanceCategoryKey;
  label: string;
  description: string;
  deleted: number;
};

export type MaintenanceRunResult = {
  categories: MaintenanceCategoryResult[];
  totalDeleted: number;
};

type MaintenanceTableOps = {
  count: () => Promise<number>;
  purge: () => Promise<number>;
};

const MAINTENANCE_OPS: Record<MaintenanceCategoryKey, MaintenanceTableOps> = {
  profile_verification_codes: {
    count: () => profileVerificationCodesService.countMaintenanceEligible(),
    purge: () => profileVerificationCodesService.purgeMaintenanceEligible(),
  },
  registration_exchange_codes: {
    count: () => registrationExchangeCodesService.countMaintenanceEligible(),
    purge: () => registrationExchangeCodesService.purgeMaintenanceEligible(),
  },
  participant_sessions: {
    count: () => participantSessionsService.countMaintenanceEligible(),
    purge: () => participantSessionsService.purgeMaintenanceEligible(),
  },
  rate_limit_attempts: {
    count: () => countMaintenanceEligibleRateLimitAttempts(),
    purge: () => purgeMaintenanceEligibleRateLimitAttempts(),
  },
  auth_verification: {
    count: () => authVerificationService.countMaintenanceEligible(),
    purge: () => authVerificationService.purgeMaintenanceEligible(),
  },
  auth_session: {
    count: () => authSessionService.countMaintenanceEligible(),
    purge: () => authSessionService.purgeMaintenanceEligible(),
  },
  stripe_events_processed: {
    count: () => stripeEventsProcessedService.countMaintenanceEligible(),
    purge: () => stripeEventsProcessedService.purgeMaintenanceEligible(),
  },
  stale_orders: {
    count: () => ordersService.countStaleMaintenanceEligible(),
    purge: () => ordersService.purgeStaleMaintenanceEligible(),
  },
};

async function previewMaintenance(): Promise<MaintenancePreview> {
  const categories: MaintenanceCategoryPreview[] = [];
  let totalRows = 0;

  for (const meta of MAINTENANCE_CATEGORIES) {
    const count = await MAINTENANCE_OPS[meta.key].count();
    categories.push({
      key: meta.key,
      label: meta.label,
      description: meta.description,
      count,
    });
    totalRows += count;
  }

  return { categories, totalRows };
}

async function runMaintenance(): Promise<MaintenanceRunResult> {
  const categories: MaintenanceCategoryResult[] = [];
  let totalDeleted = 0;

  for (const meta of MAINTENANCE_CATEGORIES) {
    const deleted = await MAINTENANCE_OPS[meta.key].purge();
    categories.push({
      key: meta.key,
      label: meta.label,
      description: meta.description,
      deleted,
    });
    totalDeleted += deleted;
  }

  return { categories, totalDeleted };
}

export function createMaintenanceRouter(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    const preview = await previewMaintenance();
    return c.json(preview);
  });

  router.post("/", async (c) => {
    const result = await runMaintenance();
    log.info(
      {
        totalDeleted: result.totalDeleted,
        categories: result.categories.map((cat) => ({
          key: cat.key,
          deleted: cat.deleted,
        })),
      },
      "Database maintenance cleanup completed",
    );
    return c.json(result);
  });

  return router;
}
