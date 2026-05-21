import { createHash, randomBytes } from "node:crypto";

export function randomTokenHex(bytes = 24): string {
  return randomBytes(bytes).toString("hex");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
