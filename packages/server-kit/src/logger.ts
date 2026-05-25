import pino from "pino";

import type { AppLogger } from "./app-logger";

/** Pretty logs only when explicitly in local dev (pino-pretty is not a prod dependency). */
const usePrettyTransport = process.env.NODE_ENV === "development";

const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? (usePrettyTransport ? "debug" : "info"),
  ...(usePrettyTransport && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
}) as unknown as AppLogger;

export const logger = rootLogger;

export const createLogger = (name: string): AppLogger => logger.child({ module: name });
