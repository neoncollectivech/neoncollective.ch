import axios from "axios";

import { postCheckIn } from "@/lib/door-api";
import { getApiErrorMessage } from "@/lib/api-error";

import {
  listOutboxRows,
  updateOutboxRow,
  type CheckInOutboxRow,
} from "./check-in-outbox";

const MAX_ATTEMPTS = 8;
let syncing = false;

/** Queued tokens that are already checked in on replay are treated as synced. */
function isOutboxReplayAlreadyCheckedIn(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;

  return status === 404 || status === 409;
}

async function syncRow(row: CheckInOutboxRow): Promise<void> {
  if (row.status === "synced") {
    return;
  }

  await updateOutboxRow(row.id, { status: "syncing" });

  try {
    await postCheckIn(row.credential);
    await updateOutboxRow(row.id, { status: "synced", lastError: null });
  } catch (error) {
    if (isOutboxReplayAlreadyCheckedIn(error)) {
      await updateOutboxRow(row.id, { status: "synced", lastError: null });

      return;
    }

    const attempts = row.attempts + 1;
    const lastError = getApiErrorMessage(error);

    if (attempts >= MAX_ATTEMPTS) {
      await updateOutboxRow(row.id, {
        status: "failed",
        attempts,
        lastError,
      });

      return;
    }

    await updateOutboxRow(row.id, {
      status: "pending",
      attempts,
      lastError,
    });
  }
}

/** Process pending outbox rows serially without blocking the scanner UI. */
export async function processOutbox(): Promise<void> {
  if (syncing || !navigator.onLine) {
    return;
  }

  syncing = true;

  try {
    const rows = await listOutboxRows();
    const pending = rows.filter(
      (r) => r.status === "pending" || r.status === "failed",
    );

    for (const row of pending) {
      if (!navigator.onLine) {
        break;
      }

      await syncRow(row);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  } finally {
    syncing = false;
  }
}

export function startOutboxSyncScheduler(
  onSyncComplete?: () => void,
): () => void {
  const run = () => {
    void processOutbox().then(() => onSyncComplete?.());
  };

  run();

  const intervalId = window.setInterval(() => {
    void processOutbox().then(() => onSyncComplete?.());
  }, 30_000);

  window.addEventListener("online", run);
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      run();
    }
  };

  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
