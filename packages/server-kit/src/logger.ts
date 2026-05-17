import pino from "pino";

/** Pretty logs only when explicitly in local dev (pino-pretty is not a prod dependency). */
const usePrettyTransport = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (usePrettyTransport ? "debug" : "info"),
  ...(usePrettyTransport && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

export const createLogger = (name: string) => logger.child({ module: name });
