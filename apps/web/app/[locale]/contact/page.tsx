import type { Locale } from "@/i18n/config";

import { Metadata } from "next";

import { getContent } from "@/lib/content";
import { BlockRenderer } from "@/components/block-renderer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const content = await getContent("contact", locale);

  return { title: content.meta.title };
}

export default async function ContactPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const content = await getContent("contact", locale);

  return (
    <section className="flex flex-grow">
      <div className="mx-auto flex flex-col gap-4 py-8 md:py-10 lg:max-w-5xl px-6">
        <BlockRenderer blocks={content.blocks} locale={locale} />
      </div>
    </section>
  );
}
