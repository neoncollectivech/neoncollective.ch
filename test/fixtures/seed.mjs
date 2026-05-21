import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadE2eSeed() {
  const seedPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    ".cache",
    "seed.json",
  );
  const raw = fs.readFileSync(seedPath, "utf8");
  return JSON.parse(raw);
}
