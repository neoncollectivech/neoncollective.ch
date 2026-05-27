import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(rootDir, "..");
const cacheDir = path.join(rootDir, ".cache");
const seedPath = path.join(cacheDir, "seed.json");

function parseSeedPayload(stdout) {
  for (const line of stdout
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .reverse()) {
    if (!line.startsWith("{")) {
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      if (
        typeof parsed.slug === "string" &&
        typeof parsed.privateUrl === "string" &&
        typeof parsed.hostInvited?.phone === "string" &&
        typeof parsed.guestInvited?.phone === "string" &&
        typeof parsed.hostInvitedPromo?.phone === "string"
      ) {
        return parsed;
      }
    } catch {
      /* drizzle/postgres NOTICE lines also start with "{" */
    }
  }
  return null;
}

export default function globalSetup() {
  fs.mkdirSync(cacheDir, { recursive: true });

  // eslint-disable-next-line no-console -- Playwright globalSetup lifecycle
  console.log("[e2e] Reseeding database (pnpm db:events-api:seed:e2e)…");

  const out = execSync("pnpm db:events-api:seed:e2e", {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });

  const parsed = parseSeedPayload(out);
  if (!parsed) {
    throw new Error("E2E seed did not print JSON payload.");
  }

  fs.writeFileSync(seedPath, JSON.stringify(parsed, null, 2));
}
