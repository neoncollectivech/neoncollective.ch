import type { Locale } from "@/i18n/config";

import { Metadata } from "next";

import { getContent } from "@/lib/content";
import { BlockRenderer } from "@/components/block-renderer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const content = await getContent("engage", locale);

  return {
    title: content.meta.title,
    description: content.meta.description,
  };
}

export default async function EngagePage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const content = await getContent("engage", locale);

  return (
    <article className="py-16 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <BlockRenderer blocks={content.blocks} locale={locale} />
      </div>
    </article>
  );
}
