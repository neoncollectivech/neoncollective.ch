import {
  locales,
  localeLabels,
  type Locale,
  type LocalizedText,
} from "@neon/site-locales";
import { useState } from "react";

import { MarkdownField } from "@/components/markdown-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type LocalizedFieldsEditorProps = {
  id?: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  variant: "markdown" | "plain";
  minHeight?: number;
};

export function LocalizedFieldsEditor({
  id,
  value,
  onChange,
  variant,
  minHeight = 200,
}: LocalizedFieldsEditorProps) {
  const [activeLocale, setActiveLocale] = useState<Locale>(locales[0]);

  const setLocaleValue = (locale: Locale, next: string) => {
    onChange({ ...value, [locale]: next });
  };

  const activeValue = value[activeLocale] ?? "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {locales.map((locale) => (
          <Button
            key={locale}
            size="sm"
            type="button"
            variant={activeLocale === locale ? "default" : "outline"}
            onClick={() => setActiveLocale(locale)}
          >
            {localeLabels[locale]}
          </Button>
        ))}
      </div>

      {variant === "markdown" ? (
        <MarkdownField
          id={id ? `${id}-${activeLocale}` : undefined}
          minHeight={minHeight}
          value={activeValue}
          onChange={(next) => setLocaleValue(activeLocale, next)}
        />
      ) : (
        <Textarea
          id={id ? `${id}-${activeLocale}` : undefined}
          rows={2}
          value={activeValue}
          onChange={(e) => setLocaleValue(activeLocale, e.target.value)}
        />
      )}
    </div>
  );
}
