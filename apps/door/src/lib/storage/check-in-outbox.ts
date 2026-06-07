import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type OutboxStatus = "pending" | "syncing" | "synced" | "failed";

export type CheckInOutboxRow = {
  id: string;
  credential: string;
  createdAt: number;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
};

interface DoorDbSchema extends DBSchema {
  check_ins: {
    key: string;
    value: CheckInOutboxRow;
    indexes: { by_status: OutboxStatus; by_created: number };
  };
}

const DB_NAME = "neon-door";
const DB_VERSION = 2;
const STORE = "check_ins";

let dbPromise: Promise<IDBPDatabase<DoorDbSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<DoorDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DoorDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 2 && db.objectStoreNames.contains(STORE)) {
          db.deleteObjectStore(STORE);
        }

        const store = db.createObjectStore(STORE, { keyPath: "id" });

        store.createIndex("by_status", "status");
        store.createIndex("by_created", "createdAt");
      },
    });
  }

  return dbPromise;
}

export async function enqueueCheckIn(
  credential: string,
): Promise<CheckInOutboxRow> {
  const db = await getDb();
  const row: CheckInOutboxRow = {
    id: crypto.randomUUID(),
    credential,
    createdAt: Date.now(),
    status: "pending",
    attempts: 0,
    lastError: null,
  };

  await db.put(STORE, row);

  return row;
}

export async function listOutboxRows(): Promise<CheckInOutboxRow[]> {
  const db = await getDb();
  const rows = await db.getAll(STORE);

  rows.sort((a, b) => a.createdAt - b.createdAt);

  return rows;
}

export async function countPendingOutbox(): Promise<number> {
  const db = await getDb();
  const pending = await db.getAllFromIndex(STORE, "by_status", "pending");
  const syncing = await db.getAllFromIndex(STORE, "by_status", "syncing");

  return pending.length + syncing.length;
}

export async function updateOutboxRow(
  id: string,
  patch: Partial<Pick<CheckInOutboxRow, "status" | "attempts" | "lastError">>,
): Promise<void> {
  const db = await getDb();
  const existing = await db.get(STORE, id);

  if (!existing) {
    return;
  }

  await db.put(STORE, { ...existing, ...patch });
}
