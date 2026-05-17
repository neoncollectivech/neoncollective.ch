"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import { Input } from "@heroui/input";

import { useDictionary } from "@/i18n/DictionaryContext";
import { NeonButton } from "@/components/neon-button";
import { requestPortalLink } from "@/helpers/stripeApi";

export function ManageDonation() {
  const { dictionary, locale } = useDictionary();
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
      await requestPortalLink({
        email,
        locale,
        returnUrl: `${window.location.origin}/${locale}/donate`,
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
          <Input
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
            variant="bordered"
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
        <p className="mt-4 text-sm text-red-400/80">{t.notFound}</p>
      )}

      {status === "error" && (
        <p className="mt-4 text-sm text-red-400/80">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
