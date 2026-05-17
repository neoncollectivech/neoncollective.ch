"use client";

import type { Locale } from "@/i18n/config";

import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Spinner } from "@heroui/react";

import { FormError } from "@/components/form-error";
import { apiErrorMessage } from "@/helpers/apiErrorMessage";
import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import { NeonLink } from "@/components/neon-link";
import { useDictionary } from "@/i18n/DictionaryContext";
import {
  exchangeRegistrationSessionCode,
  fetchParticipantSessionStatus,
  requestRegistrationSessionLink,
} from "@/helpers/eventsApi";
import { participantSessionQueryKey } from "@/helpers/queryKeys";

type ParticipantSessionPanelProps = {
  locale: Locale;
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
  locale,
  returnPath,
  codeExchangePending,
  embedded,
  contact: controlledContact,
  onContactChange,
  sessionEstablishedQueryKeys = [],
  onManageProfile,
}: ParticipantSessionPanelProps) {
  const { dictionary } = useDictionary();
  const t = dictionary.events;
  const queryClient = useQueryClient();

  const isControlled = onContactChange != null;
  const [internalContact, setInternalContact] = useState("");
  const contact = isControlled ? (controlledContact ?? "") : internalContact;
  const setContact = isControlled ? onContactChange : setInternalContact;

  const [awaitingCode, setAwaitingCode] = useState(false);
  const [accessChannel, setAccessChannel] = useState<"email" | "sms" | null>(
    null,
  );
  const [accessCode, setAccessCode] = useState("");

  const sessionStatusQuery = useQuery({
    queryKey: participantSessionQueryKey,
    queryFn: fetchParticipantSessionStatus,
    enabled: !codeExchangePending,
    retry: false,
  });

  const sessionEstablished = sessionStatusQuery.data?.session === true;

  const sessionMutation = useMutation({
    mutationFn: () =>
      requestRegistrationSessionLink({
        contact,
        locale,
        returnUrl: `${window.location.origin}${returnPath}`,
      }),
    retry: false,
    onSuccess: (channel) => {
      setAccessChannel(channel);
      setAwaitingCode(true);
      setAccessCode("");
    },
  });

  const exchangeMutation = useMutation({
    mutationFn: (code: string) => exchangeRegistrationSessionCode(code),
    onSuccess: async () => {
      setAwaitingCode(false);
      setAccessCode("");
      setAccessChannel(null);
      sessionMutation.reset();
      await queryClient.invalidateQueries({
        queryKey: participantSessionQueryKey,
      });
      await queryClient.fetchQuery({
        queryKey: participantSessionQueryKey,
        queryFn: fetchParticipantSessionStatus,
      });
      for (const key of sessionEstablishedQueryKeys) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

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
            if (!accessCode.trim()) {
              return;
            }
            exchangeMutation.mutate(accessCode.trim());
          }}
        >
          <NeonInput
            isRequired
            classNames={{
              input:
                "text-sm text-foreground/80 font-mono uppercase tracking-wider",
            }}
            label={t.sessionCodeLabel}
            maxLength={6}
            placeholder={t.sessionCodePlaceholder}
            type="text"
            value={accessCode}
            onValueChange={setAccessCode}
          />
          <NeonButton
            isDisabled={exchangeMutation.isPending || !accessCode.trim()}
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
      {!isControlled ? (
        <div className="mb-4 max-w-md">
          <NeonInput
            isRequired
            label={t.sessionContactLabel}
            placeholder={t.sessionContactPlaceholder}
            type="text"
            value={contact}
            onValueChange={setContact}
          />
        </div>
      ) : null}
      <form
        className="flex flex-col sm:flex-row gap-3 items-start"
        onSubmit={(e) => {
          e.preventDefault();
          if (!contact.trim()) {
            return;
          }
          sessionMutation.mutate();
        }}
      >
        <NeonButton
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
