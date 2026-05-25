import type { EventsApiEnv } from "../config/runtime-env";
import { AC_SID_RE, MG_SID_RE } from "../config/sms";

export type TwilioCredentials =
  | {
      accountSid: string;
      authUsername: string;
      authPassword: string;
    }
  | null;

export type TwilioOutboundParams =
  | { messagingServiceSid: string }
  | { from: string }
  | { error: string };

export function resolveTwilioCredentials(env: EventsApiEnv): TwilioCredentials {
  const accountSid = env.twilioAccountSid;
  if (!accountSid || !AC_SID_RE.test(accountSid)) {
    return null;
  }
  if (env.twilioApiKeySid && env.twilioApiKeySecret) {
    return {
      accountSid,
      authUsername: env.twilioApiKeySid,
      authPassword: env.twilioApiKeySecret,
    };
  }
  if (env.twilioAuthToken) {
    return {
      accountSid,
      authUsername: accountSid,
      authPassword: env.twilioAuthToken,
    };
  }
  return null;
}

export function resolveTwilioOutboundParams(env: EventsApiEnv): TwilioOutboundParams {
  const mg = env.twilioMessagingServiceSid ?? "";
  if (mg.length > 0) {
    if (!MG_SID_RE.test(mg)) {
      return {
        error:
          "TWILIO_MESSAGING_SERVICE_SID must look like MG + 32 hex chars (Messaging Service SID from Twilio Console).",
      };
    }
    return { messagingServiceSid: mg };
  }

  const raw = env.twilioFrom ?? "";
  if (!raw) {
    return { error: "Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM." };
  }

  if (/^\+[1-9]\d{6,14}$/.test(raw)) {
    return { from: raw };
  }

  const compact = raw.replace(/\s+/g, "");
  if (compact.length < 1) {
    return { error: "TWILIO_FROM is empty after removing spaces." };
  }
  if (compact.length > 11) {
    return {
      error:
        `Alphanumeric TWILIO_FROM must be at most 11 characters for Twilio ("${compact}" is ${compact.length}). Use a short ID (e.g. NEON), a +E.164 Twilio number, or TWILIO_MESSAGING_SERVICE_SID with senders configured in Twilio.`,
    };
  }
  return { from: compact };
}

export function isTwilioOutboundConfigured(env: EventsApiEnv): boolean {
  const resolved = resolveTwilioOutboundParams(env);
  return !("error" in resolved);
}

type TwilioErrorBody = {
  message?: string;
  more_info?: string;
};

export async function sendTwilioSms(params: {
  credentials: TwilioCredentials;
  to: string;
  body: string;
  outbound: Exclude<TwilioOutboundParams, { error: string }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!params.credentials) {
    return { ok: false, error: "Twilio credentials not configured." };
  }

  const { accountSid, authUsername, authPassword } = params.credentials;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams({
    To: params.to,
    Body: params.body,
  });
  if ("messagingServiceSid" in params.outbound) {
    form.set("MessagingServiceSid", params.outbound.messagingServiceSid);
  } else {
    form.set("From", params.outbound.from);
  }

  const auth = btoa(`${authUsername}:${authPassword}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (res.ok) {
    return { ok: true };
  }

  let message = `Twilio HTTP ${res.status}`;
  try {
    const data = (await res.json()) as TwilioErrorBody;
    if (data.message) {
      message = data.message;
    }
  } catch {
    // ignore non-JSON error bodies
  }

  return { ok: false, error: message };
}
