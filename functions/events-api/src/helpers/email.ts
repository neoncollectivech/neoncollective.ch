import {
  createResendMailer,
  renderNeonEmailHtml,
} from "@neon/server-kit";

import {
  confirmationTemplates,
  profileVerifyTemplates,
  registrationTemplates,
} from "../config/email-templates";

const mailer = createResendMailer({
  missingApiKeyMessage: "RESEND_API_KEY not set — event emails are disabled",
});

/** Resend is wired only when both API key and a verified `from` address are set. */
export const isEmailEnabled = mailer.isEmailEnabled;

export async function sendProfileVerificationEmail(params: {
  to: string;
  code: string;
  locale: "de" | "en" | "it";
}): Promise<void> {
  const t = profileVerifyTemplates[params.locale];
  const site = process.env.PUBLIC_SITE_URL ?? "http://localhost:3000";
  let ctaUrl: string;
  try {
    ctaUrl = new URL(site).origin;
  } catch {
    ctaUrl = "http://localhost:3000";
  }
  const ctaLabel =
    params.locale === "de"
      ? "Zur Website"
      : params.locale === "it"
        ? "Vai al sito"
        : "Go to site";
  await mailer.sendHtmlEmail({
    to: params.to,
    subject: t.subject,
    html: renderNeonEmailHtml({
      locale: params.locale,
      heading: t.heading,
      body: t.body,
      ctaUrl,
      ctaLabel,
      footer: t.footer,
      displayCode: params.code,
    }),
  });
}

export async function sendRegistrationAccessEmail(params: {
  to: string;
  accessUrl: string;
  code: string;
  locale: "de" | "en" | "it";
}): Promise<void> {
  const t = registrationTemplates[params.locale];
  await mailer.sendHtmlEmail({
    to: params.to,
    subject: t.subject,
    html: renderNeonEmailHtml({
      locale: params.locale,
      heading: t.heading,
      body: t.body,
      ctaUrl: params.accessUrl,
      ctaLabel: t.cta,
      footer: t.footer,
      displayCode: params.code,
    }),
  });
}

export async function sendContributionConfirmationEmail(params: {
  to: string;
  accessUrl: string;
  code: string;
  locale: "de" | "en" | "it";
}): Promise<void> {
  if (!mailer.isEmailEnabled) {
    mailer.log.warn(
      { to: params.to },
      "Skipping confirmation email — RESEND_API_KEY or FROM_EMAIL not set",
    );
    return;
  }
  const t = confirmationTemplates[params.locale];
  await mailer.sendHtmlEmail({
    to: params.to,
    subject: t.subject,
    html: renderNeonEmailHtml({
      locale: params.locale,
      heading: t.heading,
      body: t.body,
      ctaUrl: params.accessUrl,
      ctaLabel: t.cta,
      footer: t.footer,
      displayCode: params.code,
    }),
  });
}
