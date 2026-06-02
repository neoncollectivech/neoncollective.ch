"use client";

import type { ProfileModalLabels } from "@/hooks/use-events-api";

import { useDictionary } from "@/i18n/DictionaryContext";

export function useProfileModalLabels(): ProfileModalLabels {
  const { dictionary } = useDictionary();
  const t = dictionary.events;

  return {
    title: t.profileModalTitle,
    subtitle: t.profileModalSubtitle,
    givenName: t.profileGivenName,
    familyName: t.profileFamilyName,
    email: t.email,
    phone: t.phone,
    phoneOptional: t.profilePhoneOptional,
    contactHint: t.profileContactHint,
    saveCta: t.profileSaveCta,
    verifyTitle: t.profileVerifyTitle,
    verifyEmailHint: t.profileVerifyEmailHint,
    verifyPhoneHint: t.profileVerifyPhoneHint,
    verifyCodeLabel: t.sessionCodeLabel,
    verifyCodePlaceholder: t.sessionCodePlaceholder,
    verifyCta: t.sessionCodeCta,
    resendCta: t.profileResendCta,
    errorGeneric: t.profileErrorGeneric,
  };
}
