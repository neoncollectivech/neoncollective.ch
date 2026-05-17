"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/helpers/queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={router.push}>{children}</HeroUIProvider>
    </QueryClientProvider>
  );
}
