"use client";

import type { QueryKey } from "@tanstack/react-query";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@heroui/react";

import { FormError } from "@/components/form-error";
import { apiErrorMessage } from "@/helpers/apiErrorMessage";
import { absoluteSiteUrl } from "@/helpers/site-url";
import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import { NeonOtpInput } from "@/components/neon-otp-input";
import { NeonLink } from "@/components/neon-link";
import { useDictionary } from "@/i18n/DictionaryContext";
import { useLocale } from "@/hooks/use-locale";
import { eventsApi } from "@/hooks/use-events-api";

type ParticipantSessionPanelProps = {
  returnPath: string;
  codeExchangePending?: boolean;
  /** Parent provides section title (e.g. on events index card). */
  embedded?: boolean;
  contact?: string;
  onContactChange?: (value: string) => void;
  sessionEstablishedQueryKeys?: QueryKey[];
  onManageProfile?: () => void;
};

export function ParticipantSessionPanel({
  returnPath,
  codeExchangePending,
  embedded,
  contact: controlledContact,
  onContactChange,
  sessionEstablishedQueryKeys = [],
  onManageProfile,
}: ParticipantSessionPanelProps) {
  const locale = useLocale();
  const { dictionary } = useDictionary();
  const t = dictionary.events;
  const queryClient = useQueryClient();

  const searchParams = useSearchParams();
  const loginPrefill = searchParams.get("login")?.trim() ?? "";

  const isControlled = onContactChange != null;
  const [internalContact, setInternalContact] = useState("");
  const contact = isControlled ? (controlledContact ?? "") : internalContact;
  const setContact = isControlled ? onContactChange : setInternalContact;

  const [awaitingCode, setAwaitingCode] = useState(false);
  const [accessChannel, setAccessChannel] = useState<"email" | "sms" | null>(
    null,
  );
  const [accessCode, setAccessCode] = useState("");

  const sessionStatusQuery = useQuery(
    eventsApi.participant.session({ enabled: !codeExchangePending }),
  );
  const sessionMutation = useMutation(eventsApi.registration.requestSession());
  const exchangeMutation = useMutation(
    eventsApi.registration.exchangeSession(),
  );

  const sessionEstablished = sessionStatusQuery.data?.session === true;

  useEffect(() => {
    if (
      !loginPrefill ||
      codeExchangePending ||
      sessionStatusQuery.isLoading ||
      sessionEstablished
    ) {
      return;
    }
    if (isControlled) {
      if (!controlledContact?.trim()) {
        onContactChange?.(loginPrefill);
      }

      return;
    }
    setInternalContact((prev) => (prev.trim() ? prev : loginPrefill));
  }, [
    codeExchangePending,
    controlledContact,
    isControlled,
    loginPrefill,
    onContactChange,
    sessionEstablished,
    sessionStatusQuery.isLoading,
  ]);

  const requestSession = useCallback(() => {
    const trimmed = contact.trim();

    if (!trimmed || sessionMutation.isPending) {
      return;
    }
    sessionMutation.mutate(
      {
        contact: trimmed,
        locale,
        returnUrl: absoluteSiteUrl(returnPath),
      },
      {
        onSuccess: (channel) => {
          setAccessChannel(channel);
          setAwaitingCode(true);
          setAccessCode("");
        },
      },
    );
  }, [contact, locale, returnPath, sessionMutation]);

  if (codeExchangePending || sessionStatusQuery.isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner color="success" size="md" />
      </div>
    );
  }

  if (sessionEstablished) {
    const displayName = [
      sessionStatusQuery.data?.givenName,
      sessionStatusQuery.data?.familyName,
    ]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");
    const welcomeLine = displayName
      ? t.sessionWelcomeBack.replaceAll("{name}", displayName)
      : t.sessionWelcomeBackNoName;

    return (
      <section className="max-w-xl space-y-3">
        <p className="text-base md:text-lg font-semibold text-foreground/90 tracking-tight">
          {welcomeLine}
        </p>
        {onManageProfile ? (
          <NeonLink
            as="button"
            className="font-semibold normal-case tracking-tight"
            neonStyle="inline"
            type="button"
            onPress={onManageProfile}
          >
            {t.sessionManageProfile}
            <span aria-hidden="true">&rarr;</span>
          </NeonLink>
        ) : null}
      </section>
    );
  }

  if (awaitingCode && accessChannel) {
    const sentHint =
      accessChannel === "email" ? t.sessionCodeSentEmail : t.sessionCodeSentSms;

    return (
      <section className="max-w-xl">
        <h2 className="text-base font-semibold text-foreground/80 mb-3 tracking-tight">
          {t.sessionCodeStepTitle}
        </h2>
        <p className="text-sm text-neon/80 font-mono mb-4">{sentHint}</p>
        <form
          className="space-y-3 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (accessCode.length < 6) {
              return;
            }
            exchangeMutation.mutate(accessCode, {
              onSuccess: async () => {
                setAwaitingCode(false);
                setAccessCode("");
                setAccessChannel(null);
                sessionMutation.reset();
                for (const key of sessionEstablishedQueryKeys) {
                  await queryClient.invalidateQueries({ queryKey: key });
                }
              },
            });
          }}
        >
          <NeonOtpInput
            required
            data-testid="participant-session-code"
            label={t.sessionCodeLabel}
            value={accessCode}
            onChange={setAccessCode}
          />
          <NeonButton
            data-testid="participant-session-submit"
            isDisabled={exchangeMutation.isPending || accessCode.length < 6}
            type="submit"
            variant="bordered"
          >
            {exchangeMutation.isPending ? "…" : t.sessionCodeCta}
          </NeonButton>
        </form>
        {exchangeMutation.isError ? (
          <FormError className="mt-2">{t.sessionError}</FormError>
        ) : null}
      </section>
    );
  }

  return (
    <section className="max-w-xl">
      {!embedded ? (
        <h2 className="text-base font-normal text-foreground/70 mb-4 leading-relaxed max-w-md">
          {t.sessionIntro}
        </h2>
      ) : (
        <p className="text-sm text-foreground/50 mb-4 leading-relaxed max-w-md">
          {t.sessionIntro}
        </p>
      )}
      <form
        className="flex flex-col gap-4 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          requestSession();
        }}
      >
        {!isControlled ? (
          <NeonInput
            isRequired
            autoComplete="email tel"
            data-testid="participant-session-contact"
            label={t.sessionContactLabel}
            name="contact"
            placeholder={t.sessionContactPlaceholder}
            type="text"
            value={contact}
            onValueChange={setContact}
          />
        ) : null}
        <NeonButton
          className="self-start"
          isDisabled={sessionMutation.isPending || !contact.trim()}
          type="submit"
          variant="bordered"
        >
          {sessionMutation.isPending ? "…" : t.sessionCta}
        </NeonButton>
      </form>
      {sessionMutation.isError ? (
        <FormError className="mt-2">
          {apiErrorMessage(sessionMutation.error, t.sessionNotFound)}
        </FormError>
      ) : null}
    </section>
  );
}
