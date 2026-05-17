import {
  createResendMailer,
  renderNeonEmailHtml,
} from "@neon/server-kit";

import { REGISTRATION_EXCHANGE_TTL_MS } from "./registration-exchange-constants.js";

const mailer = createResendMailer({
  missingApiKeyMessage: "RESEND_API_KEY not set — event emails are disabled",
});

/** Resend is wired only when both API key and a verified `from` address are set. */
export const isEmailEnabled = mailer.isEmailEnabled;

const registrationTtlMinutes = Math.round(REGISTRATION_EXCHANGE_TTL_MS / 60_000);

const registrationTemplates = {
  de: {
    subject: "NEON — Zugang zu deiner Anmeldung",
    heading: "Dein Zugangscode",
    body: `Nutze den Button oder gib den Code unten auf der Website ein. Gültig ${registrationTtlMinutes} Minuten.`,
    cta: "Zugang öffnen",
    footer:
      "Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.",
  },
  en: {
    subject: "NEON — Access to your registration",
    heading: "Your access code",
    body: `Use the button or enter the code below on the site. Valid for ${registrationTtlMinutes} minutes.`,
    cta: "Open access",
    footer: "If you did not request this email, you can safely ignore it.",
  },
  it: {
    subject: "NEON — Accesso alla tua registrazione",
    heading: "Il tuo codice di accesso",
    body: `Usa il pulsante oppure inserisci il codice qui sotto sul sito. Valido per ${registrationTtlMinutes} minuti.`,
    cta: "Apri l'accesso",
    footer: "Se non hai richiesto questa email, puoi ignorarla in tutta sicurezza.",
  },
} as const;

const confirmationTemplates = {
  de: {
    subject: "NEON — Danke für deinen Beitrag",
    heading: "Dein Platz ist reserviert",
    body: `Wir haben deinen Beitrag erhalten. Nutze den Button oder den Code unten — gültig ${registrationTtlMinutes} Minuten.`,
    cta: "Meine Plätze anzeigen",
    footer: "Wir freuen uns auf dich.",
  },
  en: {
    subject: "NEON — Thank you for your contribution",
    heading: "Your place is reserved",
    body: `We received your contribution. Use the button or the code below — valid for ${registrationTtlMinutes} minutes.`,
    cta: "View my places",
    footer: "We look forward to seeing you.",
  },
  it: {
    subject: "NEON — Grazie per il tuo contributo",
    heading: "Il tuo posto è riservato",
    body: `Abbiamo ricevuto il tuo contributo. Usa il pulsante o il codice qui sotto — valido per ${registrationTtlMinutes} minuti.`,
    cta: "Vedi i miei posti",
    footer: "Non vediamo l'ora di vederti.",
  },
} as const;

const profileVerifyTemplates = {
  de: {
    subject: "NEON — Bestätige dein Profil",
    heading: "Dein Bestätigungscode",
    body: `Gib den Code auf der Website ein, um dein Profil abzuschließen. Gültig ${registrationTtlMinutes} Minuten.`,
    footer: "Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.",
  },
  en: {
    subject: "NEON — Confirm your profile",
    heading: "Your verification code",
    body: `Enter this code on the site to complete your profile. Valid for ${registrationTtlMinutes} minutes.`,
    footer: "If you did not request this email, you can safely ignore it.",
  },
  it: {
    subject: "NEON — Conferma il tuo profilo",
    heading: "Il tuo codice di verifica",
    body: `Inserisci il codice sul sito per completare il profilo. Valido per ${registrationTtlMinutes} minuti.`,
    footer: "Se non hai richiesto questa email, puoi ignorarla in tutta sicurezza.",
  },
} as const;

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
