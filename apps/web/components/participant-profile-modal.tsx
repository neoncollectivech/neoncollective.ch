"use client";

import type { ProfileModalLabels } from "@/hooks/use-events-api";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";

import {
  neonModalChrome,
  neonModalClassName,
  neonPanelBodyPaddingClass,
} from "@/config/modal-chrome";
import { FormError } from "@/components/form-error";
import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import { NeonOtpInput } from "@/components/neon-otp-input";
import { apiErrorMessage } from "@/helpers/apiErrorMessage";
import { useLocale } from "@/hooks/use-locale";
import { eventsApi } from "@/hooks/use-events-api";
import { type ParticipantProfile } from "@/helpers/eventsApi";

type Step = "details" | "verify";

type ParticipantProfileModalProps = {
  open: boolean;
  /** When true, the user can close without saving (manage flow). */
  dismissable?: boolean;
  initialProfile?: ParticipantProfile;
  labels: ProfileModalLabels;
  /** Event-scoped heading, e.g. "Join {eventTitle}". */
  contextTitle?: string;
  onComplete: (profile: ParticipantProfile) => void;
  onDismiss?: () => void;
};

function channelsToVerify(profile: ParticipantProfile): ("email" | "phone")[] {
  const out: ("email" | "phone")[] = [];

  if (profile.email?.trim() && !profile.emailVerified) {
    out.push("email");
  }
  if (profile.phoneE164?.trim() && !profile.phoneVerified) {
    out.push("phone");
  }

  return out;
}

function phoneDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isProfileFormUnchanged(
  initial: ParticipantProfile | undefined,
  values: {
    givenName: string;
    familyName: string;
    email: string;
    phone: string;
  },
): boolean {
  if (!initial) {
    return false;
  }
  const formEmail = values.email.trim().toLowerCase();
  const initialEmail = (initial.email?.trim() ?? "").toLowerCase();

  return (
    values.givenName.trim() === initial.givenName.trim() &&
    values.familyName.trim() === initial.familyName.trim() &&
    formEmail === initialEmail &&
    phoneDigitsOnly(values.phone) === phoneDigitsOnly(initial.phoneE164 ?? "")
  );
}

/** Every contact field on the profile is present and already verified. */
function profileContactsVerified(profile: ParticipantProfile): boolean {
  const emailOk = !profile.email?.trim() || profile.emailVerified;
  const phoneOk = !profile.phoneE164?.trim() || profile.phoneVerified;

  return emailOk && phoneOk;
}

export function ParticipantProfileModal({
  open,
  dismissable = false,
  initialProfile,
  labels,
  contextTitle,
  onComplete,
  onDismiss,
}: ParticipantProfileModalProps) {
  const locale = useLocale();
  const [step, setStep] = useState<Step>("details");
  const [givenName, setGivenName] = useState(initialProfile?.givenName ?? "");
  const [familyName, setFamilyName] = useState(
    initialProfile?.familyName ?? "",
  );
  const [email, setEmail] = useState(initialProfile?.email ?? "");
  const [phone, setPhone] = useState(initialProfile?.phoneE164 ?? "");
  const [verifyChannel, setVerifyChannel] = useState<"email" | "phone" | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [, setProfile] = useState<ParticipantProfile | undefined>(
    initialProfile,
  );

  useEffect(() => {
    if (!initialProfile) {
      return;
    }
    setProfile(initialProfile);
    if (step === "verify") {
      return;
    }
    setGivenName(initialProfile.givenName);
    setFamilyName(initialProfile.familyName);
    setEmail(initialProfile.email ?? "");
    setPhone(initialProfile.phoneE164 ?? "");
  }, [initialProfile, step]);

  const updateProfileMutation = useMutation(eventsApi.profile.update());
  const requestVerificationMutation = useMutation(
    eventsApi.profile.requestVerification(),
  );
  const resendMutation = useMutation(eventsApi.profile.requestVerification());

  async function afterProfileSaved(saved: ParticipantProfile) {
    setProfile(saved);
    const pending = channelsToVerify(saved);

    if (pending.length === 0) {
      onComplete(saved);

      return;
    }
    const ch = pending[0] ?? saved.pendingVerification;

    if (!ch) {
      onComplete(saved);

      return;
    }
    await requestVerificationMutation.mutateAsync({ channel: ch, locale });
    setVerifyChannel(ch);
    setStep("verify");
    setCode("");
  }

  const saveMutation = updateProfileMutation;

  const verifyMutation = useMutation({
    ...eventsApi.profile.confirmVerification(),
    onSuccess: async (updated) => {
      setProfile(updated);
      setCode("");
      if (profileContactsVerified(updated)) {
        onComplete(updated);

        return;
      }
      const pending = channelsToVerify(updated);
      const next = pending[0] ?? null;

      if (!next) {
        onComplete(updated);

        return;
      }
      setVerifyChannel(next);
      await requestVerificationMutation.mutateAsync({ channel: next, locale });
    },
  });

  function handleSaveSubmit() {
    const payload = {
      givenName: givenName.trim(),
      familyName: familyName.trim(),
      email: email.trim() || null,
      phoneE164: phone.trim() || null,
    };

    if (
      initialProfile &&
      isProfileFormUnchanged(initialProfile, {
        givenName,
        familyName,
        email,
        phone,
      }) &&
      profileContactsVerified(initialProfile)
    ) {
      void afterProfileSaved(initialProfile);

      return;
    }

    updateProfileMutation.mutate(payload, {
      onSuccess: (saved) => {
        void afterProfileSaved(saved);
      },
    });
  }

  const verifyHint =
    verifyChannel === "phone" ? labels.verifyPhoneHint : labels.verifyEmailHint;

  const handleResend = useCallback(() => {
    if (!verifyChannel) {
      return;
    }
    resendMutation.mutate({ channel: verifyChannel, locale });
  }, [locale, verifyChannel, resendMutation]);

  return (
    <Modal
      {...neonModalChrome}
      hideCloseButton={!dismissable}
      isDismissable={dismissable}
      isKeyboardDismissDisabled={!dismissable}
      isOpen={open}
      placement="center"
      scrollBehavior="inside"
      size="lg"
      onClose={() => onDismiss?.()}
    >
      <ModalContent className={neonModalClassName}>
        <ModalHeader className="flex flex-col gap-1 border-b border-foreground/10">
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground/90">
            {step === "details"
              ? (contextTitle ?? labels.title)
              : labels.verifyTitle}
          </h2>
          <p className="text-sm font-normal text-foreground/45">
            {step === "details"
              ? contextTitle
                ? labels.subtitle
                : labels.subtitle
              : verifyHint}
          </p>
        </ModalHeader>
        <ModalBody className={neonPanelBodyPaddingClass}>
          {step === "details" ? (
            <form
              className="space-y-4 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveSubmit();
              }}
            >
              <NeonInput
                isRequired
                data-testid="participant-profile-given-name"
                label={labels.givenName}
                value={givenName}
                onValueChange={setGivenName}
              />
              <NeonInput
                isRequired
                data-testid="participant-profile-family-name"
                label={labels.familyName}
                value={familyName}
                onValueChange={setFamilyName}
              />
              <NeonInput
                label={labels.email}
                type="email"
                value={email}
                onValueChange={setEmail}
              />
              <NeonInput
                data-testid="participant-profile-phone"
                label={labels.phone}
                placeholder={labels.phoneOptional}
                type="tel"
                value={phone}
                onValueChange={setPhone}
              />
              <p className="text-xs text-foreground/40 font-mono">
                {labels.contactHint}
              </p>
              <NeonButton
                data-testid="participant-profile-save"
                isDisabled={saveMutation.isPending}
                type="submit"
                variant="bordered"
              >
                {saveMutation.isPending ? "…" : labels.saveCta}
              </NeonButton>
              {saveMutation.isError ? (
                <FormError>
                  {apiErrorMessage(saveMutation.error, labels.errorGeneric)}
                </FormError>
              ) : null}
            </form>
          ) : (
            <form
              className="space-y-4 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length < 6) {
                  return;
                }
                verifyMutation.mutate({ code: code.trim() });
              }}
            >
              <NeonOtpInput
                key={verifyChannel ?? "verify"}
                required
                data-testid="participant-profile-verify-code"
                label={labels.verifyCodeLabel}
                value={code}
                onChange={setCode}
              />
              <div className="flex flex-wrap gap-3">
                <NeonButton
                  data-testid="participant-profile-verify-submit"
                  isDisabled={verifyMutation.isPending || code.length < 6}
                  type="submit"
                  variant="bordered"
                >
                  {verifyMutation.isPending ? "…" : labels.verifyCta}
                </NeonButton>
                <NeonButton
                  isDisabled={resendMutation.isPending}
                  type="button"
                  variant="bordered"
                  onPress={handleResend}
                >
                  {resendMutation.isPending ? "…" : labels.resendCta}
                </NeonButton>
              </div>
              {verifyMutation.isError ? (
                <FormError>
                  {apiErrorMessage(verifyMutation.error, labels.errorGeneric)}
                </FormError>
              ) : null}
            </form>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
