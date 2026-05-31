"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import {
  appendLinkQueryToSearchParams,
  writeStored,
} from "@/helpers/event-link-query";

type SolidarityCodeFieldProps = {
  labels: {
    toggle: string;
    placeholder: string;
    apply: string;
  };
};

export function SolidarityCodeField({ labels }: SolidarityCodeFieldProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  function handleApply() {
    const trimmed = code.trim();

    if (!trimmed) {
      return;
    }

    writeStored("events", "promo", trimmed);
    const params = appendLinkQueryToSearchParams(
      new URLSearchParams(searchParams.toString()),
      { promo: trimmed },
    );
    const qs = params.toString();

    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="mt-4">
      <button
        className="text-xs text-foreground/45 hover:text-foreground/65 underline-offset-2 hover:underline"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        {labels.toggle}
      </button>
      {open ? (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <NeonInput
            className="flex-1"
            data-testid="solidarity-code-input"
            placeholder={labels.placeholder}
            value={code}
            onValueChange={setCode}
          />
          <NeonButton
            className="shrink-0"
            data-testid="solidarity-code-apply"
            type="button"
            variant="bordered"
            onPress={handleApply}
          >
            {labels.apply}
          </NeonButton>
        </div>
      ) : null}
    </div>
  );
}
