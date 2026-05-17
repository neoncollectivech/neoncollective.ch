"use client";

import type { ProfileModalLabels } from "@/hooks/use-events-api";

import { useCallback, useEffect, useState } from "react";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";

import { FormError } from "@/components/form-error";
import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import { apiErrorMessage } from "@/helpers/apiErrorMessage";
import { useLocale } from "@/hooks/use-locale";
import {
  confirmProfileVerification,
  requestProfileVerification,
  updateParticipantProfile,
  type ParticipantProfile,
} from "@/helpers/eventsApi";

type Step = "details" | "verify";

type ParticipantProfileModalProps = {
  open: boolean;
  /** When true, the user can close without saving (manage flow). */
  dismissable?: boolean;
  initialProfile?: ParticipantProfile;
  labels: ProfileModalLabels;
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
    if (initialProfile) {
      setGivenName(initialProfile.givenName);
      setFamilyName(initialProfile.familyName);
      setEmail(initialProfile.email ?? "");
      setPhone(initialProfile.phoneE164 ?? "");
      setProfile(initialProfile);
    }
  }, [initialProfile]);

  const saveMutation = useMutation({
    mutationFn: () => {
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
        return Promise.resolve(initialProfile);
      }

      return updateParticipantProfile(payload);
    },
    onSuccess: async (saved) => {
      setProfile(saved);
      const formValues = { givenName, familyName, email, phone };
      const unchanged = isProfileFormUnchanged(initialProfile, formValues);
      const pending = channelsToVerify(saved);

      if (pending.length === 0) {
        onComplete(saved);

        return;
      }
      if (unchanged) {
        onComplete(saved);

        return;
      }
      const ch = pending[0] ?? saved.pendingVerification;

      if (!ch) {
        onComplete(saved);

        return;
      }
      setVerifyChannel(ch);
      setStep("verify");
      setCode("");
      await requestProfileVerification({ channel: ch, locale });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => confirmProfileVerification({ code: code.trim() }),
    onSuccess: async (updated) => {
      setProfile(updated);
      setCode("");
      if (updated.profileComplete) {
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
      await requestProfileVerification({ channel: next, locale });
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => {
      if (!verifyChannel) {
        throw new Error("No channel");
      }

      return requestProfileVerification({ channel: verifyChannel, locale });
    },
  });

  const verifyHint =
    verifyChannel === "phone" ? labels.verifyPhoneHint : labels.verifyEmailHint;

  const handleResend = useCallback(() => {
    if (verifyChannel) {
      resendMutation.mutate();
    }
  }, [verifyChannel, resendMutation]);

  return (
    <Modal
      hideCloseButton={!dismissable}
      isDismissable={dismissable}
      isKeyboardDismissDisabled={!dismissable}
      isOpen={open}
      placement="center"
      scrollBehavior="inside"
      size="lg"
      onClose={() => onDismiss?.()}
    >
      <ModalContent className="bg-background border border-foreground/10 rounded-none">
        <ModalHeader className="flex flex-col gap-1 border-b border-foreground/10">
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground/90">
            {step === "details" ? labels.title : labels.verifyTitle}
          </h2>
          <p className="text-sm font-normal text-foreground/45">
            {step === "details" ? labels.subtitle : verifyHint}
          </p>
        </ModalHeader>
        <ModalBody className="py-8">
          {step === "details" ? (
            <form
              className="space-y-4 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
            >
              <NeonInput
                isRequired
                label={labels.givenName}
                value={givenName}
                onValueChange={setGivenName}
              />
              <NeonInput
                isRequired
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
                if (!code.trim()) {
                  return;
                }
                verifyMutation.mutate();
              }}
            >
              <NeonInput
                isRequired
                classNames={{
                  input:
                    "text-sm text-foreground/80 font-mono uppercase tracking-wider",
                }}
                label={labels.verifyCodeLabel}
                maxLength={6}
                placeholder={labels.verifyCodePlaceholder}
                value={code}
                onValueChange={setCode}
              />
              <div className="flex flex-wrap gap-3">
                <NeonButton
                  isDisabled={verifyMutation.isPending || !code.trim()}
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
