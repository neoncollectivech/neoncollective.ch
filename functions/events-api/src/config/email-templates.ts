import { REGISTRATION_EXCHANGE_TTL_MS } from "./registration";

const registrationTtlMinutes = Math.round(REGISTRATION_EXCHANGE_TTL_MS / 60_000);

export const registrationTemplates = {
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

export const confirmationTemplates = {
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

export const profileVerifyTemplates = {
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
