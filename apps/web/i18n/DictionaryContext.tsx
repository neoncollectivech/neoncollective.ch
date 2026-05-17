"use client";

import type { Dictionary } from "./getDictionary";
import type { Locale } from "./config";

import { createContext, useContext, type ReactNode } from "react";

interface DictionaryContextValue {
  dictionary: Dictionary;
  locale: Locale;
}

const DictionaryContext = createContext<DictionaryContextValue | null>(null);

export function DictionaryProvider({
  dictionary,
  locale,
  children,
}: {
  dictionary: Dictionary;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <DictionaryContext.Provider value={{ dictionary, locale }}>
      {children}
    </DictionaryContext.Provider>
  );
}

export function useDictionary(): DictionaryContextValue {
  const ctx = useContext(DictionaryContext);

  if (!ctx) {
    throw new Error("useDictionary must be used within a DictionaryProvider");
  }

  return ctx;
}
