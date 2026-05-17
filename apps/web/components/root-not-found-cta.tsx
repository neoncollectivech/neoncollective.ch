"use client";

import { HeroUIProvider } from "@heroui/system";

import { NeonLink } from "@/components/neon-link";

export function RootNotFoundCta() {
  return (
    <HeroUIProvider>
      <NeonLink className="mt-10" href="/" neonStyle="cta">
        Go home
      </NeonLink>
    </HeroUIProvider>
  );
}
