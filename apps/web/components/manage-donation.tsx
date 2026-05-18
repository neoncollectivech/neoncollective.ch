"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AxiosError } from "axios";

import { FormError } from "@/components/form-error";
import { absoluteSiteUrl } from "@/helpers/site-url";
import { useDictionary } from "@/i18n/DictionaryContext";
import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import { useLocale } from "@/hooks/use-locale";
import { stripeApi } from "@/hooks/use-stripe-api";

export function ManageDonation() {
  const { dictionary } = useDictionary();
  const locale = useLocale();
  const portalMutation = useMutation(stripeApi.portal.link());
  const t = dictionary.manageDonation;

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "sent" | "not_found" | "error"
  >("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email) return;

    setStatus("loading");

    try {
      await portalMutation.mutateAsync({
        email,
        locale,
        returnUrl: absoluteSiteUrl(`/${locale}/donate`),
      });
      setStatus("sent");
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        setStatus("not_found");
      } else {
        setStatus("error");
      }
    }
  }

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground/90 mb-2">
        {t.title}
      </h2>
      <p className="text-sm md:text-base text-foreground/40 leading-relaxed mb-8 max-w-xl">
        {t.description}
      </p>

      {status === "sent" ? (
        <p className="text-sm text-neon/80 font-mono leading-relaxed">
          {t.emailSent}
        </p>
      ) : (
        <form
          className="flex flex-col sm:flex-row gap-3 items-start"
          onSubmit={handleSubmit}
        >
          <NeonInput
            isRequired
            classNames={{
              inputWrapper:
                "bg-transparent border border-foreground/10 data-[hover=true]:border-foreground/20 group-data-[focus=true]:border-neon/40 rounded-none",
              input:
                "text-sm text-foreground/80 placeholder:text-foreground/20",
            }}
            isDisabled={status === "loading"}
            name="email"
            placeholder={t.emailPlaceholder}
            type="email"
            value={email}
            onValueChange={(val) => {
              setEmail(val);
              if (status === "not_found" || status === "error") {
                setStatus("idle");
              }
            }}
          />
          <NeonButton
            className="min-w-fit"
            isDisabled={status === "loading" || !email}
            type="submit"
          >
            {status === "loading" ? "…" : t.cta}
          </NeonButton>
        </form>
      )}

      {status === "not_found" && (
        <FormError className="mt-4">{t.notFound}</FormError>
      )}

      {status === "error" && (
        <FormError className="mt-4">
          Something went wrong. Please try again.
        </FormError>
      )}
    </div>
  );
}
