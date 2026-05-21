import { Resend } from "resend";
import type { Logger } from "pino";

import { createLogger } from "./logger";

export type NeonEmailLocale = "de" | "en" | "it";

export function renderNeonEmailHtml(params: {
  locale: NeonEmailLocale;
  heading: string;
  body: string;
  ctaUrl: string;
  ctaLabel: string;
  footer: string;
  /** Monospace one-time code for manual entry (trusted server-generated). */
  displayCode?: string;
}): string {
  const fontSans =
    "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const fontMono =
    "'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace";

  const codeBlock = params.displayCode
    ? `<tr><td style="padding:0 0 32px">
          <p style="margin:0 0 8px;font-family:${fontSans};font-size:12px;line-height:1.5;color:rgba(240,240,240,0.35)">Code</p>
          <p style="margin:0;font-family:${fontMono};font-size:24px;font-weight:500;letter-spacing:0.2em;color:#f0f0f0">${params.displayCode}</p>
        </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="${params.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#050505;font-family:${fontSans}">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#050505;padding:48px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%">
        <tr><td style="padding:0 0 40px">
          <span style="font-family:${fontMono};font-size:11px;font-weight:500;letter-spacing:0.25em;text-transform:uppercase;color:#FF3131">NEON</span>
        </td></tr>
        <tr><td style="padding:0 0 40px">
          <div style="width:48px;height:1px;background:linear-gradient(90deg,#FF3131,transparent)"></div>
        </td></tr>
        <tr><td style="padding:0 0 16px">
          <h1 style="margin:0;font-family:${fontSans};font-size:22px;font-weight:700;color:#f0f0f0;letter-spacing:-0.01em">${params.heading}</h1>
        </td></tr>
        <tr><td style="padding:0 0 40px">
          <p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.7;color:rgba(240,240,240,0.45)">${params.body}</p>
        </td></tr>
        ${codeBlock}
        <tr><td style="padding:0 0 48px">
          <a href="${params.ctaUrl}" style="display:inline-block;font-family:${fontMono};font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#050505;background:#FF3131;padding:14px 28px;border-radius:2px">${params.ctaLabel}</a>
        </td></tr>
        <tr><td style="padding:0 0 24px">
          <div style="width:100%;height:1px;background:rgba(240,240,240,0.06)"></div>
        </td></tr>
        <tr><td>
          <p style="margin:0;font-family:${fontSans};font-size:12px;line-height:1.6;color:rgba(240,240,240,0.2)">${params.footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type ResendMailer = {
  resend: Resend | null;
  isEmailEnabled: boolean;
  log: Logger;
  fromHeader(): string;
  /** Resend returns `{ data, error }` — branches on `error` and throws with context. */
  sendHtmlEmail(params: { to: string; subject: string; html: string }): Promise<void>;
};

export function createResendMailer(options: {
  /** Child logger `module` field (default `"email"`). */
  module?: string;
  missingApiKeyMessage: string;
}): ResendMailer {
  const log = createLogger(options.module ?? "email");
  const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
  const FROM_EMAIL = process.env.FROM_EMAIL?.trim();
  const FROM_NAME = process.env.FROM_NAME?.trim();
  const isEmailEnabled = resend !== null && Boolean(FROM_EMAIL);

  if (!resend) {
    log.warn(options.missingApiKeyMessage);
  } else if (!FROM_EMAIL) {
    log.warn(
      "FROM_EMAIL not set — Resend will not send (from domain must be verified in Resend)",
    );
  }

  function fromHeader(): string {
    if (!FROM_EMAIL) {
      throw new Error(
        "FROM_EMAIL is not set. Use an address on a domain you verified in the Resend dashboard.",
      );
    }
    return FROM_NAME ? `${FROM_NAME} <${FROM_EMAIL}>` : FROM_EMAIL;
  }

  async function sendHtmlEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (!resend) {
      throw new Error("Email sending is disabled (RESEND_API_KEY not set).");
    }
    const { data, error } = await resend.emails.send({
      from: fromHeader(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      const msg =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error);
      log.error({ error, to: params.to }, "Resend rejected email");
      throw new Error(`Resend: ${msg}`);
    }
    log.info({ to: params.to, id: data?.id }, "Resend accepted email");
  }

  return { resend, isEmailEnabled, log, fromHeader, sendHtmlEmail };
}
