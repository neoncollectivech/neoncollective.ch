import type { Locale } from "@/i18n/config";

import { getContent } from "@/lib/content";
import { BlockRenderer } from "@/components/block-renderer";
import { PageShell } from "@/components/page-shell";

type Props = { params: Promise<{ locale: string }> };

export default async function Home({ params }: Props) {
  const locale = (await params).locale as Locale;
  const content = await getContent("home", locale);

  return (
    <>
      {/* Hero block renders full-height with scroll indicator */}
      <BlockRenderer blocks={content.blocks.slice(0, 1)} locale={locale} />

      {/* Manifesto excerpt */}
      <PageShell as="section" width="prose">
        <BlockRenderer blocks={content.blocks.slice(1)} locale={locale} />
      </PageShell>
    </>
  );
}
