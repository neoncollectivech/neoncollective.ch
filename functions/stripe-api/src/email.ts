import { createResendMailer, renderNeonEmailHtml, type ResendMailer } from "@neon/server-kit";

import { getStripeApiEnv } from "./config/runtime-env";

let mailer: ResendMailer | null = null;

function getMailer(): ResendMailer {
  if (!mailer) {
    const env = getStripeApiEnv();
    mailer = createResendMailer({
      missingApiKeyMessage: "RESEND_API_KEY not set — magic link emails are disabled",
      resendApiKey: env.resendApiKey,
      fromEmail: env.fromEmail,
      fromName: env.fromName,
    });
  }
  return mailer;
}

/** Resend is wired only when both API key and a verified `from` address are set. */
export function isEmailEnabled(): boolean {
  return getMailer().isEmailEnabled;
}

const templates = {
  de: {
    subject: "Deine NEON Spende verwalten",
    heading: "Jährliche Spende verwalten",
    body: "Klicke auf den Button unten, um deine NEON-Spende zu verwalten. Der Link ist 15 Minuten gültig.",
    cta: "Spende verwalten",
    footer:
      "Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.",
  },
  en: {
    subject: "Manage your NEON donation",
    heading: "Manage your yearly donation",
    body: "Click the button below to manage your NEON donation. This link expires in 15 minutes.",
    cta: "Manage Donation",
    footer:
      "If you did not request this email, you can safely ignore it.",
  },
  it: {
    subject: "Gestisci la tua donazione NEON",
    heading: "Gestisci la donazione annuale",
    body: "Clicca il pulsante qui sotto per gestire la tua donazione NEON. Il link scade tra 15 minuti.",
    cta: "Gestisci la donazione",
    footer:
      "Se non hai richiesto questa email, puoi ignorarla in tutta sicurezza.",
  },
} as const;

export async function sendMagicLinkEmail(params: {
  to: string;
  magicLink: string;
  locale: "de" | "en" | "it";
}): Promise<void> {
  const t = templates[params.locale];
  const m = getMailer();

  m.log.debug({ to: params.to, locale: params.locale }, "Sending magic link email");

  await m.sendHtmlEmail({
    to: params.to,
    subject: t.subject,
    html: renderNeonEmailHtml({
      locale: params.locale,
      heading: t.heading,
      body: t.body,
      ctaUrl: params.magicLink,
      ctaLabel: t.cta,
      footer: t.footer,
    }),
  });
}

export function resetStripeEmailMailer(): void {
  mailer = null;
}
