import { generateCookie } from "hono/cookie";

import { getEventsApiEnv } from "../../config/runtime-env";

export const PARTICIPANT_SESSION_COOKIE = "neon_ev_participant";

function sessionMaxAgeSec(): number {
  return getEventsApiEnv().participantSessionMaxAgeSec;
}

function cookieOptions(crossSite: boolean): Parameters<typeof generateCookie>[2] {
  const maxAge = sessionMaxAgeSec();
  if (crossSite) {
    return {
      path: "/",
      maxAge,
      httpOnly: true,
      secure: true,
      sameSite: "None",
    };
  }
  const secure = getEventsApiEnv().nodeEnv === "production";
  return {
    path: "/",
    maxAge,
    httpOnly: true,
    secure,
    sameSite: "Lax",
  };
}

export function buildSessionCookieHeader(token: string, crossSite: boolean): string {
  return generateCookie(PARTICIPANT_SESSION_COOKIE, token, cookieOptions(crossSite));
}

export function buildClearSessionCookieHeader(crossSite: boolean): string {
  return generateCookie(PARTICIPANT_SESSION_COOKIE, "", {
    ...cookieOptions(crossSite),
    maxAge: 0,
  });
}
