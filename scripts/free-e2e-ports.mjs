#!/usr/bin/env node
/**
 * Free :3000 (Next) and :8082 (events-api) before E2E or dev:e2e.
 * macOS / Linux: uses lsof. Safe to run when nothing is listening.
 */

import { execSync } from "node:child_process";

const PORTS = [3000, 8082];

for (const port of PORTS) {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" })
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (pids.length === 0) {
      continue;
    }
    execSync(`kill -9 ${pids.join(" ")}`);
    // eslint-disable-next-line no-console -- CLI helper
    console.log(`Freed port ${port} (pids: ${pids.join(", ")})`);
  } catch {
    /* lsof: no process on this port */
  }
}
